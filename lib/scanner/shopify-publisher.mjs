import { scannerConfig } from './scanner-config.mjs'
import { getShopifyAccessToken, getShopifyAuthStatus } from './shopify-token-manager.mjs'

export function shopifyHealth() {
  const config = scannerConfig()
  const auth = getShopifyAuthStatus()
  return {
    ready: Boolean(config.shopifyStoreDomain && auth.tokenMode !== 'missing' && (config.shopifyCaseBlogId || config.shopifyCaseBlogHandle)),
    storeConfigured: Boolean(config.shopifyStoreDomain),
    tokenConfigured: auth.accessTokenPresent,
    tokenMode: auth.tokenMode,
    tokenRefreshable: auth.refreshable,
    tokenExpiredOrExpiring: auth.expiredOrExpiring,
    tokenBlockedReason: auth.blockedReason,
    blogTargetConfigured: Boolean(config.shopifyCaseBlogId || config.shopifyCaseBlogHandle),
    apiVersion: config.shopifyApiVersion,
    target: config.shopifyCaseBlogId ? 'blog-id' : 'blog-handle',
  }
}

export function articlePayload(record) {
  const tags = Array.from(new Set([...(record.tags || []), 'scanner-imported', record.status, `status:${record.status}`, record.countryCode, record.countrySlug, record.locationSlug].filter(Boolean)))
  const payload = {
    title: record.articleTitle || articleTitle(record),
    handle: record.slug,
    summary_html: escapeHtml(record.shortSummary),
    body_html: caseBodyHtml(record),
    tags: tags.join(', '),
    published: ['active', 'urgent', 'long-term'].includes(record.status),
  }
  if (record.photoUrl) payload.image = { src: record.photoUrl, alt: record.name }
  return payload
}

export async function publishCasesToShopify(records, options = {}) {
  const config = scannerConfig()
  const health = shopifyHealth()
  if (!health.ready) {
    return {
      ok: false,
      published: [],
      errors: [{ reason: 'missing-shopify-credentials-or-blog-target', health }],
    }
  }
  const accessToken = await getShopifyAccessToken()
  const blogId = config.shopifyCaseBlogId || await resolveBlogId(config, accessToken, config.shopifyCaseBlogHandle)
  const published = []
  const errors = []
  for (const record of records) {
    if (!['active', 'urgent', 'long-term'].includes(record.status)) {
      errors.push({ sourceUrl: record.sourceUrl, reason: `status-${record.status}-not-publishable` })
      continue
    }
    if (options.dryRun) {
      published.push({ sourceUrl: record.sourceUrl, dryRun: true, payload: articlePayload(record) })
      continue
    }
    try {
      const payload = articlePayload(record)
      const existing = await findArticleByHandle(config, accessToken, blogId, payload.handle)
      const result = existing
        ? await shopifyRequest(config, accessToken, `/blogs/${blogId}/articles/${existing.id}.json`, {
            method: 'PUT',
            body: JSON.stringify({ article: { ...payload, id: existing.id } }),
          })
        : await shopifyRequest(config, accessToken, `/blogs/${blogId}/articles.json`, {
            method: 'POST',
            body: JSON.stringify({ article: payload }),
          })
      if (result.article?.id) await setArticleMetafields(config, accessToken, result.article.id, record)
      published.push({ sourceUrl: record.sourceUrl, articleId: result.article?.id, handle: result.article?.handle, action: existing ? 'updated' : 'created' })
    } catch (error) {
      errors.push({ sourceUrl: record.sourceUrl, reason: error.message })
    }
  }
  return { ok: errors.length === 0, published, errors }
}

async function setArticleMetafields(config, accessToken, articleId, record) {
  const ownerId = `gid://shopify/Article/${articleId}`
  const metafields = articleMetafields(record).map((field) => ({ ...field, ownerId, namespace: 'custom' }))
  if (!metafields.length) return null
  const saved = []
  for (let index = 0; index < metafields.length; index += 25) {
    const batch = metafields.slice(index, index + 25)
    const result = await shopifyGraphql(config, accessToken, `
      mutation ScannerMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key namespace }
          userErrors { field message code }
        }
      }
    `, { metafields: batch })
    const errors = result.data?.metafieldsSet?.userErrors || []
    if (errors.length) throw new Error(`Shopify metafieldsSet: ${JSON.stringify(errors)}`)
    saved.push(...(result.data?.metafieldsSet?.metafields || []))
  }
  return saved
}

