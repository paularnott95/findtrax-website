import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { classifyStatus, isPublishableActive } from '../lib/scanner/classify-status.mjs'
import { extractCasePhoto } from '../lib/scanner/extract-case-photo.mjs'
import { normaliseCase } from '../lib/scanner/normalise-case.mjs'
import { toPublicScannerCase } from '../lib/scanner/public-case-mapper.mjs'
import { scannerConfig } from '../lib/scanner/scanner-config.mjs'
import { getShopifyAccessToken, getShopifyAuthStatus } from '../lib/scanner/shopify-token-manager.mjs'
import { publishCasesToShopify, shopifyHealth } from '../lib/scanner/shopify-publisher.mjs'

const QUEUE_PATH = 'data/simple-case-import-queue.json'
const REPORT_PATH = 'data/simple-case-import-report.json'
const AUDIT_PATH = 'data/simple-case-visibility-audit.json'
const AUDIT_DOC_PATH = 'docs/simple-case-visibility-audit.md'
const USER_AGENT = 'MissingAlertsSimpleImporter/1.0 (+https://missingalerts.com)'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const publishEnabled = !dryRun && !args.has('--no-publish')

await mkdir('data/backups', { recursive: true })
await mkdir('docs', { recursive: true })

const startedAt = new Date().toISOString()
const health = shopifyHealth()
const auth = getShopifyAuthStatus()
const queue = JSON.parse(await readFile(QUEUE_PATH, 'utf8'))
const report = {
  startedAt,
  dryRun,
  shopifyReady: health.ready,
  shopifyAuth: {
    storeConfigured: auth.storeConfigured,
    tokenMode: auth.tokenMode,
    clientIdPresent: auth.clientIdPresent,
    clientSecretPresent: auth.clientSecretPresent,
    accessTokenPresent: auth.accessTokenPresent,
    blockedReason: auth.blockedReason,
  },
  queueSize: queue.length,
  backup: null,
  attempted: [],
  summary: {
    attempted: 0,
    published: 0,
    updatedOrCreated: 0,
    skipped: 0,
    failed: 0,
    verifiedLive: 0,
    logosOrPlaceholdersRejected: 0,
  },
}

if (!health.ready) {
  report.blocked = 'missing-shopify-credentials-or-blog-target'
  report.requiredEnv = [
    'SHOPIFY_STORE_DOMAIN or SHOPIFY_STORE',
    'SHOPIFY_ADMIN_ACCESS_TOKEN or SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET',
    'SHOPIFY_API_VERSION',
    'SHOPIFY_CASE_BLOG_HANDLE=missing-persons or SHOPIFY_CASE_BLOG_ID',
  ]
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`simpleImport blocked=${report.blocked} queue=${queue.length}`)
  process.exitCode = 1
} else {
  const config = scannerConfig()
  const accessToken = await getShopifyAccessToken()
  const missingBlog = await resolveBlog(config, accessToken, 'missing-persons')
  const foundSafeBlog = await resolveBlog(config, accessToken, 'found-safe')
  const missingArticles = missingBlog ? await exportBlogArticles(config, accessToken, missingBlog.id) : []
  const foundSafeArticles = foundSafeBlog ? await exportBlogArticles(config, accessToken, foundSafeBlog.id) : []
  const timestamp = timestampForPath()
  const handles = {
    exportedAt: startedAt,
    missingPersonsCount: missingArticles.length,
    foundSafeCount: foundSafeArticles.length,
    handles: [...missingArticles.map((item) => ({ blog: 'missing-persons', title: item.title, handle: item.handle, published: item.published, sourceUrl: metafieldValue(item, 'source_url') || metafieldValue(item, 'sourceUrl') })), ...foundSafeArticles.map((item) => ({ blog: 'found-safe', title: item.title, handle: item.handle, published: item.published, sourceUrl: metafieldValue(item, 'source_url') || metafieldValue(item, 'sourceUrl') }))],
  }
  const backupPaths = {
    missingPersons: `data/backups/missing-persons-before-simple-import-${timestamp}.json`,
    foundSafe: `data/backups/found-safe-before-simple-import-${timestamp}.json`,
    handles: `data/backups/case-handles-before-simple-import-${timestamp}.json`,
  }
  await writeJson(backupPaths.missingPersons, missingArticles)
  await writeJson(backupPaths.foundSafe, foundSafeArticles)
  await writeJson(backupPaths.handles, handles)
  report.backup = { paths: backupPaths, missingPersonsCount: missingArticles.length, foundSafeCount: foundSafeArticles.length }

  const visibilityAudit = await auditVisibility(missingArticles, foundSafeArticles)
  await writeJson(AUDIT_PATH, visibilityAudit)
  await writeFile(AUDIT_DOC_PATH, visibilityAuditMarkdown(visibilityAudit))

  const existingSourceUrls = new Set(handles.handles.map((item) => normaliseUrl(item.sourceUrl)).filter(Boolean))
  const existingHandles = new Set(handles.handles.map((item) => item.handle).filter(Boolean))

  for (const item of queue) {
    report.summary.attempted += 1
    const result = await processQueueItem(item, { config, existingSourceUrls, existingHandles, publishEnabled })
    report.attempted.push(result)
    if (result.status === 'published' || result.status === 'updated') {
      report.summary.published += 1
      report.summary.updatedOrCreated += 1
    } else if (result.status === 'skipped') {
      report.summary.skipped += 1
    } else if (result.status === 'failed') {
      report.summary.failed += 1
    }
    if (result.liveVerified) report.summary.verifiedLive += 1
    if (result.photo?.rejectedCount) report.summary.logosOrPlaceholdersRejected += result.photo.rejectedCount
    if (result.case?.sourceUrl) existingSourceUrls.add(normaliseUrl(result.case.sourceUrl))
    if (result.case?.slug) existingHandles.add(result.case.slug)
  }

  report.finishedAt = new Date().toISOString()
  await writeJson(REPORT_PATH, report)
  console.log(`simpleImport attempted=${report.summary.attempted} published=${report.summary.published} skipped=${report.summary.skipped} failed=${report.summary.failed} liveVerified=${report.summary.verifiedLive}`)
  if (!report.summary.published && report.summary.failed) process.exitCode = 1
}

