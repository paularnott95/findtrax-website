import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const audit = JSON.parse(await readFile('data/seo-page-audit.json', 'utf8'))
const patternAudit = JSON.parse(await readFile('data/url-pattern-audit.json', 'utf8'))
const noindexPatterns = JSON.parse(await readFile('data/noindex-patterns.json', 'utf8'))
const canonicalMap = JSON.parse(await readFile('data/canonical-map.json', 'utf8'))

assert(audit.summary, 'SEO audit summary exists')
assert(audit.summary.generatedSitemapAssetUrlCount > 100000, 'mass generated sitemap URL inventory is recorded')
assert(patternAudit.summary.estimatedUrlCountAffected >= audit.summary.generatedSitemapAssetUrlCount, 'pattern audit accounts for generated URL inventory')
assert(noindexPatterns.patterns.some((pattern) => pattern.patternName.includes('generated-location')), 'generated location sitemap pattern is noindex/disallow classified')
assert(noindexPatterns.patterns.some((pattern) => pattern.patternName.includes('generated-translation')), 'generated translation sitemap pattern is noindex/disallow classified')
assert(canonicalMap.entries.some((entry) => entry.url.includes('/pages/country-search') && entry.canonicalTarget.endsWith('/pages/country-intelligence')), 'Country Search canonical maps to Country Intelligence')

const badIndexable = audit.pages.filter((page) => page.indexDecision === 'index' && (
  page.issues.includes('thin-content') ||
  page.issues.includes('empty-links') ||
  !page.canonical ||
  !page.title ||
  !page.metaDescription
))

assert.equal(badIndexable.length, 0, `indexable pages fail quality gate: ${badIndexable.map((page) => page.url).join(', ')}`)
console.log('SEO quality gate passed')