function articleMetafields(record) {
  const textFields = {
    case_status: record.status,
    public_status: record.status,
    status: record.status,
    source_name: record.sourceName,
    source_url: record.sourceUrl,
    source_published_at: record.sourcePublishedAt,
    imported_at: record.importedAt,
    last_checked_at: record.lastCheckedAt,
    country: record.countryName,
    country_name: record.countryName,
    country_code: record.countryCode,
    country_slug: record.countrySlug,
    region: record.region,
    state_region: record.region,
    city: record.city,
    city_town: record.city,
    display_location: record.lastSeenLocationPublic,
    last_seen_place: record.lastSeenLocationPublic,
    last_seen_area: record.lastSeenLocationPublic,
    last_seen_location: record.lastSeenLocationPublic,
    last_seen_at: record.missingSince,
    location_slug: record.locationSlug,
    location_slug_path: locationSlugPath(record),
    location_search_text: [record.name, record.city, record.region, record.countryName, record.lastSeenLocationPublic].filter(Boolean).join(' '),
    photo_visibility: record.photoVisibility,
    public_photo_url: record.photoUrl,
    source_image_url: record.photoUrl,
    image_status: record.imageStatus || (record.photoUrl ? 'official_person_photo' : 'fallback_silhouette'),
    image_source_url: record.imageSourceUrl || record.photoUrl,
    image_extraction_method: record.photoExtractionMethod,
    image_confidence: record.imageConfidence,
    image_checked_at: record.imageCheckedAt,
    photo_extraction_method: record.photoExtractionMethod,
    gender: record.gender,
    physical_description: record.physicalDescription,
    clothing: record.clothing,
    travel_context: record.travelContext,
    contact_instruction: record.contactInstruction,
    scanner_imported: 'true',
  }
  const fields = []
  for (const [key, value] of Object.entries(textFields)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') fields.push({ key, type: 'single_line_text_field', value: String(value) })
  }
  if (record.age !== undefined && record.age !== null && record.age !== '') fields.push({ key: 'age', type: 'number_integer', value: String(record.age) })
  if (record.publicLatitude !== undefined && record.publicLatitude !== null) {
    const latitude = String(record.publicLatitude)
    fields.push({ key: 'location_lat', type: 'number_decimal', value: latitude })
    fields.push({ key: 'public_latitude', type: 'number_decimal', value: latitude })
    fields.push({ key: 'last_seen_lat', type: 'number_decimal', value: latitude })
  }
  if (record.publicLongitude !== undefined && record.publicLongitude !== null) {
    const longitude = String(record.publicLongitude)
    fields.push({ key: 'location_lng', type: 'number_decimal', value: longitude })
    fields.push({ key: 'public_longitude', type: 'number_decimal', value: longitude })
    fields.push({ key: 'last_seen_lng', type: 'number_decimal', value: longitude })
  }
  return fields
}

function articleTitle(record) {
  const name = String(record.name || 'Missing person appeal').trim()
  const age = record.age ? `, ${record.age}` : ''
  const location = [record.city, record.region, record.countryName].filter(Boolean).join(', ')
  return location ? `${name}${age} - ${location}` : `${name}${age}`
}

function locationSlugPath(record) {
  const parts = [record.countrySlug, record.region && slugifyLocal(record.region), record.city && slugifyLocal(record.city)].filter(Boolean)
  return parts.length ? `/missing-people/${parts.join('/')}` : ''
}

function slugifyLocal(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function resolveBlogId(config, accessToken, handle) {
  const result = await shopifyRequest(config, accessToken, `/blogs.json?handle=${encodeURIComponent(handle)}`)
  const blog = result.blogs?.find((item) => item.handle === handle)
  if (!blog) throw new Error(`Shopify blog handle not found: ${handle}`)
  return blog.id
}

async function findArticleByHandle(config, accessToken, blogId, handle) {
  const result = await shopifyRequest(config, accessToken, `/blogs/${blogId}/articles.json?handle=${encodeURIComponent(handle)}&limit=1`)
  return result.articles?.find((item) => item.handle === handle) || null
}

async function shopifyRequest(config, accessToken, path, init = {}) {
  const base = `https://${config.shopifyStoreDomain}/admin/api/${config.shopifyApiVersion}`
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-shopify-access-token': accessToken,
      ...(init.headers || {}),
    },
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Shopify ${response.status}: ${json.errors ? JSON.stringify(json.errors) : 'request failed'}`)
  return json
}

async function shopifyGraphql(config, accessToken, query, variables = {}) {
  const base = `https://${config.shopifyStoreDomain}/admin/api/${config.shopifyApiVersion}`
  const response = await fetch(`${base}/graphql.json`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-shopify-access-token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json.errors) throw new Error(`Shopify GraphQL ${response.status}: ${json.errors ? JSON.stringify(json.errors) : 'request failed'}`)
  return json
}

function caseBodyHtml(record) {
  return [
    '<div class="missing-alerts-scanner-case">',
    `<p><strong>Status:</strong> ${escapeHtml(record.status)}</p>`,
    `<p><strong>Country:</strong> ${escapeHtml(record.countryName)}</p>`,
    record.region || record.city ? `<p><strong>Location:</strong> ${escapeHtml([record.city, record.region].filter(Boolean).join(', '))}</p>` : '',
    record.missingSince ? `<p><strong>Missing since:</strong> ${escapeHtml(record.missingSince)}</p>` : '',
    record.lastSeenLocationPublic ? `<p><strong>Last seen:</strong> ${escapeHtml(record.lastSeenLocationPublic)}</p>` : '',
    record.age ? `<p><strong>Age:</strong> ${escapeHtml(record.age)}</p>` : '',
    record.physicalDescription ? `<p><strong>Description:</strong> ${escapeHtml(record.physicalDescription)}</p>` : '',
    record.clothing ? `<p><strong>Clothing:</strong> ${escapeHtml(record.clothing)}</p>` : '',
    record.travelContext ? `<p><strong>Travel context:</strong> ${escapeHtml(record.travelContext)}</p>` : '',
    `<p>${escapeHtml(record.publicDescription || record.shortSummary)}</p>`,
    record.contactInstruction ? `<p><strong>Official contact:</strong> ${escapeHtml(record.contactInstruction)}</p>` : '',
    `<p><strong>Source:</strong> <a href="${escapeAttr(record.sourceUrl)}" rel="nofollow noopener" target="_blank">${escapeHtml(record.sourceName)}</a></p>`,
    '<p>This page uses public source information only.</p>',
    '</div>',
  ].filter(Boolean).join('\n')
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;')
}
