import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const SITE = process.env.SEO_AUDIT_BASE_URL || 'https://missingalerts.com'
const MAX_URLS = Number(process.env.SEO_AUDIT_MAX_URLS || 200)
const OUT_JSON = 'data/seo-page-audit.json'
const OUT_DOC = 'docs/seo-content-audit.md'

const sitemapUrls = await collectSitemapUrls(`${SITE}/sitemap.xml`, MAX_URLS)
const urls = Array.from(new Set([SITE, `${SITE}/pages/missing-person-advice`, `${SITE}/pages/country-search`, ...sitemapUrls])).slice(0, MAX_URLS)
const pages = []

for (const url of urls) {
  pages.push(await auditUrl(url))
}

const duplicateTitleMap = groupDuplicates(pages, 'title')
const duplicateMetaMap = groupDuplicates(pages, 'metaDescription')
for (const page of pages) {
  page.duplicateGroup = duplicateTitleMap.get(page.title) || null
  if (!page.duplicateGroup && duplicateMetaMap.has(page.metaDescription)) page.duplicateGroup = duplicateMetaMap.get(page.metaDescription)
  page.indexDecision = decideIndex(page)
}

const localSitemapInventory = await countLocalGeneratedSitemaps('/Users/paularnott/Desktop/missing-alerts-workspace/shopify-theme/assets')
const summary = {
  auditedAt: new Date().toISOString(),
  baseUrl: SITE,
  sampledUrlCount: pages.length,
  thinPagesFound: pages.filter((page) => page.issues.includes('thin-content')).length,
  duplicateGroupsFound: new Set(pages.map((page) => page.duplicateGroup).filter(Boolean)).size,
  noindexRecommended: pages.filter((page) => page.indexDecision === 'noindex').length,
  canonicalRecommended: pages.filter((page) => page.indexDecision === 'canonicalize').length,
  generatedSitemapAssetCount: localSitemapInventory.fileCount,
  generatedSitemapAssetUrlCount: localSitemapInventory.urlCount
}

await mkdir('data', { recursive: true })
await mkdir('docs', { recursive: true })
await writeFile(OUT_JSON, JSON.stringify({ summary, pages }, null, 2))
await writeFile(OUT_DOC, renderAuditDoc(summary, pages, localSitemapInventory))
console.log(`SEO audit wrote ${OUT_JSON} and ${OUT_DOC}`)

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
    indexDecision: 'unknown',
    issues: [],
    recommendedAction: ''
  }
  try {
    const res = await fetch(url, { redirect: 'follow' })
    page.status = res.status
    const html = await res.text()
    page.title = textMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
    page.metaDescription = attrMatch(html, /<meta[^>]+name=["']description["'][^>]*>/i, 'content')
    page.canonical = attrMatch(html, /<link[^>]+rel=["']canonical["'][^>]*>/i, 'href')
    page.robots = attrMatch(html, /<meta[^>]+name=["']robots["'][^>]*>/i, 'content')
    page.wordCount = visibleWordCount(html)
    if (page.status >= 400) page.issues.push('bad-status')
    if (!page.title) page.issues.push('missing-title')
    if (!page.metaDescription) page.issues.push('missing-meta-description')
    if (!page.canonical) page.issues.push('missing-canonical')
    if (page.wordCount < 180 && !url.includes('/blogs/missing-persons/')) page.issues.push('thin-content')
    if (page.robots.toLowerCase().includes('noindex')) page.issues.push('already-noindex')
    if (html.includes('href="#"') || html.includes('href=""')) page.issues.push('empty-links')
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

## Public Page Types

| Page type | Route pattern | Template/source | Index decision |
| --- | --- | --- | --- |
| Homepage | / | templates/index.json + homepage sections | Keep and enrich |
| Advice Hub | /pages/missing-person-advice | page.missing-person-advice.json / seo-advice-blog-grid | Keep and enrich |
| Country Search | /pages/country-search | page.country-search.json / country-search-page | Keep and index |
| Country pages | /pages/missing-people-country?country=:slug | page.missing-people-country.json + country profiles | Index only complete profiles |
| Missing cases blog | /blogs/missing-persons | Shopify blog articles | Keep public active cases |
| Found-safe blog | /blogs/found-safe | Shopify blog articles | Keep privacy-protected updates |
| Advice articles | /blogs/missing-person-advice/:handle | Shopify blog articles | Keep/rewrite/canonicalize by quality |
| Tag/filter pages | /blogs/*/tagged/* and filtered query URLs | Shopify generated archive URLs | Noindex/canonicalize |
| Generated location/language pages | CDN sitemap asset routes and client-generated filters | Theme assets/scripts | Noindex or remove from sitemap until enriched |
| Tools pages | /pages/tools, /pages/findtrax, /pages/intelpro, /pages/mediareach | Shopify pages/templates | Keep, product-only |
| Dashboard/admin/scanner mutation routes | private/admin/API routes | App/admin systems | Exclude/noindex |

## Current Thin-Page Source

The theme contains ${sitemapInventory.fileCount} generated sitemap XML assets with ${sitemapInventory.urlCount} total URL entries. These were the largest thin-page risk because they exposed mass-generated location, translation, alert, guide, and no-case pages outside Shopify's core sitemap quality controls. The live robots template now stops advertising those CDN sitemap assets and disallows the generated asset sitemap patterns.

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