async function processQueueItem(item, context) {
  const startedAt = new Date().toISOString()
  const sourceUrl = item.sourceUrl || item.url
  const base = { sourceUrl, expectedName: item.expectedName || '', countryCode: item.countryCode, sourceName: item.sourceName, startedAt }
  try {
    if (!sourceUrl || !item.countryCode) return { ...base, status: 'failed', reason: 'missing-source-url-or-country-code' }
    const fetched = await fetchHtml(sourceUrl)
    if (!fetched.ok) return { ...base, status: 'failed', reason: `source-http-${fetched.status}` }
    const html = fetched.body
    const sourceText = text(html)
    const title = clean(h1(html) || titleTag(html))
    const status = classifyStatus({ title, summary: meta(html, 'description'), bodyText: sourceText })
    if (item.activeOnly !== false && !isPublishableActive(status)) return { ...base, status: 'skipped', reason: `status-${status}-not-active`, sourceStatus: status }
    if (isOffenderOrCrimeProfile(sourceText, title)) return { ...base, status: 'skipped', reason: 'offender-or-general-crime-profile-rejected', sourceStatus: status }

    const extracted = extractPublicFields({ html, sourceText, title, item, status })
    if (!extracted.name) return { ...base, status: 'skipped', reason: 'missing-person-name-after-extraction', sourceStatus: status }
    const photo = await extractCasePhoto(html, sourceUrl, { name: extracted.name, sourceUrl })
    const normalised = normaliseCase({
      ...extracted,
      sourceUrl,
      url: sourceUrl,
      sourceName: item.sourceName,
      countryCode: item.countryCode,
      status,
      imageUrl: photo.url,
      photoUrl: photo.url,
      photoExtractionMethod: photo.method,
      imageStatus: photo.imageStatus,
      imageSourceUrl: photo.url,
      imageConfidence: photo.confidence,
      imageCheckedAt: new Date().toISOString(),
      canShowPhotoWhileActive: Boolean(photo.url && photo.imageStatus === 'official_person_photo'),
      summary: publicSummary(extracted),
      publicDescription: publicDescription(extracted),
      isPublic: true,
    })
    const publicCase = {
      ...toPublicScannerCase(normalised),
      articleTitle: articleTitle(normalised),
      imageStatus: photo.imageStatus,
      imageSourceUrl: photo.url,
      imageConfidence: photo.confidence,
      imageCheckedAt: normalised.imageCheckedAt,
    }
    const existingSourceUrl = context.existingSourceUrls.has(normaliseUrl(sourceUrl))
    if (existingSourceUrl && !context.existingHandles.has(publicCase.slug)) {
      return { ...base, status: 'skipped', reason: 'duplicate-source-url-existing-shopify-article', case: publicCase, photo }
    }
    if (!context.publishEnabled || item.publish === false) {
      return { ...base, status: 'skipped', reason: 'dry-run-or-publish-disabled', case: publicCase, photo }
    }
    const publishResult = await publishCasesToShopify([publicCase])
    if (!publishResult.ok && publishResult.errors.length) {
      return { ...base, status: 'failed', reason: publishResult.errors.map((error) => error.reason).join('; '), case: publicCase, photo, publishResult }
    }
    const published = publishResult.published[0]
    const liveUrl = `https://missingalerts.com/blogs/missing-persons/${published?.handle || publicCase.slug}`
    const live = await verifyLive(liveUrl, publicCase)
    return {
      ...base,
      status: published?.action === 'updated' ? 'updated' : 'published',
      case: publicCase,
      photo,
      liveUrl,
      liveVerified: live.ok,
      live,
      publishResult,
    }
  } catch (error) {
    return { ...base, status: 'failed', reason: error instanceof Error ? error.message : 'import-failed' }
  }
}

