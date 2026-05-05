import { existsSync, readFileSync } from 'node:fs'

const envFiles = ['.env', '.env.local', '.env.production']

export function loadLocalEnv() {
  for (const file of envFiles) {
    if (!existsSync(file)) continue
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const index = trimmed.indexOf('=')
      const key = trimmed.slice(0, index).trim()
      let value = trimmed.slice(index + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined && value !== '') process.env[key] = value
    }
  }
}

export function scannerConfig() {
  loadLocalEnv()
  return {
    shopifyStoreDomain: process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE || '',
    shopifyAdminAccessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_TOKEN || '',
    shopifyApiVersion: process.env.SHOPIFY_API_VERSION || '2026-04',
    shopifyCaseBlogHandle: process.env.SHOPIFY_CASE_BLOG_HANDLE || 'missing-persons',
    shopifyCaseBlogId: process.env.SHOPIFY_CASE_BLOG_ID || '',
    scannerAdminSecret: process.env.SCANNER_ADMIN_SECRET || '',
    geocodingApiKey: process.env.GEOCODING_API_KEY || process.env.MAPBOX_TOKEN || process.env.GOOGLE_MAPS_API_KEY || '',
  }
}

export function credentialPresence() {
  const config = scannerConfig()
  return {
    SHOPIFY_STORE_DOMAIN: Boolean(config.shopifyStoreDomain),
    SHOPIFY_ADMIN_ACCESS_TOKEN: Boolean(config.shopifyAdminAccessToken),
    SHOPIFY_API_VERSION: Boolean(config.shopifyApiVersion),
    SHOPIFY_CASE_BLOG_HANDLE: Boolean(config.shopifyCaseBlogHandle),
    SHOPIFY_CASE_BLOG_ID: Boolean(config.shopifyCaseBlogId),
    SCANNER_ADMIN_SECRET: Boolean(config.scannerAdminSecret),
    GEOCODING_API_KEY: Boolean(config.geocodingApiKey),
  }
}
