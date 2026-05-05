import { countryFromCode } from '../missing-alerts-country-map.mjs'

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function assignLocation(record) {
  const country = countryFromCode(record.countryCode || record.country || record.countryName)
  const city = clean(record.city || record.town || record.area)
  const region = clean(record.region || record.state || record.county)
  const lastSeenLocationPublic = clean(record.lastSeenLocationPublic || record.lastSeen || record.location || [city, region, country.name].filter(Boolean).join(', '))
  const locationBase = city || region || country.name
  return {
    countryCode: country.code,
    countryName: record.countryName || country.name,
    countrySlug: record.countrySlug || country.slug,
    region,
    city,
    lastSeenLocationPublic,
    locationSlug: record.locationSlug || slugify([locationBase, region && city ? region : '', country.code].filter(Boolean).join(' ')),
    locationConfidence: city || region ? 'public-location-text' : 'country-only',
    publicLatitude: record.publicLatitude ?? null,
    publicLongitude: record.publicLongitude ?? null,
  }
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}
