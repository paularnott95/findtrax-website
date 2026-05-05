import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { getBoostedCases } from '../lib/missing-alerts-boosts.mjs'
import { countrySlugFromCode } from '../lib/missing-alerts-country-map.mjs'
import { getPublicCaseImage } from '../lib/missing-alerts-photo-policy.mjs'
import { canListAsActive, toPublicCase } from '../lib/missing-alerts-public-case-mapper.mjs'
import { scanFixtureCases, scannerHealthcheck } from '../lib/missing-alerts-scanner.mjs'
import { assignLocation } from '../lib/scanner/assign-location.mjs'
import { classifyStatus } from '../lib/scanner/classify-status.mjs'
import { dedupeCases } from '../lib/scanner/dedupe-cases.mjs'
import { normaliseCase } from '../lib/scanner/normalise-case.mjs'
import { parseHtmlCase } from '../lib/scanner/parse-source.mjs'
import { toPublicScannerCase } from '../lib/scanner/public-case-mapper.mjs'
import { articlePayload, shopifyHealth } from '../lib/scanner/shopify-publisher.mjs'
import { getShopifyAuthStatus } from '../lib/scanner/shopify-token-manager.mjs'
import toolAlertSignupHandler from '../api/tool-alert-signups.js'

const cases = JSON.parse(await readFile('data/missing-alerts-public-cases.json', 'utf8'))

assert.equal(countrySlugFromCode('GB'), 'united-kingdom')
assert.equal(countrySlugFromCode('UK'), 'united-kingdom')
assert.equal(countrySlugFromCode('IE'), 'ireland')
assert.equal(countrySlugFromCode('AU'), 'australia')
assert.equal(countrySlugFromCode('NZ'), 'new-zealand')
assert.equal(countrySlugFromCode('US'), 'united-states')
assert.equal(countrySlugFromCode('CA'), 'canada')

const activeWithPhoto = { isPublic: true, status: 'active', name: 'Active', photoUrl: 'https://example.com/a.jpg', canShowPhotoWhileActive: true }
assert.equal(getPublicCaseImage(activeWithPhoto).type, 'image')
assert.equal(getPublicCaseImage({ ...activeWithPhoto, status: 'found-safe', isMinor: false, consentToDisplayAfterResolved: false }).type, 'placeholder')
assert.equal(getPublicCaseImage({ ...activeWithPhoto, status: 'located' }).type, 'placeholder')
assert.equal(getPublicCaseImage({ ...activeWithPhoto, status: 'closed' }).type, 'placeholder')
assert.equal(getPublicCaseImage({ ...activeWithPhoto, status: 'found-safe', isMinor: true }).type, 'placeholder')

assert(cases.filter(canListAsActive).every((item) => !['found-safe', 'located', 'closed'].includes(item.status)))
const boosted = getBoostedCases(cases, new Date('2026-05-05T08:00:00.000Z'))
assert(boosted.length > 0)
assert.equal(boosted[0].name, 'John Morgan')
assert(!boosted.some((item) => item.status === 'found-safe' || item.status === 'closed'))
assert(!boosted.some((item) => item.name === 'Inna'))

const mapped = toPublicCase({ ...cases[0], internalNotes: 'secret', privatePhone: 'secret' })
assert(!('internalNotes' in mapped))
assert(!('privatePhone' in mapped))

const fixtures = JSON.parse(await readFile('data/scanner-source-fixtures.json', 'utf8'))
const scan = scanFixtureCases(fixtures)
assert.equal(scan.imported.length, 1)
assert.equal(scan.imported[0].countrySlug, 'united-kingdom')
assert(scan.skipped.some((item) => item.reason === 'duplicate'))
assert(scan.skipped.some((item) => item.reason.includes('found-safe')))

const sources = JSON.parse(await readFile('data/scanner-sources.json', 'utf8'))
for (const countryCode of ['GB', 'IE', 'AU', 'NZ', 'US', 'CA']) {
assert(sources.some((source) => source.countryCode === countryCode), `source configured for ${countryCode}`)
}
assert(sources.some((source) => source.enabled === true && source.sourceName === 'Police Scotland'), 'one verified official source is enabled')

const htmlParsed = parseHtmlCase('<html><head><title>Missing Person Appeal - Test Person</title><meta name="description" content="Police are appealing for help to trace Test Person, last seen in Test City."></head><body></body></html>', {
  sourceUrl: 'https://police.example.test/case-1',
  sourceName: 'Official Police',
  countryCode: 'GB',
})
const normalised = normaliseCase(htmlParsed)
assert.equal(normalised.countrySlug, 'united-kingdom')
assert.equal(normalised.status, 'active')
assert.equal(assignLocation({ countryCode: 'GB', city: 'Nottingham', region: 'Nottinghamshire' }).locationSlug, 'nottingham-nottinghamshire-gb')
assert.equal(classifyStatus({ title: 'Missing appeal', bodyText: 'The person has been safely located.' }), 'found-safe')

