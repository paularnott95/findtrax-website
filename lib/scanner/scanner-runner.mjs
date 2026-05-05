import { readFile } from 'node:fs/promises'

import { isPublishableActive } from './classify-status.mjs'
import { dedupeCases } from './dedupe-cases.mjs'
import { fetchSource } from './fetch-source.mjs'
import { normaliseCase } from './normalise-case.mjs'
import { parseFetchedSource, parseHtmlCase } from './parse-source.mjs'
import { toPublicScannerCase } from './public-case-mapper.mjs'
import { credentialPresence } from './scanner-config.mjs'
import { writeScannerReports } from './scanner-report.mjs'
import { publishCasesToShopify, shopifyHealth } from './shopify-publisher.mjs'

export async function loadSources() {
  return JSON.parse(await readFile('data/scanner-sources.json', 'utf8'))
}

export async function loadExistingCases() {
  try {
    return JSON.parse(await readFile('data/missing-alerts-public-cases.json', 'utf8'))
  } catch {
    return []
  }
}

export async function scannerHealthcheck() {
  const sources = await loadSources()
  return {
    checkedAt: new Date().toISOString(),
    sources: {
      total: sources.length,
      enabled: sources.filter((source) => source.enabled).length,
      disabled: sources.filter((source) => !source.enabled).map((source) => ({ name: source.name, countryCode: source.countryCode, reason: source.notes || 'disabled' })),
    },
    credentials: credentialPresence(),
    shopify: shopifyHealth(),
    schedule: {
      githubActionsWorkflow: '.github/workflows/missing-alerts-scanner.yml',
      expected: 'every 6 hours and workflow_dispatch',
    },
  }
}

export async function runScanner(options = {}) {
  const sources = await loadSources()
  const existing = await loadExistingCases()
  const fetched = []
  const errors = []
  const skipped = []
  const rawCases = []

  for (const source of sources) {
    if (!source.enabled && !options.includeDisabled) {
      skipped.push({ sourceName: source.name, countryCode: source.countryCode, reason: 'source-disabled' })
      continue
    }
    try {
      const result = await fetchSource(source, options)
      if (result.skipped) {
        skipped.push({ sourceName: source.name, countryCode: source.countryCode, reason: result.reason })
        continue
      }
      fetched.push({ sourceName: source.name, status: result.status, url: result.url })
      rawCases.push(...parseFetchedSource(result))
    } catch (error) {
      errors.push({ sourceName: source.name, countryCode: source.countryCode, reason: error.message })
    }
  }

  if (options.fixtureMode) {
    const fixtures = JSON.parse(await readFile('data/scanner-source-fixtures.json', 'utf8'))
    rawCases.push(...fixtures)
  }

  const normalised = rawCases.map((item) => normaliseCase(item))
  const valid = []
  for (const item of normalised) {
    if (!item.name || !item.countryCode || !item.sourceUrl || !item.sourceName || !item.isPublic) {
      skipped.push({ sourceUrl: item.sourceUrl, sourceName: item.sourceName, reason: 'missing-required-public-fields' })
      continue
    }
    valid.push(item)
  }

  const { accepted, duplicates } = dedupeCases(valid, existing)
  skipped.push(...duplicates)

  const publishable = []
  const review = []
  for (const item of accepted) {
    const publicCase = toPublicScannerCase(item)
    if (isPublishableActive(publicCase.status)) publishable.push(publicCase)
    else review.push({ ...publicCase, reviewReason: `status-${publicCase.status}-not-active-or-uncertain` })
  }

  const status = {
    lastScanAt: new Date().toISOString(),
    importedCount: accepted.length,
    publishableCount: publishable.length,
    reviewCount: review.length,
    skippedCount: skipped.length,
    duplicateCount: duplicates.length,
    errorCount: errors.length,
    enabledSourceCount: sources.filter((source) => source.enabled).length,
    notes: sources.some((source) => source.enabled) ? [] : ['No live trusted scanner source is enabled. Direct official URL import is available; scheduled live source publishing needs approved source URLs and Shopify Admin credentials.'],
  }
  const report = { status, fetched, publishable, review, skipped, errors }
  const result = { status, report, publishable, review, skipped, errors }
  if (!options.noWrite) await writeScannerReports(result)
  return result
}

export async function importOfficialUrl({ url, countryCode, publish = false }) {
  const response = await fetch(url, { headers: { 'user-agent': 'MissingAlertsScanner/1.0 (+https://missingalerts.com)', accept: 'text/html' } })
  const html = await response.text()
  const parsed = parseHtmlCase(html, { sourceUrl: url, url, countryCode, sourceName: new URL(url).hostname })
  const normalised = normaliseCase(parsed)
  const publicCase = toPublicScannerCase(normalised)
  const result = {
    importedAt: new Date().toISOString(),
    sourceUrl: url,
    countryCode,
    case: publicCase,
    publishable: isPublishableActive(publicCase.status),
    published: null,
  }
  if (publish && result.publishable) result.published = await publishCasesToShopify([publicCase])
  return result
}
