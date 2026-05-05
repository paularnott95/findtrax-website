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
import { getShopifyAuthStatus } from './shopify-token-manager.mjs'

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
  const enabled = sources.filter((source) => source.enabled)
  return {
    checkedAt: new Date().toISOString(),
    sources: {
      total: sources.length,
      enabled: sources.filter((source) => source.enabled).length,
      disabled: sources.filter((source) => !source.enabled).map((source) => ({ name: source.name, countryCode: source.countryCode, reason: source.notes || 'disabled' })),
    },
    credentials: credentialPresence(),
    token: getShopifyAuthStatus(),
    shopify: shopifyHealth(),
    schedule: {
      githubActionsWorkflow: '.github/workflows/missing-alerts-scanner.yml',
      expected: 'every 6 hours and workflow_dispatch',
    },
    scale: scannerScalePlan(sources),
    enabledSources: enabled.map((source) => sourceHealth(source)),
  }
}

export async function runScanner(options = {}) {
  const sources = await loadSources()
  const existing = await loadExistingCases()
  const fetched = []
  const errors = []
  const skipped = []
  const rawCases = []
  const perSource = {}
  const perCountry = {}
  const enabledSources = sources.filter((source) => source.enabled || options.includeDisabled)
  const concurrency = Math.max(1, Number(options.concurrency || process.env.SCANNER_CONCURRENCY || 3))

  const sourceResults = await mapWithConcurrency(sources, concurrency, async (source) => {
    ensureSourceStats(perSource, source)
    if (!source.enabled && !options.includeDisabled) {
      return { skipped: [{ sourceName: source.name, countryCode: source.countryCode, reason: 'source-disabled' }], rawCases: [], fetched: [], errors: [] }
    }
    try {
      const result = await fetchSource(source, options)
      if (result.skipped) {
        return { skipped: [{ sourceName: source.name, countryCode: source.countryCode, reason: result.reason }], rawCases: [], fetched: [], errors: [] }
      }
      const parsed = parseFetchedSource(result).slice(0, source.maxCasesPerRun || options.maxCasesPerSource || 100)
      return {
        skipped: [],
        rawCases: parsed,
        fetched: [{ sourceName: source.name, countryCode: source.countryCode, status: result.status, url: result.url, parsedCount: parsed.length }],
        errors: [],
      }
    } catch (error) {
      return { skipped: [], rawCases: [], fetched: [], errors: [{ sourceName: source.name, countryCode: source.countryCode, reason: error.message }] }
    }
  })

  for (const result of sourceResults) {
    fetched.push(...result.fetched)
    rawCases.push(...result.rawCases)
    skipped.push(...result.skipped)
    errors.push(...result.errors)
  }

  if (options.fixtureMode) {
    const fixtures = JSON.parse(await readFile('data/scanner-source-fixtures.json', 'utf8'))
    rawCases.push(...fixtures)
  }

  const normalised = rawCases.map((item) => normaliseCase(item))
  const valid = []
  for (const item of normalised) {
    bumpCountry(perCountry, item.countryCode || 'UNKNOWN', 'seen')
    if (!item.name || !item.countryCode || !item.sourceUrl || !item.sourceName || !item.isPublic) {
      skipped.push({ sourceUrl: item.sourceUrl, sourceName: item.sourceName, reason: 'missing-required-public-fields' })
      bumpCountry(perCountry, item.countryCode || 'UNKNOWN', 'skipped')
      continue
    }
    valid.push(item)
  }

  const { accepted, duplicates } = dedupeCases(valid, existing)
  skipped.push(...duplicates)

  const publishable = []
  const review = []
  const duplicateUpdates = duplicates
    .filter((item) => item && item.name && item.sourceUrl && item.isPublic)
    .map((item) => ({ ...item, scannerUpdateReason: item.reason }))
  for (const item of [...accepted, ...duplicateUpdates]) {
    const publicCase = toPublicScannerCase(item)
    if (isPublishableActive(publicCase.status)) {
      publishable.push(publicCase)
      bumpCountry(perCountry, publicCase.countryCode || 'UNKNOWN', 'publishable')
    } else {
      review.push({ ...publicCase, reviewReason: `status-${publicCase.status}-not-active-or-uncertain` })
      bumpCountry(perCountry, publicCase.countryCode || 'UNKNOWN', 'review')
    }
  }

  for (const item of fetched) {
    const stats = ensureSourceStats(perSource, { name: item.sourceName, countryCode: item.countryCode })
    stats.fetched += 1
    stats.parsed += item.parsedCount || 0
  }
  for (const item of skipped) {
    const stats = ensureSourceStats(perSource, item)
    stats.skipped += 1
  }
  for (const item of errors) {
    const stats = ensureSourceStats(perSource, item)
    stats.errors += 1
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
    queueDepth: publishable.length + review.length,
    concurrency,
    sourceCount: sources.length,
    sourceRunCount: enabledSources.length,
    perSource,
    perCountry,
    scale: scannerScalePlan(sources),
    notes: sources.some((source) => source.enabled) ? [] : ['No live trusted scanner source is enabled. Direct official URL import is available; scheduled live source publishing needs approved source URLs and Shopify Admin credentials.'],
  }
  const report = { status, fetched, publishable, review, skipped, errors }
  const result = { status, report, publishable, review, skipped, errors }
  if (!options.noWrite) await writeScannerReports(result)
  return result
}

