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
  const tags = Array.from(new Set([...(record.tags || []), 'scanner-imported', record.status, record.countryCode, record.countrySlug, record.locationSlug].filter(Boolean)))
  return {
    title: record.name,
    handle: record.slug,
    summary_html: escapeHtml(record.shortSummary),
    body_html: caseBodyHtml(record),
    tags: tags.join(', '),
    published: ['active', 'urgent', 'long-term'].includes(record.status),
  }
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
      published.push({ sourceUrl: record.sourceUrl, articleId: result.article?.id, handle: result.article?.handle, action: existing ? 'updated' : 'created' })
    } catch (error) {
      errors.push({ sourceUrl: record.sourceUrl, reason: error.message })
    }
  }
  return { ok: errors.length === 0, published, errors }
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

function caseBodyHtml(record) {
  return [
    '<div class="missing-alerts-scanner-case">',
    `<p><strong>Status:</strong> ${escapeHtml(record.status)}</p>`,
    `<p><strong>Country:</strong> ${escapeHtml(record.countryName)}</p>`,
    record.region || record.city ? `<p><strong>Location:</strong> ${escapeHtml([record.city, record.region].filter(Boolean).join(', '))}</p>` : '',
    record.missingSince ? `<p><strong>Missing since:</strong> ${escapeHtml(record.missingSince)}</p>` : '',
    record.lastSeenLocationPublic ? `<p><strong>Last seen:</strong> ${escapeHtml(record.lastSeenLocationPublic)}</p>` : '',
    `<p>${escapeHtml(record.publicDescription || record.shortSummary)}</p>`,
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
