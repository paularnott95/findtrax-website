import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { collectImageCandidates, extractCasePhoto } from '../lib/scanner/extract-case-photo.mjs'
import { shopifyHealth } from '../lib/scanner/shopify-publisher.mjs'

const previous = JSON.parse(await readFile('data/case-photo-import-report.json', 'utf8')).results || []
const names = [
  'Jan Hussain',
  'Vitoria Barreto',
  'Jack Smith',
  'Kian Gillespie',
  'John Morgan',
  'Trisha Anne Graf',
  'Joel Anderson',
  'Rowena Walker',
  'Antoine Richard',
  'Sarah Guillen',
  'Martha Wes Dunn',
  'Cody Fieldhouse',
  'Amanda Batchelar',
]
const knownSourceUrls = {
  'Jan Hussain': 'https://www.scotland.police.uk/what-s-happening/news/2026/april/appeal-to-help-trace-jan-hussain-believed-to-have-travelled-to-glasgow/',
}

const health = shopifyHealth()
const results = []

for (const name of names) {
  const existing = previous.find((item) => item.name === name) || {}
  const sourceUrl = existing.sourceUrl || knownSourceUrls[name] || ''
  if (!sourceUrl) {
    results.push(resultFor({ name, fallbackUsed: true, reason: 'source-url-missing-in-existing-report' }))
    continue
  }
  try {
    const response = await fetch(sourceUrl, {
      redirect: 'follow',
      headers: { 'user-agent': 'MissingAlertsScanner/1.0 (+https://missingalerts.com)' },
      signal: AbortSignal.timeout(15000),
    })
    const html = await response.text()
    const candidates = collectImageCandidates(html, sourceUrl)
    const photo = await extractCasePhoto(html, sourceUrl)
    const imageFound = Boolean(photo.url)
    results.push(resultFor({
      name,
      sourceUrl,
      sourceStatus: response.status,
      imageFound,
      extractionMethod: photo.method,
      imageUrl: photo.url,
      candidateCount: candidates.length,
      attachedToShopify: false,
      fallbackUsed: !imageFound,
      liveUrl: existing.liveUrl,
      reason: imageFound ? '' : 'no usable public case image found; rejected logos/placeholders/generic site images',
    }))
  } catch (error) {
    results.push(resultFor({
      name,
      sourceUrl,
      sourceStatus: 0,
      imageFound: false,
      extractionMethod: 'fetch-error',
      imageUrl: '',
      candidateCount: 0,
      attachedToShopify: false,
      fallbackUsed: true,
      liveUrl: existing.liveUrl,
      reason: error.message,
    }))
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  shopifyImageUpdateReady: health.ready,
  shopifyImageUpdateBlockedReason: health.ready ? '' : 'Shopify Admin credentials or blog target missing in local environment; report generated without mutating live articles.',
  results,
}

await mkdir('data', { recursive: true })
await writeFile('data/case-photo-import-report.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(`casePhotoResults=${results.length} imageFound=${results.filter((item) => item.imageFound).length} fallback=${results.filter((item) => item.fallbackUsed).length} shopifyReady=${health.ready}`)

function resultFor(input) {
  return {
    name: input.name,
    sourceUrl: input.sourceUrl || '',
    sourceStatus: input.sourceStatus || 0,
    imageFound: Boolean(input.imageFound),
    extractionMethod: input.extractionMethod || 'fallback',
    imageUrl: input.imageUrl || '',
    candidateCount: input.candidateCount || 0,
    attachedToShopify: Boolean(input.attachedToShopify),
    fallbackUsed: Boolean(input.fallbackUsed),
    liveUrl: input.liveUrl || '',
    reason: input.reason || '',
  }
}
