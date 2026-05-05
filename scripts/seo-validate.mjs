import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const countryProfiles = JSON.parse(await readFile('data/country-profiles.json', 'utf8'))
const requiredSlugs = ['united-kingdom', 'ireland', 'australia', 'new-zealand', 'united-states', 'canada']
for (const slug of requiredSlugs) {
  const profile = countryProfiles.find((item) => item.countrySlug === slug)
  assert(profile, `country profile exists for ${slug}`)
  assert(profile.shouldIndex === true, `${slug} is indexable`)
  assert(profile.officialMissingPersonsUrl || profile.officialPoliceUrl, `${slug} has official link`)
  assert(profile.seoTitle && profile.seoDescription, `${slug} has SEO metadata`)
  assert(profile.reportingGuidance && profile.sharingGuidance, `${slug} has unique guidance`)
}

const robots = await readFile('shopify-theme/templates/robots.txt.liquid', 'utf8')
assert(!robots.includes('seo.missingalerts.com'), 'robots does not advertise external SEO sitemap')
assert(!robots.includes('Sitemap: https://missingalerts.com/cdn/shop/t/5/assets/location-sitemap.xml'), 'robots does not advertise CDN location sitemap')
assert(robots.includes('Disallow: /cdn/shop/t/*/assets/location-sitemap'), 'robots blocks generated location sitemap assets')

const header = await readFile('shopify-theme/sections/header.liquid', 'utf8')
assert(header.includes('/pages/country-intelligence'), 'Tools menu links to live Country Intelligence page')
assert(header.includes('FindTrax'), 'Tools menu still contains FindTrax product link')
assert(header.includes('IntelPro'), 'Tools menu still contains IntelPro product link')
assert(header.includes('MediaReach'), 'Tools menu still contains MediaReach product link')

const advice = await readFile('shopify-theme/sections/seo-advice-blog-grid.liquid', 'utf8')
assert(!advice.includes('href="#"'), 'Advice Hub does not contain blank # links')
assert(!advice.includes('href=""'), 'Advice Hub does not contain empty links')
assert(advice.includes('Official reporting links'), 'Advice Hub includes official reporting links')
assert(advice.includes('Country Intelligence'), 'Advice Hub links Country Intelligence')
assert(advice.includes('Urgent information goes to police first'), 'Advice Hub includes urgent safety note')

const countrySearchTemplate = await readFile('shopify-theme/templates/page.country-search.json', 'utf8')
assert(countrySearchTemplate.includes('country-search-page'), 'Country Search template uses country-search-page section')
const countryIntelligenceTemplate = await readFile('shopify-theme/templates/page.country-intelligence.json', 'utf8')
assert(countryIntelligenceTemplate.includes('country-search-page'), 'Country Intelligence template uses country-search-page section')

const countrySearchSection = await readFile('shopify-theme/sections/country-search-page.liquid', 'utf8')
for (const slug of requiredSlugs) {
  assert(countrySearchSection.includes(`/pages/missing-people-${slug}`), `Country Search links ${slug}`)
}
assert(countrySearchSection.includes('/pages/missing-people-england'), 'Country Search links England page')
assert(countrySearchSection.includes('Global Location Checker'), 'Country Intelligence includes Global Location Checker')
assert(!countrySearchSection.includes('FindTrax'), 'Country Search does not leak FindTrax branding')
const topLocations = await readFile('shopify-theme/sections/top-missing-locations.liquid', 'utf8')
assert(topLocations.includes('/pages/country-intelligence#global-location-checker'), 'Top Missing Locations is merged into Global Location Checker')

const seoAudit = JSON.parse(await readFile('data/seo-page-audit.json', 'utf8'))
assert(seoAudit.summary.generatedSitemapAssetUrlCount > 1000, 'SEO audit records mass generated sitemap URL inventory')
assert(Array.isArray(seoAudit.pages), 'SEO audit contains page records')
const patternAudit = JSON.parse(await readFile('data/url-pattern-audit.json', 'utf8'))
assert(patternAudit.summary.estimatedUrlCountAffected >= seoAudit.summary.generatedSitemapAssetUrlCount, 'pattern audit covers generated URL inventory')
const canonicalMap = JSON.parse(await readFile('data/canonical-map.json', 'utf8'))
assert(canonicalMap.entries.some((entry) => entry.url.includes('/pages/country-search') && entry.canonicalTarget.endsWith('/pages/country-intelligence')), 'Country Search canonical points to Country Intelligence')
assert(canonicalMap.entries.some((entry) => entry.url.includes('/pages/top-missing-locations') && entry.canonicalTarget.endsWith('/pages/country-intelligence')), 'Top Missing Locations canonical points to Country Intelligence')
const noindexPatterns = JSON.parse(await readFile('data/noindex-patterns.json', 'utf8'))
assert(noindexPatterns.patterns.some((pattern) => pattern.patternName.includes('generated-location')), 'generated location pages are noindex/disallow classified')
const locationDirectory = JSON.parse(await readFile('data/location-directory.json', 'utf8'))
assert(locationDirectory.locations.some((item) => item.locationSlug === 'united-kingdom/scotland/glasgow' && item.shouldIndex === true), 'location directory has a quality-gated indexable Glasgow record')

console.log('SEO validation passed')