export async function scannerSourceReport() {
  const sources = await loadSources()
  return {
    generatedAt: new Date().toISOString(),
    total: sources.length,
    enabled: sources.filter((source) => source.enabled).length,
    countries: Array.from(new Set(sources.map((source) => source.countryCode))).sort(),
    sources: sources.map((source) => ({
      name: source.name,
      countryCode: source.countryCode,
      countryName: source.countryName,
      enabled: Boolean(source.enabled),
      sourceType: source.sourceType,
      parser: source.parser,
      trustLevel: source.trustLevel,
      rateLimit: source.rateLimit,
      maxCasesPerRun: source.maxCasesPerRun || 100,
      pagination: Boolean(source.pagination || source.cursorParam || source.nextPageSelector),
      disabledReason: source.enabled ? '' : source.notes || 'disabled',
    })),
    scale: scannerScalePlan(sources),
  }
}

export async function importOfficialUrl({ url, countryCode, publish = false, overrides = {} }) {
  const response = await fetch(url, { headers: { 'user-agent': 'MissingAlertsScanner/1.0 (+https://missingalerts.com)', accept: 'text/html' } })
  const html = await response.text()
  const parsed = parseHtmlCase(html, { sourceUrl: url, url, countryCode, sourceName: new URL(url).hostname })
  const verifiedOverrides = {
    ...overrides,
    sourceUrl: url,
    url,
    countryCode,
  }
  if (overrides.name && !overrides.slug) verifiedOverrides.slug = slugifyOfficialImport(overrides.name)
  if (overrides.sourceName) verifiedOverrides.sourceName = overrides.sourceName
  const normalised = normaliseCase(parsed)
  const enriched = normaliseCase({ ...normalised, ...verifiedOverrides })
  const publicCase = toPublicScannerCase(enriched)
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

function slugifyOfficialImport(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

function scannerScalePlan(sources) {
  return {
    concurrencyDefault: Number(process.env.SCANNER_CONCURRENCY || 3),
    sourceIsolation: true,
    idempotentPublishing: true,
    duplicateChecks: ['sourceUrl', 'externalId', 'name+missingSince+countryCode'],
    batching: true,
    retryBackoff: true,
    checkpoints: true,
    enabledSourceCount: sources.filter((source) => source.enabled).length,
    disabledSourceCount: sources.filter((source) => !source.enabled).length,
  }
}

function sourceHealth(source) {
  return {
    name: source.name,
    countryCode: source.countryCode,
    sourceType: source.sourceType,
    parser: source.parser,
    maxCasesPerRun: source.maxCasesPerRun || 100,
    rateLimit: source.rateLimit,
  }
}

function ensureSourceStats(stats, source) {
  const key = [source.sourceName || source.name || 'unknown-source', source.countryCode || 'UNKNOWN'].join('|')
  if (!stats[key]) stats[key] = { sourceName: source.sourceName || source.name || 'unknown-source', countryCode: source.countryCode || 'UNKNOWN', fetched: 0, parsed: 0, skipped: 0, errors: 0 }
  return stats[key]
}

function bumpCountry(stats, countryCode, field) {
  const key = countryCode || 'UNKNOWN'
  if (!stats[key]) stats[key] = { seen: 0, publishable: 0, review: 0, skipped: 0 }
  stats[key][field] = (stats[key][field] || 0) + 1
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = []
  let index = 0
  async function run() {
    while (index < items.length) {
      const current = index
      index += 1
      results[current] = await worker(items[current], current)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, run))
  return results
}