function extractPublicFields({ html, sourceText, title, item, status }) {
  const expectedName = clean(item.expectedName)
  const name = expectedName || extractName(title, sourceText)
  const age = item.age || number(sourceText.match(/\b(?:aged|age)\s+(\d{1,3})\b/i)?.[1] || sourceText.match(/\b(\d{1,3})\s*[-–—]\s*year[- ]old\b/i)?.[1])
  const missingSince = item.missingSince || clean(sourceText.match(/\b(?:last seen|missing since|reported missing)(?:[^.\n]{0,100})\b(?:on|since)\s+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+\s+20\d{2})\b/i)?.[2] || '')
  const lastSeenLocationPublic = item.lastSeenLocationPublic || clean(sourceText.match(/\b(?:last seen|was last seen|missing from|reported missing from)\s+(?:in|at|near|on|from)?\s*([^.\n]{6,160})/i)?.[1] || '')
  const city = item.city || clean(sourceText.match(/\b(?:from|in|near)\s+([A-Z][A-Za-z'’. -]{2,45})(?:,|\s+on|\s+since|\s+area|\.)/i)?.[1] || '')
  const region = item.region || ''
  const physicalDescription = clean(sourceText.match(/\b(?:described as|description)\s+([^.\n]{8,260})/i)?.[1] || '')
  const clothing = clean(sourceText.match(/\b(?:wearing|last seen wearing)\s+([^.\n]{8,220})/i)?.[1] || '')
  const contactInstruction = clean(sourceText.match(/\b((?:anyone|if you)\s+(?:with|who has|with any)[^.\n]{20,260})/i)?.[1] || 'Anyone with information should contact the official source or the relevant police force.')
  const sourcePublishedAt = clean(meta(html, 'article:published_time') || html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] || '')
  return { name, age, missingSince, lastSeenLocationPublic, city, region, physicalDescription, clothing, contactInstruction, sourcePublishedAt, status }
}

async function resolveBlog(config, accessToken, handle) {
  const result = await shopifyRequest(config, accessToken, `/blogs.json?handle=${encodeURIComponent(handle)}&limit=1`)
  return result.blogs?.find((blog) => blog.handle === handle) || null
}

async function exportBlogArticles(config, accessToken, blogId) {
  const articles = []
  let next = `/blogs/${blogId}/articles.json?limit=250`
  while (next) {
    const result = await shopifyRequest(config, accessToken, next, { includeHeaders: true })
    const pageArticles = result.json.articles || []
    for (const article of pageArticles) {
      const metafields = await shopifyRequest(config, accessToken, `/articles/${article.id}/metafields.json`).then((payload) => payload.metafields || []).catch(() => [])
      articles.push({
        id: article.id,
        title: article.title,
        handle: article.handle,
        published: article.published,
        tags: article.tags,
        image: article.image ? { src: article.image.src, alt: article.image.alt } : null,
        imageStatus: article.image?.src ? 'has-image' : 'missing-image',
        created_at: article.created_at,
        updated_at: article.updated_at,
        published_at: article.published_at,
        template_suffix: article.template_suffix,
        summary_html: article.summary_html,
        body_html: article.body_html,
        metafields,
      })
    }
    next = nextPagePath(result.headers?.get('link'))
  }
  return articles
}

async function auditVisibility(missingArticles, foundSafeArticles) {
  const homepageHtml = await fetchPublic('https://missingalerts.com/').then((res) => res.body).catch(() => '')
  const blogHtml = await fetchPublic('https://missingalerts.com/blogs/missing-persons').then((res) => res.body).catch(() => '')
  const entries = []
  for (const article of missingArticles) entries.push(await auditArticle(article, 'missing-persons', homepageHtml, blogHtml))
  for (const article of foundSafeArticles) entries.push(await auditArticle(article, 'found-safe', homepageHtml, ''))
  const hidden = entries.filter((entry) => entry.reasonHidden !== 'visible-or-not-expected-on-homepage')
  return {
    auditedAt: new Date().toISOString(),
    missingPersonsCount: missingArticles.length,
    foundSafeCount: foundSafeArticles.length,
    hiddenCount: hidden.length,
    entries,
  }
}

async function auditArticle(article, blog, homepageHtml, blogHtml) {
  const liveUrl = `https://missingalerts.com/blogs/${blog}/${article.handle}`
  const live = await fetchPublic(liveUrl).catch(() => ({ ok: false, status: 0, body: '' }))
  const status = metafieldValue(article, 'case_status') || metafieldValue(article, 'status') || tagStatus(article.tags)
  const country = metafieldValue(article, 'country_code') || metafieldValue(article, 'countryCode') || tagCountry(article.tags)
  const visibleOnBlogListing = blog === 'missing-persons' ? blogHtml.includes(`/blogs/${blog}/${article.handle}`) || blogHtml.includes(article.handle) : false
  const visibleOnHomepage = homepageHtml.includes(`/blogs/${blog}/${article.handle}`) || homepageHtml.includes(article.handle)
  return {
    title: article.title,
    handle: article.handle,
    liveUrl,
    existsInShopify: true,
    liveStatus: live.status,
    liveReturns200: live.ok,
    published: Boolean(article.published || article.published_at),
    blog,
    country,
    status,
    image: Boolean(article.image?.src),
    sourceUrl: metafieldValue(article, 'source_url') || metafieldValue(article, 'sourceUrl'),
    visibleOnBlogListing,
    visibleOnHomepage,
    reasonHidden: hiddenReason({ article, blog, status, visibleOnHomepage, visibleOnBlogListing }),
  }
}

function hiddenReason({ article, blog, status, visibleOnHomepage, visibleOnBlogListing }) {
  if (!(article.published || article.published_at)) return 'unpublished'
  if (blog === 'found-safe' || /found|located|closed|resolved/i.test(status)) return 'resolved-found-safe-not-active-homepage'
  if (!visibleOnBlogListing) return 'missing-from-blog-listing-or-pagination-window'
  if (!visibleOnHomepage) return 'not-in-homepage-query-or-filtered-by-country-status'
  return 'visible-or-not-expected-on-homepage'
}

async function fetchHtml(url) {
  return fetchPublic(url)
}

async function fetchPublic(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15000),
  })
  return { ok: response.ok, status: response.status, body: await response.text() }
}

