import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { getBoostedCases } from '../lib/missing-alerts-boosts.mjs'
import { countrySlugFromCode } from '../lib/missing-alerts-country-map.mjs'
import { getPublicCaseImage } from '../lib/missing-alerts-photo-policy.mjs'
import { canListAsActive, toPublicCase } from '../lib/missing-alerts-public-case-mapper.mjs'
import { scanFixtureCases } from '../lib/missing-alerts-scanner.mjs'
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
