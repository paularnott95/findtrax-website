export function classifyUrlPattern(url = '') {
  const path = safePath(url)
  if (path === '/') return pattern('homepage', 'templates/index.json', 'keep/enrich/index')
  if (path === '/pages/country-intelligence') return pattern('country-intelligence', 'templates/page.country-intelligence.json', 'keep/enrich/index')
  if (path === '/pages/country-search') return pattern('legacy-country-search', 'templates/page.country-search.json', 'canonicalize-to-country-intelligence')
  if (path === '/pages/missing-person-advice') return pattern('advice-hub', 'templates/page.missing-person-advice.json', 'keep/enrich/index')
  if (path.includes('/blogs/missing-persons/')) return pattern('case-article', 'Shopify blog article', 'keep/index-if-public-active')
  if (path.includes('/blogs/found-safe')) return pattern('found-safe', 'Shopify blog/article', 'keep/index-if-privacy-safe')
  if (path.includes('/blogs/missing-person-advice/')) return pattern('advice-article', 'Shopify advice blog article', 'rewrite-or-canonicalize')
  if (path.includes('/blogs/') && path.includes('/tagged/')) return pattern('tagged-blog-filter', 'Shopify tag archive', 'noindex/canonicalize')
  if (path.includes('/pages/missing-people-country')) return pattern('country-query-page', 'country profile template', 'index-only-complete-profiles')
  if (/\/pages\/missing-people-(england|united-kingdom|ireland|australia|new-zealand|united-states|canada|singapore|south-africa)$/.test(path)) {
    return pattern('country-page', 'country profile template', 'index-only-complete-profiles')
  }
  if (/\/pages\/(missing-people-location|missing-alerts-near-me|missing-cases-near|no-active-missing-cases|missing-people-near-me|recent-missing-cases|help-find-missing)/.test(path)) {
    return pattern('generated-location-or-nearby-page', 'generated location/search template', 'noindex-until-real-local-data')
  }
  if (/\/cdn\/shop\/t\/\d+\/assets\/.*sitemap.*\.xml/.test(path)) {
    return pattern('generated-cdn-sitemap-asset', 'theme asset XML', 'remove-from-sitemap-and-disallow')
  }
  if (path.includes('/pages/tools') || path.includes('/pages/findtrax') || path.includes('/pages/intelpro') || path.includes('/pages/mediareach')) {
    return pattern('tools-product-page', 'Shopify tools page', 'keep/index')
  }
  if (path.includes('/pages/')) return pattern('shopify-page', 'Shopify page', 'quality-gate')
  if (path.includes('/blogs/')) return pattern('blog-archive', 'Shopify blog', 'quality-gate')
  return pattern('unknown', 'unknown', 'manual-review')
}

function pattern(name, template, action) {
  return { patternName: name, template, patternAction: action }
}

function safePath(url) {
  try {
    return new URL(url, 'https://missingalerts.com').pathname
  } catch {
    return String(url || '')
  }
}