async function verifyLive(url, record) {
  const response = await fetchPublic(url).catch((error) => ({ ok: false, status: 0, body: String(error?.message || '') }))
  const body = response.body || ''
  return {
    ok: Boolean(response.ok && body.includes(record.name) && body.includes(record.sourceUrl)),
    status: response.status,
    titlePresent: body.includes(record.name),
    sourcePresent: body.includes(record.sourceUrl),
    countryPresent: body.includes(record.countryName || record.countryCode),
    hasImageOrFallback: /<img|missing-person|silhouette|placeholder/i.test(body),
  }
}

async function shopifyRequest(config, accessToken, path, options = {}) {
  const base = `https://${config.shopifyStoreDomain}/admin/api/${config.shopifyApiVersion}`
  const response = await fetch(`${base}${path}`, {
    method: options.method || 'GET',
    headers: {
      'content-type': 'application/json',
      'x-shopify-access-token': accessToken,
      ...(options.headers || {}),
    },
    body: options.body,
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Shopify ${response.status}: ${json.errors ? JSON.stringify(json.errors) : 'request failed'}`)
  if (options.includeHeaders) return { json, headers: response.headers }
  return json
}

function nextPagePath(linkHeader) {
  const next = String(linkHeader || '').split(',').find((part) => /rel="next"/.test(part))
  const url = next?.match(/<([^>]+)>/)?.[1]
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return ''
  }
}

function publicSummary(record) {
  const location = record.lastSeenLocationPublic || [record.city, record.region].filter(Boolean).join(', ') || record.countryCode
  return `${record.name} is currently listed in a public missing-person appeal from ${record.sourceName || 'an official source'}. Missing Alerts uses public source-backed details only. Last known public location: ${location}.`
}

function publicDescription(record) {
  return [
    `${record.name} is currently listed in a public missing-person appeal.`,
    record.lastSeenLocationPublic ? `The public source records the last seen location as ${record.lastSeenLocationPublic}.` : '',
    record.missingSince ? `The public source gives the missing or last-seen date as ${record.missingSince}.` : '',
    record.clothing ? `Public clothing detail: ${record.clothing}.` : '',
    record.physicalDescription ? `Public description: ${record.physicalDescription}.` : '',
    'Anyone with urgent information should contact police or the official source first.',
  ].filter(Boolean).join(' ')
}

function articleTitle(record) {
  const age = record.age ? `, ${record.age}` : ''
  const location = record.lastSeenLocationPublic || [record.city, record.region, record.countryName].filter(Boolean).join(', ')
  return location ? `${record.name}${age} - ${location}` : `${record.name}${age}`
}

function visibilityAuditMarkdown(audit) {
  const lines = [
    '# Simple Case Visibility Audit',
    '',
    `Audited at: ${audit.auditedAt}`,
    `Missing-persons articles: ${audit.missingPersonsCount}`,
    `Found-safe articles: ${audit.foundSafeCount}`,
    `Hidden or not surfaced count: ${audit.hiddenCount}`,
    '',
    '| Title | Blog | Published | Live | Homepage | Blog listing | Reason |',
    '|---|---:|---:|---:|---:|---:|---|',
  ]
  for (const item of audit.entries) {
    lines.push(`| ${escapeMd(item.title)} | ${item.blog} | ${item.published ? 'yes' : 'no'} | ${item.liveReturns200 ? '200' : item.liveStatus} | ${item.visibleOnHomepage ? 'yes' : 'no'} | ${item.visibleOnBlogListing ? 'yes' : 'no'} | ${escapeMd(item.reasonHidden)} |`)
  }
  return `${lines.join('\n')}\n`
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return match(html, new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')) ||
    match(html, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'))
}

function titleTag(html) {
  return match(html, /<title[^>]*>([\s\S]*?)<\/title>/i)
}

function h1(html) {
  return match(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
}

function extractName(title, body) {
  const source = `${title}. ${body}`
  return clean(source.match(/\b(?:appeal(?:\s+to\s+find|\s+for)?|missing person appeal(?:\s+for)?|have you seen|help trace|trace)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,4})\b/i)?.[1] ||
    source.match(/\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,4}),?\s+(?:aged|age)\s+\d{1,3}\b/i)?.[1] ||
    source.match(/\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,4})\s+(?:is|was|has been)\s+(?:reported\s+)?missing\b/i)?.[1] || '')
}

function isOffenderOrCrimeProfile(body, title) {
  const value = `${title} ${body}`.toLowerCase()
  if (!/\bmissing|last seen|have you seen|appeal to find|reported missing\b/i.test(value)) return true
  return /\b(sex offender|registered offender|wanted for|convicted|sentenced|jailed|mugshot|court appearance|charged with)\b/i.test(value)
}

function tagStatus(tags = '') {
  return String(tags).split(',').map((tag) => tag.trim()).find((tag) => /^status:/i.test(tag))?.replace(/^status:/i, '') || ''
}

function tagCountry(tags = '') {
  return String(tags).split(',').map((tag) => tag.trim()).find((tag) => /^country-code:/i.test(tag))?.replace(/^country-code:/i, '') || ''
}

function metafieldValue(article, key) {
  const field = (article.metafields || []).find((item) => item.key === key)
  return field?.value || ''
}

function normaliseUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function clean(value) {
  return text(value)
}

function text(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function match(value, regex) {
  return String(value || '').match(regex)?.[1] || ''
}

function timestampForPath() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function escapeMd(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
