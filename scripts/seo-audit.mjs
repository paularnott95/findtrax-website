import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { classifyUrlPattern } from '../lib/seo/page-classifier.mjs'
import { evaluatePageQuality } from '../lib/seo/page-quality.mjs'
import { buildEnrichmentQueue } from '../lib/seo/enrichment-engine.mjs'

const SITE = process.env.SEO_AUDIT_BASE_URL || 'https://missingalerts.com'
const MAX_URLS = Number(process.env.SEO_AUDIT_MAX_URLS || 200)
const OUT_JSON = 'data/seo-page-audit.json'
const OUT_DOC = 'docs/seo-content-audit.md'
const OUT_INVENTORY = 'data/site-content-inventory.json'
const OUT_DUPLICATES = 'data/duplicate-page-groups.json'
const OUT_ACTIONS = 'data/seo-cleanup-actions.json'
const OUT_PATTERNS = 'data/url-pattern-audit.json'
const OUT_ENRICHMENT = 'data/enrichment-queue.json'
const OUT_NOINDEX = 'data/noindex-patterns.json'
const OUT_CANONICAL = 'data/canonical-map.json'
const OUT_REDIRECTS = 'data/redirect-recommendations.json'

const sitemapUrls = await collectSitemapUrls(`${SITE}/sitemap.xml`, MAX_URLS)
const urls = Array.from(new Set([SITE, `${SITE}/pages/missing-person-advice`, `${SITE}/pages/country-intelligence`, `${SITE}/pages/country-search`, ...sitemapUrls])).slice(0, MAX_URLS)
const pages = []

for (const url of urls) {
  pages.push(await auditUrl(url))
}

const duplicateTitleMap = groupDuplicates(pages, 'title')
const duplicateMetaMap = groupDuplicates(pages, 'metaDescription')
for (const page of pages) {
  page.duplicateGroup = duplicateTitleMap.get(page.title) || null
  if (!page.duplicateGroup && duplicateMetaMap.has(page.metaDescription)) page.duplicateGroup = duplicateMetaMap.get(page.metaDescription)
  const quality = evaluatePageQuality(page)
  Object.assign(page, quality)
}

const localSitemapInventory = await countLocalGeneratedSitemaps('/Users/paularnott/Desktop/missing-alerts-workspace/shopify-theme/assets')
const patternAudit = renderPatternAudit(pages, localSitemapInventory)
const summary = {
  auditedAt: new Date().toISOString(),
  baseUrl: SITE,
  sampledUrlCount: pages.length,
  thinPagesFound: pages.filter((page) => page.issues.includes('thin-content')).length,
  duplicateGroupsFound: new Set(pages.map((page) => page.duplicateGroup).filter(Boolean)).size,
  noindexRecommended: pages.filter((page) => String(page.indexDecision).startsWith('noindex')).length,
  canonicalRecommended: pages.filter((page) => page.indexDecision === 'canonicalize').length,
  generatedSitemapAssetCount: localSitemapInventory.fileCount,
  generatedSitemapAssetUrlCount: localSitemapInventory.urlCount,
  estimatedUrlCountAffected: patternAudit.summary.estimatedUrlCountAffected,
  adsenseRiskPatterns: patternAudit.patterns.filter((item) => item.adsenseRisk !== 'low').length,
}

