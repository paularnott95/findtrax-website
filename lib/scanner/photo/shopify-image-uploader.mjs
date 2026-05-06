import { articlePayload, publishCasesToShopify, shopifyHealth } from '../shopify-publisher.mjs'

export function shopifyImageUploadHealth() {
  return shopifyHealth()
}

export function buildShopifyImagePayload(record) {
  return articlePayload(record).image || null
}

export async function uploadCaseImageViaArticleUpdate(record, options = {}) {
  if (!record?.photoUrl) return { ok: false, reason: 'missing-photo-url' }
  const health = shopifyHealth()
  if (!health.ready) return { ok: false, reason: 'missing-shopify-credentials-or-blog-target', health }
  return publishCasesToShopify([record], options)
}
