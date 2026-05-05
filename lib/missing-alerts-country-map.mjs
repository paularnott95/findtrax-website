export const countries = [
  ['GB', 'United Kingdom', 'united-kingdom'],
  ['IE', 'Ireland', 'ireland'],
  ['AU', 'Australia', 'australia'],
  ['NZ', 'New Zealand', 'new-zealand'],
  ['US', 'United States', 'united-states'],
  ['CA', 'Canada', 'canada'],
]

const byCode = new Map(countries.map(([code, name, slug]) => [code, { code, name, slug }]))
const aliases = new Map([
  ['UK', 'GB'],
  ['GB', 'GB'],
  ['IE', 'IE'],
  ['AU', 'AU'],
  ['NZ', 'NZ'],
  ['US', 'US'],
  ['USA', 'US'],
  ['CA', 'CA'],
])

export function countryFromCode(value) {
  const code = aliases.get(String(value || '').toUpperCase()) || String(value || '').toUpperCase()
  return byCode.get(code) || { code, name: 'Unknown', slug: 'unknown' }
}

export function countrySlugFromCode(value) {
  return countryFromCode(value).slug
}

export function countryBySlug(slug) {
  const found = countries.find(([, , itemSlug]) => itemSlug === slug)
  return found ? { code: found[0], name: found[1], slug: found[2] } : null
}
