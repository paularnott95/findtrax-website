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
assert(header.includes('/pages/missing-person-advice#browse-by-country'), 'Tools menu links to live Country Search area')
assert(header.includes('FindTrax'), 'Tools menu still contains FindTrax product link')
assert(header.includes('IntelPro'), 'Tools menu still contains IntelPro product link')
assert(header.includes('MediaReach'), 'Tools menu still contains MediaReach product link')

const advice = await readFile('shopify-theme/sections/seo-advice-blog-grid.liquid', 'utf8')
assert(!advice.includes('href="#"'), 'Advice Hub does not contain blank # links')
assert(!advice.includes('href=""'), 'Advice Hub does not contain empty links')
assert(advice.includes('Official reporting links'), 'Advice Hub includes official reporting links')
assert(advice.includes('Country Search'), 'Advice Hub links Country Search')
assert(advice.includes('Urgent information goes to police first'), 'Advice Hub includes urgent safety note')

const countrySearchTemplate = await readFile('shopify-theme/templates/page.country-search.json', 'utf8')
assert(countrySearchTemplate.includes('country-search-page'), 'Country Search template uses country-search-page section')

const countrySearchSection = await readFile('shopify-theme/sections/country-search-page.liquid', 'utf8')
for (const slug of requiredSlugs) {
  assert(countrySearchSection.includes(`country=${slug}`), `Country Search links ${slug}`)
}
assert(!countrySearchSection.includes('FindTrax'), 'Country Search does not leak FindTrax branding')

const seoAudit = JSON.parse(await readFile('data/seo-page-audit.json', 'utf8'))
assert(seoAudit.summary.generatedSitemapAssetUrlCount > 1000, 'SEO audit records mass generated sitemap URL inventory')
assert(Array.isArray(seoAudit.pages), 'SEO audit contains page records')

console.log('SEO validation passed')
