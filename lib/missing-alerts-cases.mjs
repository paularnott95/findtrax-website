import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { countryBySlug } from './missing-alerts-country-map.mjs'
import { canListAsActive, canListAsFoundSafe, canShowDetail, toPublicCase } from './missing-alerts-public-case-mapper.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataPath = path.join(root, 'data/missing-alerts-public-cases.json')

export async function loadCases() {
  return JSON.parse(await readFile(dataPath, 'utf8'))
}

export function activeCases(cases) {
  return cases.filter(canListAsActive).map((caseRecord) => toPublicCase(caseRecord))
}

export function foundSafeCases(cases) {
  return cases.filter(canListAsFoundSafe).map((caseRecord) => toPublicCase(caseRecord, 'found-safe-card'))
}

export function casesForCountry(cases, countrySlug) {
  const country = countryBySlug(countrySlug)
  if (!country) return []
  return activeCases(cases).filter((caseRecord) => caseRecord.countrySlug === country.slug)
}

export function caseDetail(cases, countrySlug, caseSlug) {
  const country = countryBySlug(countrySlug)
  if (!country) return null
  const found = cases.find((caseRecord) => caseRecord.slug === caseSlug && caseRecord.countryCode === country.code)
  if (!found || !canShowDetail(found)) return null
  return toPublicCase(found, 'detail')
}