const policeParsed = parseHtmlCase('<html><head><title>Appeal to help trace Jan Hussain, believed to have travelled to Glasgow</title></head><body><h1>Appeal to help trace Jan Hussain, believed to have travelled to Glasgow</h1><p>We are appealing for the public’s help to trace 30-year-old Jan Hussain who has been reported missing. He was reported missing from Birmingham and is believed to have travelled to south-east Glasgow on Wednesday, 25 March, 2026. It is thought he may have been in the Croftfoot Road area. He is described as around 5ft 7in, with shoulder-length brown hair, and of medium build. When last seen, Jan was wearing brown trousers and a grey t-shirt. Anyone with information on where he may be is asked to contact Police Scotland on 101 quoting reference 2424 of 30 March, 2026.</p><img src="/spa-media/w51lcjaw/jan-hussain.png?width=247&amp;height=281&amp;mode=max" alt="Jan Hussain"></body></html>', {
  sourceUrl: 'https://www.scotland.police.uk/what-s-happening/news/2026/april/appeal-to-help-trace-jan-hussain-believed-to-have-travelled-to-glasgow/',
  sourceName: 'Police Scotland',
  countryCode: 'GB',
})
assert.equal(policeParsed.name, 'Jan Hussain')
assert.equal(policeParsed.age, 30)
assert.equal(policeParsed.city, 'Glasgow')
assert(policeParsed.imageUrl.includes('/spa-media/w51lcjaw/jan-hussain.png'))

const duplicateScan = dedupeCases([normalised, { ...normalised, id: 'copy' }], [])
assert.equal(duplicateScan.accepted.length, 1)
assert.equal(duplicateScan.duplicates[0].reason, 'duplicate-source-url')

const publicScannerCase = toPublicScannerCase({ ...normalised, internalNotes: 'secret', privatePhone: 'secret' })
assert(!('internalNotes' in publicScannerCase))
assert(!('privatePhone' in publicScannerCase))
const payload = articlePayload(publicScannerCase)
assert.equal(payload.handle, publicScannerCase.slug)
assert(payload.tags.includes('scanner-imported'))
assert(!JSON.stringify(payload).includes('secret'))
assert.equal(typeof shopifyHealth().ready, 'boolean')
const originalTokenEnv = {
  SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  SHOPIFY_ADMIN_TOKEN: process.env.SHOPIFY_ADMIN_TOKEN,
  SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
  SHOPIFY_REFRESH_TOKEN: process.env.SHOPIFY_REFRESH_TOKEN,
  SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET,
}
delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
delete process.env.SHOPIFY_ADMIN_TOKEN
delete process.env.SHOPIFY_ACCESS_TOKEN
delete process.env.SHOPIFY_REFRESH_TOKEN
delete process.env.SHOPIFY_CLIENT_ID
delete process.env.SHOPIFY_CLIENT_SECRET
assert.equal(getShopifyAuthStatus().tokenMode, 'missing')
process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'test-static-token'
assert.equal(getShopifyAuthStatus().tokenMode, 'static_admin_token')
delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
process.env.SHOPIFY_REFRESH_TOKEN = 'test-refresh-token'
process.env.SHOPIFY_CLIENT_ID = 'test-client-id'
process.env.SHOPIFY_CLIENT_SECRET = 'test-client-secret'
assert.equal(getShopifyAuthStatus().tokenMode, 'oauth_refresh_token')
for (const [key, value] of Object.entries(originalTokenEnv)) {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}
const health = await scannerHealthcheck()
assert.equal(health.sources.total >= 6, true)
assert.equal(typeof health.shopify.tokenMode, 'string')
assert(!JSON.stringify(health).includes('test-static-token'))

const workflow = await readFile('.github/workflows/missing-alerts-scanner.yml', 'utf8')
assert(workflow.includes('scanner:run-and-publish'))

function mockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
}

const invalidSignup = mockResponse()
await toolAlertSignupHandler({ method: 'POST', body: { email: 'not-an-email', productInterest: 'FindTrax' } }, invalidSignup)
assert.equal(invalidSignup.statusCode, 400)
assert.equal(invalidSignup.payload.error, 'Please enter a valid email address.')

const validSignup = mockResponse()
await toolAlertSignupHandler({ method: 'POST', body: { email: 'alerts@example.com', productInterest: 'FindTrax' } }, validSignup)
assert.equal(validSignup.statusCode, 200)
assert.equal(validSignup.payload.ok, true)

for (const country of ['United Kingdom', 'Ireland', 'Australia', 'New Zealand', 'United States', 'Canada']) {
  assert(cases.some((item) => item.countryName === country && ['active', 'urgent', 'long-term'].includes(item.status)), `${country} missing active case`)
}

console.log('unit tests passed')