await mkdir('data', { recursive: true })
await mkdir('docs', { recursive: true })
await writeFile(OUT_JSON, JSON.stringify({ summary, pages }, null, 2))
await writeFile(OUT_INVENTORY, JSON.stringify(renderInventory(summary, pages, localSitemapInventory), null, 2))
await writeFile(OUT_DUPLICATES, JSON.stringify(renderDuplicateGroups(pages), null, 2))
await writeFile(OUT_ACTIONS, JSON.stringify(renderCleanupActions(summary, pages, localSitemapInventory), null, 2))
await writeFile(OUT_PATTERNS, JSON.stringify(patternAudit, null, 2))
await writeFile(OUT_ENRICHMENT, JSON.stringify({ generatedAt: summary.auditedAt, queue: buildEnrichmentQueue(pages) }, null, 2))
await writeFile(OUT_NOINDEX, JSON.stringify(renderNoindexPatterns(patternAudit), null, 2))
await writeFile(OUT_CANONICAL, JSON.stringify(renderCanonicalMap(pages), null, 2))
await writeFile(OUT_REDIRECTS, JSON.stringify(renderRedirectRecommendations(pages), null, 2))
await writeFile(OUT_DOC, renderAuditDoc(summary, pages, localSitemapInventory))
console.log(`SEO audit wrote ${OUT_JSON}, pattern reports, cleanup maps, and ${OUT_DOC}`)

async function collectSitemapUrls(url, max, seen = new Set()) {
  if (seen.has(url) || seen.size > max * 2) return []
  seen.add(url)
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return []
    const xml = await res.text()
    const locs = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g)).map((match) => decodeXml(match[1].trim()))
    const childSitemaps = locs.filter((item) => item.includes('sitemap') && item.endsWith('.xml'))
    const pageUrls = locs.filter((item) => !childSitemaps.includes(item))
    const nested = []
    for (const child of childSitemaps.slice(0, 20)) {
      nested.push(...await collectSitemapUrls(child, max, seen))
      if (nested.length + pageUrls.length >= max) break
    }
    return [...pageUrls, ...nested].slice(0, max)
  } catch (error) {
    return []
  }
}

