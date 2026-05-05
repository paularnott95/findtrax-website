import { scannerConfig } from './scanner-config.mjs'

const REFRESH_MARGIN_MS = 5 * 60 * 1000

export function getShopifyAuthStatus() {
  const config = scannerConfig()
  const tokenMode = detectTokenMode(config)
  const expiresAt = parseExpiry(config.shopifyAccessTokenExpiresAt)
  const expired = expiresAt ? Date.now() >= expiresAt.getTime() - REFRESH_MARGIN_MS : false
  return {
    tokenMode,
    storeConfigured: Boolean(config.shopifyStoreDomain),
    accessTokenPresent: Boolean(config.shopifyAdminAccessToken),
    refreshTokenPresent: Boolean(config.shopifyRefreshToken),
    clientIdPresent: Boolean(config.shopifyClientId),
    clientSecretPresent: Boolean(config.shopifyClientSecret),
    expiresAtConfigured: Boolean(config.shopifyAccessTokenExpiresAt),
    expiredOrExpiring: expired,
    refreshable: tokenMode === 'oauth_refresh_token' || tokenMode === 'client_credentials',
    persistenceConfigured: Boolean(config.shopifyTokenPersistence),
    blockedReason: blockedReason(config, tokenMode),
  }
}

export async function getShopifyAccessToken() {
  const config = scannerConfig()
  const status = getShopifyAuthStatus()
  if (status.tokenMode === 'missing') {
    throw new Error(status.blockedReason || 'missing-shopify-token')
  }
  if (status.tokenMode === 'static_admin_token') return config.shopifyAdminAccessToken
  const refreshed = await refreshShopifyAccessTokenIfNeeded()
  if (refreshed.accessToken) return refreshed.accessToken
  if (config.shopifyAdminAccessToken) return config.shopifyAdminAccessToken
  throw new Error(refreshed.blockedReason || 'shopify-token-refresh-failed')
}

export async function refreshShopifyAccessTokenIfNeeded() {
  const config = scannerConfig()
  const status = getShopifyAuthStatus()
  if (status.tokenMode === 'static_admin_token') {
    return { refreshed: false, accessToken: config.shopifyAdminAccessToken, status }
  }
  if (!status.refreshable) {
    return { refreshed: false, accessToken: '', status, blockedReason: status.blockedReason }
  }
  if (config.shopifyAdminAccessToken && !status.expiredOrExpiring) {
    return { refreshed: false, accessToken: config.shopifyAdminAccessToken, status }
  }
  if (status.tokenMode === 'oauth_refresh_token') return refreshWithRefreshToken(config)
  if (status.tokenMode === 'client_credentials') return refreshWithClientCredentials(config)
  return { refreshed: false, accessToken: '', status, blockedReason: status.blockedReason }
}

async function refreshWithRefreshToken(config) {
  const response = await fetch(`https://${config.shopifyStoreDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: config.shopifyClientId,
      client_secret: config.shopifyClientSecret,
      refresh_token: config.shopifyRefreshToken,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) {
    return { refreshed: false, accessToken: '', status: getShopifyAuthStatus(), blockedReason: `shopify-token-refresh-${response.status}` }
  }
  return tokenRefreshResult(payload)
}

async function refreshWithClientCredentials(config) {
  const response = await fetch(`https://${config.shopifyStoreDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: config.shopifyClientId,
      client_secret: config.shopifyClientSecret,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload.access_token) {
    return { refreshed: false, accessToken: '', status: getShopifyAuthStatus(), blockedReason: `shopify-client-credentials-${response.status}` }
  }
  return tokenRefreshResult(payload)
}

function tokenRefreshResult(payload) {
  const config = scannerConfig()
  const persistenceRequired = Boolean(payload.refresh_token && payload.refresh_token !== config.shopifyRefreshToken)
  return {
    refreshed: true,
    accessToken: payload.access_token,
    expiresIn: payload.expires_in || null,
    refreshTokenRotated: persistenceRequired,
    persistenceConfigured: Boolean(config.shopifyTokenPersistence),
    persistenceWarning: persistenceRequired && !config.shopifyTokenPersistence
      ? 'Shopify returned a rotated refresh token, but no writable secret persistence is configured. Store the new token in a secret manager before the next run.'
      : '',
  }
}

function detectTokenMode(config) {
  if (config.shopifyAdminAccessToken && !config.shopifyRefreshToken) return 'static_admin_token'
  if (config.shopifyRefreshToken && config.shopifyClientId && config.shopifyClientSecret) return 'oauth_refresh_token'
  if (!config.shopifyAdminAccessToken && config.shopifyClientId && config.shopifyClientSecret) return 'client_credentials'
  return 'missing'
}

function blockedReason(config, tokenMode) {
  if (!config.shopifyStoreDomain) return 'missing-shopify-store-domain'
  if (tokenMode !== 'missing') return ''
  if (config.shopifyRefreshToken && (!config.shopifyClientId || !config.shopifyClientSecret)) return 'refresh-token-present-without-client-credentials'
  if ((config.shopifyClientId || config.shopifyClientSecret) && !(config.shopifyClientId && config.shopifyClientSecret)) return 'incomplete-shopify-client-credentials'
  return 'missing-shopify-admin-token-or-refresh-credentials'
}

function parseExpiry(value) {
  if (!value) return null
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return new Date(numeric < 10000000000 ? numeric * 1000 : numeric)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