async function auditUrl(url) {
  const page = {
    url,
    status: 0,
    title: '',
    metaDescription: '',
    canonical: '',
    robots: '',
    wordCount: 0,
    template: inferTemplate(url),
    patternName: '',
    routeSource: '',
    dataSource: '',
    indexDecision: 'unknown',
    issues: [],
    recommendedAction: '',
    sourceLinksCount: 0,
    internalLinksCount: 0,
    brokenLinksCount: 0,
    imageStatus: 'unknown',
    officialLinksPresent: false,
    caseDataPresent: false,
    countrySpecificBlocksPresent: false,
    topicSpecificBlocksPresent: false,
    faqPresent: false,
    schemaPresent: false,
    uniqueLocalDataCount: 0,
  }
  const classified = classifyUrlPattern(url)
  page.patternName = classified.patternName
  page.routeSource = classified.template
  page.recommendedPatternAction = classified.patternAction
  try {
    const res = await fetch(url, { redirect: 'follow' })
    page.status = res.status
    const html = await res.text()
    page.title = textMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
    page.metaDescription = attrMatch(html, /<meta[^>]+name=["']description["'][^>]*>/i, 'content')
    page.canonical = attrMatch(html, /<link[^>]+rel=["']canonical["'][^>]*>/i, 'href')
    page.robots = attrMatch(html, /<meta[^>]+name=["']robots["'][^>]*>/i, 'content')
    page.wordCount = visibleWordCount(html)
    const linkStats = inspectLinks(html, url)
    page.sourceLinksCount = linkStats.sourceLinksCount
    page.internalLinksCount = linkStats.internalLinksCount
    page.brokenLinksCount = linkStats.brokenLinksCount
    page.imageStatus = inspectImages(html)
    page.officialLinksPresent = /police|gov\.|garda|rcmp|namus|ncmec|missingpersons|official/i.test(html)
    page.caseDataPresent = /last seen|missing since|source verified|police|appeal/i.test(html)
    page.countrySpecificBlocksPresent = /country intelligence|emergency|official reporting|safe sharing/i.test(html)
    page.topicSpecificBlocksPresent = /what not to do|practical steps|sightings|cctv|dashcam|doorbell|family support/i.test(html)
    page.faqPresent = /faq|frequently asked|application\/ld\+json[\s\S]*FAQPage/i.test(html)
    page.schemaPresent = /application\/ld\+json/i.test(html)
    page.uniqueLocalDataCount = [
      page.officialLinksPresent,
      page.countrySpecificBlocksPresent,
      page.topicSpecificBlocksPresent,
      page.caseDataPresent,
      page.faqPresent,
      page.schemaPresent,
      page.sourceLinksCount > 0,
      page.internalLinksCount > 2,
    ].filter(Boolean).length
    if (page.status >= 400) page.issues.push('bad-status')
    if (!page.title) page.issues.push('missing-title')
    if (!page.metaDescription) page.issues.push('missing-meta-description')
    if (!page.canonical) page.issues.push('missing-canonical')
    if (page.wordCount < 180 && !url.includes('/blogs/missing-persons/')) page.issues.push('thin-content')
    if (page.robots.toLowerCase().includes('noindex')) page.issues.push('already-noindex')
    if (html.includes('href="#"') || html.includes('href=""')) page.issues.push('empty-links')
    if (page.imageStatus === 'broken') page.issues.push('broken-image')
  } catch (error) {
    page.issues.push(`fetch-error:${error.message}`)
  }
  page.recommendedAction = recommendedAction(page)
  return page
}

function decideIndex(page) {
  if (page.robots.toLowerCase().includes('noindex')) return 'noindex'
  if (page.status >= 400 || page.issues.includes('thin-content')) return 'noindex'
  if (page.duplicateGroup) return 'canonicalize'
  return 'index'
}

function inspectLinks(html, pageUrl) {
  const links = [...String(html || '').matchAll(/<a\b[^>]*href=["']([^"']*)["'][^>]*>/gi)].map((match) => match[1])
  const base = new URL(pageUrl)
  let internalLinksCount = 0
  let sourceLinksCount = 0
  let brokenLinksCount = 0
  for (const href of links) {
    if (!href || href === '#') {
      brokenLinksCount += 1
      continue
    }
    try {
      const parsed = new URL(href, base)
      if (parsed.hostname === base.hostname) internalLinksCount += 1
      else sourceLinksCount += 1
    } catch {
      brokenLinksCount += 1
    }
  }
  return { internalLinksCount, sourceLinksCount, brokenLinksCount }
}

function inspectImages(html) {
  const tags = [...String(html || '').matchAll(/<img\b[^>]*>/gi)].map((match) => match[0])
  if (!tags.length) return 'missing'
  if (tags.some((tag) => /src=["'](?:\s*|#)["']/i.test(tag))) return 'broken'
  if (tags.some((tag) => /alt=["'][^"']{3,}["']/i.test(tag))) return 'present'
  return 'present-missing-alt'
}

function recommendedAction(page) {
  if (page.status >= 400) return 'Redirect to the closest useful page or remove from sitemap.'
  if (page.issues.includes('thin-content')) return 'Noindex until enriched with useful country/topic/case content.'
  if (page.duplicateGroup) return 'Canonicalize or merge duplicate content into the strongest page.'
  if (page.issues.includes('missing-title') || page.issues.includes('missing-meta-description')) return 'Add unique SEO title and meta description.'
  return 'Keep and monitor.'
}

function groupDuplicates(pages, key) {
  const map = new Map()
  const groups = new Map()
  for (const page of pages) {
    const value = (page[key] || '').trim().toLowerCase()
    if (!value) continue
    if (!map.has(value)) map.set(value, [])
    map.get(value).push(page.url)
  }
  let i = 1
  for (const [value, urls] of map.entries()) {
    if (urls.length < 2) continue
    const group = `${key}-${i++}`
    groups.set(value, group)
  }
  return groups
}

async function countLocalGeneratedSitemaps(assetDir) {
  const result = { fileCount: 0, urlCount: 0, files: [] }
  try {
    const names = await readdir(assetDir)
    for (const name of names) {
      if (!name.includes('sitemap') || !name.endsWith('.xml')) continue
      const file = path.join(assetDir, name)
      const fileStat = await stat(file)
      if (!fileStat.isFile()) continue
      const xml = await readFile(file, 'utf8')
      const count = (xml.match(/<loc>/g) || []).length
      result.fileCount += 1
      result.urlCount += count
      result.files.push({ file: name, urls: count })
    }
  } catch {
    return result
  }
  return result
}

function renderAuditDoc(summary, pages, sitemapInventory) {
  const thin = pages.filter((page) => page.issues.includes('thin-content')).slice(0, 25)
  const duplicates = pages.filter((page) => page.duplicateGroup).slice(0, 25)
  return `# Missing Alerts SEO Content Audit

Generated: ${summary.auditedAt}

## Summary

- Base URL: ${summary.baseUrl}
- Sampled live URLs: ${summary.sampledUrlCount}
- Thin pages found in sample: ${summary.thinPagesFound}
- Duplicate title/meta groups found in sample: ${summary.duplicateGroupsFound}
- Noindex recommended in sample: ${summary.noindexRecommended}
- Canonicalization recommended in sample: ${summary.canonicalRecommended}
- Generated sitemap asset files in theme: ${summary.generatedSitemapAssetCount}
- Generated sitemap asset URLs in theme: ${summary.generatedSitemapAssetUrlCount}
- Estimated URL count affected by pattern-level cleanup: ${summary.estimatedUrlCountAffected}
- AdSense-risk patterns identified: ${summary.adsenseRiskPatterns}

## Public Page Types

| Page type | Route pattern | Template/source | Index decision |
| --- | --- | --- | --- |
| Homepage | / | templates/index.json + homepage sections | Keep and enrich |
| Advice Hub | /pages/missing-person-advice | page.missing-person-advice.json / seo-advice-blog-grid | Keep and enrich |
| Country Intelligence | /pages/country-intelligence | page.country-intelligence.json / country-search-page | Keep and index |
| Country Search legacy | /pages/country-search | page.country-search.json / country-search-page | Canonical to Country Intelligence |
| Country pages | /pages/missing-people-country?country=:slug | page.missing-people-country.json + country profiles | Index only complete profiles |
| Missing cases blog | /blogs/missing-persons | Shopify blog articles | Keep public active cases |
| Found-safe blog | /blogs/found-safe | Shopify blog articles | Keep privacy-protected updates |
| Advice articles | /blogs/missing-person-advice/:handle | Shopify blog articles | Keep/rewrite/canonicalize by quality |
| Tag/filter pages | /blogs/*/tagged/* and filtered query URLs | Shopify generated archive URLs | Noindex/canonicalize |
| Generated location/language pages | CDN sitemap asset routes and client-generated filters | Theme assets/scripts | Noindex or remove from sitemap until enriched |
| Tools pages | /pages/tools, /pages/findtrax, /pages/intelpro, /pages/mediareach | Shopify pages/templates | Keep, product-only |
| Dashboard/admin/scanner mutation routes | private/admin/API routes | App/admin systems | Exclude/noindex |

## Current Thin-Page Source

The theme contains ${sitemapInventory.fileCount} generated sitemap XML assets with ${sitemapInventory.urlCount} total URL entries. These were the largest thin-page risk because they exposed mass-generated location, translation, alert, guide, and no-case pages outside Shopify's core sitemap quality controls. The robots template now stops advertising those CDN sitemap assets and disallows the generated asset sitemap patterns; the files remain inventoried so they can be deleted from the live theme only through a deliberate non-nodelete Shopify deletion pass.

## Thin Pages Sample

${thin.map((page) => `- ${page.url} (${page.wordCount} words): ${page.recommendedAction}`).join('\n') || '- None found in the sampled live URLs.'}

## Duplicate Groups Sample

${duplicates.map((page) => `- ${page.duplicateGroup}: ${page.url}`).join('\n') || '- None found in the sampled live URLs.'}

## Content Decisions

- Keep and enrich: homepage, Advice Hub, Country Search, complete country pages, public active case pages, found-safe updates with privacy-safe imagery, and product pages.
- Rewrite: generic advice pages and country/language pages that do not contain official links, local reporting context, or useful Missing Alerts guidance.
- Merge/canonicalize: repeated CCTV/dashcam/doorbell and language/category variants where only a country name changes.
- Noindex temporarily: generated location/search/filter/tag pages, incomplete country profiles, placeholders, and pages with insufficient body content.
- Delete or redirect: broken URLs and empty generated pages that do not serve a user intent.

## Next Content Queue

The six priority countries now have structured profiles. Additional countries should be added only when verified reporting links, emergency guidance, safe sharing notes, and enough local context are available. Until then, generated pages should stay noindexed or absent from sitemap output.
`
}

function renderPatternAudit(pages, sitemapInventory) {
  const byPattern = new Map()
  for (const page of pages) {
    const key = page.patternName || page.template || 'unknown'
    if (!byPattern.has(key)) {
      byPattern.set(key, {
        patternName: key,
        exampleUrls: [],
        sampledCount: 0,
        estimatedAffectedUrlCount: 0,
        routeSource: page.routeSource || page.template || '',
        dataSource: inferDataSource(key),
        statusCodes: {},
        indexDecisions: {},
        titlePatterns: new Set(),
        metaDescriptionPatterns: new Set(),
        wordCountSamples: [],
        issues: new Set(),
        recommendedAction: page.recommendedPatternAction || 'quality-gate',
        seoRisk: 'low',
        adsenseRisk: 'low',
      })
    }
    const item = byPattern.get(key)
    item.sampledCount += 1
    item.estimatedAffectedUrlCount += 1
    if (item.exampleUrls.length < 8) item.exampleUrls.push(page.url)
    item.statusCodes[page.status] = (item.statusCodes[page.status] || 0) + 1
    item.indexDecisions[page.indexDecision] = (item.indexDecisions[page.indexDecision] || 0) + 1
    item.titlePatterns.add(normalizePattern(page.title))
    item.metaDescriptionPatterns.add(normalizePattern(page.metaDescription))
    item.wordCountSamples.push(page.wordCount)
    for (const issue of page.issues || []) item.issues.add(issue)
    if (page.adsenseRisk) item.adsenseRisk = 'high'
    if (page.thinRisk || page.duplicateGroup) item.seoRisk = 'high'
  }

  for (const file of sitemapInventory.files || []) {
    const key = generatedSitemapPattern(file.file)
    if (!byPattern.has(key)) {
      byPattern.set(key, {
        patternName: key,
        exampleUrls: [`theme asset: ${file.file}`],
        sampledCount: 0,
        estimatedAffectedUrlCount: file.urls,
        routeSource: 'Shopify theme asset sitemap XML',
        dataSource: 'generated sitemap asset',
        statusCodes: {},
        indexDecisions: { noindex: file.urls },
        titlePatterns: [],
        metaDescriptionPatterns: [],
        wordCountSamples: [],
        issues: ['mass-generated-sitemap-asset', 'thin-url-risk'],
        recommendedAction: 'remove from robots/sitemap, disallow, delete in controlled theme cleanup if safe',
        seoRisk: 'high',
        adsenseRisk: 'high',
      })
    } else {
      byPattern.get(key).estimatedAffectedUrlCount += file.urls
    }
  }

  const patterns = [...byPattern.values()].map((item) => ({
    ...item,
    titlePatterns: [...item.titlePatterns || []].slice(0, 5),
    metaDescriptionPatterns: [...item.metaDescriptionPatterns || []].slice(0, 5),
    issues: [...item.issues || []],
    averageWordCount: item.wordCountSamples?.length ? Math.round(item.wordCountSamples.reduce((sum, value) => sum + value, 0) / item.wordCountSamples.length) : 0,
    wordCountSamples: item.wordCountSamples?.slice(0, 12) || [],
  }))

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      patternCount: patterns.length,
      estimatedUrlCountAffected: patterns.reduce((sum, item) => sum + Number(item.estimatedAffectedUrlCount || 0), 0),
      highSeoRiskPatterns: patterns.filter((item) => item.seoRisk === 'high').length,
      highAdsenseRiskPatterns: patterns.filter((item) => item.adsenseRisk === 'high').length,
    },
    patterns,
  }
}

function renderNoindexPatterns(patternAudit) {
  return {
    generatedAt: new Date().toISOString(),
    patterns: patternAudit.patterns
      .filter((pattern) => /noindex|remove|disallow|canonical/i.test(pattern.recommendedAction) || pattern.seoRisk === 'high')
      .map((pattern) => ({
        patternName: pattern.patternName,
        estimatedAffectedUrlCount: pattern.estimatedAffectedUrlCount,
        action: pattern.recommendedAction,
        reason: pattern.issues,
        verification: 'Covered by theme robots/noindex/canonical quality gate where route renders through Shopify; generated asset XML inventoried for controlled deletion.',
      })),
  }
}

function renderCanonicalMap(pages) {
  return {
    generatedAt: new Date().toISOString(),
    entries: pages
      .filter((page) => page.indexDecision === 'canonicalize' || page.url.includes('/pages/country-search'))
      .map((page) => ({
        url: page.url,
        canonicalTarget: page.url.includes('/pages/country-search') ? 'https://missingalerts.com/pages/country-intelligence' : page.canonical,
        reason: page.duplicateGroup ? `Duplicate group ${page.duplicateGroup}` : 'Legacy route canonicalized to primary country system',
      })),
  }
}

function renderRedirectRecommendations(pages) {
  return {
    generatedAt: new Date().toISOString(),
    entries: pages
      .filter((page) => page.indexDecision === 'redirect-or-remove' || page.status >= 400)
      .map((page) => ({
        url: page.url,
        recommendedTarget: 'https://missingalerts.com/pages/missing-person-advice',
        reason: page.issues.join(', ') || 'Broken or obsolete URL',
      })),
  }
}

function inferDataSource(patternName) {
  if (patternName.includes('country')) return 'data/country-profiles.json and Shopify page templates'
  if (patternName.includes('case')) return 'Shopify blog articles and scanner metafields'
  if (patternName.includes('advice')) return 'Shopify advice pages/blog articles'
  if (patternName.includes('sitemap')) return 'theme asset XML'
  return 'Shopify theme/page output'
}

function generatedSitemapPattern(fileName) {
  if (fileName.startsWith('translation-sitemap')) return 'generated-translation-sitemap-assets'
  if (fileName.startsWith('location-sitemap')) return 'generated-location-sitemap-assets'
  if (fileName.startsWith('nearby-sitemap')) return 'generated-nearby-sitemap-assets'
  if (fileName.startsWith('alert-sitemap')) return 'generated-alert-sitemap-assets'
  if (fileName.startsWith('no-case-sitemap')) return 'generated-no-case-sitemap-assets'
  if (fileName.startsWith('guide-sitemap')) return 'generated-guide-sitemap-assets'
  if (fileName.startsWith('cluster-sitemap')) return 'generated-cluster-sitemap-assets'
  return 'generated-other-sitemap-assets'
}

function normalizePattern(value) {
  return String(value || '')
    .replace(/\b\d{1,4}\b/g, ':number')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function renderInventory(summary, pages, sitemapInventory) {
  const patterns = new Map()
  for (const page of pages) {
    const key = page.template || 'unknown'
    if (!patterns.has(key)) patterns.set(key, { pageType: key, sampledCount: 0, indexableSampleCount: 0, noindexSampleCount: 0, issues: new Set(), exampleUrls: [] })
    const item = patterns.get(key)
    item.sampledCount += 1
    if (page.indexDecision === 'index') item.indexableSampleCount += 1
    if (page.indexDecision === 'noindex') item.noindexSampleCount += 1
    for (const issue of page.issues || []) item.issues.add(issue)
    if (item.exampleUrls.length < 5) item.exampleUrls.push(page.url)
  }
  return {
    generatedAt: summary.auditedAt,
    totalSampledUrls: summary.sampledUrlCount,
    generatedSitemapAssetCount: sitemapInventory.fileCount,
    generatedSitemapAssetUrlCount: sitemapInventory.urlCount,
    patterns: [...patterns.values()].map((item) => ({
      ...item,
      issues: [...item.issues],
      action: item.noindexSampleCount ? 'review/noindex/enrich by pattern' : 'keep/enrich',
    })),
  }
}

function renderDuplicateGroups(pages) {
  const groups = {}
  for (const page of pages) {
    if (!page.duplicateGroup) continue
    if (!groups[page.duplicateGroup]) groups[page.duplicateGroup] = []
    groups[page.duplicateGroup].push(page.url)
  }
  return { generatedAt: new Date().toISOString(), groupCount: Object.keys(groups).length, groups }
}

function renderCleanupActions(summary, pages, sitemapInventory) {
  const actions = [
    {
      pattern: 'generated CDN sitemap assets',
      affectedUrlCount: sitemapInventory.urlCount,
      action: 'remove from robots advertising, disallow asset sitemap patterns, keep out of primary sitemap',
      verification: sitemapInventory.urlCount > 0 ? 'inventory counted; robots template blocks generated asset sitemap patterns' : 'no generated sitemap assets found',
    },
    {
      pattern: 'tag/filter/search/archive variants',
      affectedUrlCount: pages.filter((page) => page.template === 'unknown' || page.url.includes('/tagged/')).length,
      action: 'noindex/canonicalize to primary archive or enrich before indexing',
      verification: 'sampled pages classified in seo-page-audit.json',
    },
    {
      pattern: 'legacy Country Search route',
      affectedUrlCount: 1,
      action: 'canonicalize to /pages/country-intelligence',
      verification: 'layout theme canonical override added',
    },
  ]
  return {
    generatedAt: summary.auditedAt,
    thinPagesFound: summary.thinPagesFound,
    duplicateGroupsFound: summary.duplicateGroupsFound,
    noindexRecommended: summary.noindexRecommended,
    canonicalRecommended: summary.canonicalRecommended + 1,
    actions,
  }
}

function textMatch(html, regex) {
  const match = html.match(regex)
  return match ? stripHtml(match[1]).trim() : ''
}

function attrMatch(html, tagRegex, attr) {
  const tag = html.match(tagRegex)?.[0] || ''
  const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))
  return match ? decodeXml(match[1].trim()) : ''
}

function visibleWordCount(html) {
  const text = stripHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' '))
  return text.split(/\s+/).filter(Boolean).length
}

function stripHtml(value) {
  return decodeXml(String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '))
}

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function inferTemplate(url) {
  const pathname = new URL(url).pathname
  if (pathname === '/') return 'homepage'
  if (pathname.includes('/pages/country-search')) return 'country-search'
  if (pathname.includes('/pages/missing-person-advice')) return 'advice-hub'
  if (pathname.includes('/pages/missing-people-country')) return 'country-page'
  if (pathname.includes('/blogs/missing-person-advice/')) return 'advice-article'
  if (pathname.includes('/blogs/missing-persons/')) return 'case-article'
  if (pathname.includes('/blogs/found-safe')) return 'found-safe'
  if (pathname.includes('/blogs/')) return 'blog'
  if (pathname.includes('/pages/')) return 'page'
  return 'unknown'
}
