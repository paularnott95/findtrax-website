import { countryFromCode } from './missing-alerts-country-map.mjs'

const activeStatuses = new Set(['active', 'urgent', 'long-term'])

export function normaliseSourceCase(sourceCase) {
  const country = countryFromCode(sourceCase.countryCode)
  const status = String(sourceCase.status || 'review').toLowerCase()
  const slug = slugify(sourceCase.name || sourceCase.externalId || 'case')
  return {
    id: sourceCase.externalId || `${country.code}-${slug}`,
    slug,
    countryCode: country.code,
    countryName: country.name,
    countrySlug: country.slug,
    name: String(sourceCase.name || '').trim(),
    missingSince: sourceCase.missingSince || '',
    status,
    isPublic: Boolean(sourceCase.isPublic),
    sourceName: sourceCase.sourceName || '',
    sourceUrl: sourceCase.sourceUrl || '',
    shortSummary: sourceCase.summary || '',
    importedAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    duplicateKey: duplicateKey(sourceCase),
  }
}

export function scanFixtureCases(sourceCases) {
  const seenUrls = new Set()
  const seenKeys = new Set()
  const imported = []
  const skipped = []

  for (const sourceCase of sourceCases) {
    const normalised = normaliseSourceCase(sourceCase)
    if (!normalised.name || !normalised.sourceUrl || !normalised.sourceName || !normalised.isPublic) {
      skipped.push({ sourceUrl: normalised.sourceUrl, reason: 'missing-required-public-fields' })
      continue
    }
    if (!activeStatuses.has(normalised.status)) {
      skipped.push({ sourceUrl: normalised.sourceUrl, reason: `status-${normalised.status}-not-active` })
      continue
    }
    if (seenUrls.has(normalised.sourceUrl) || seenKeys.has(normalised.duplicateKey)) {
      skipped.push({ sourceUrl: normalised.sourceUrl, reason: 'duplicate' })
      continue
    }
    seenUrls.add(normalised.sourceUrl)
    seenKeys.add(normalised.duplicateKey)
    imported.push(normalised)
  }

  return { imported, skipped, errors: [] }
}

export function duplicateKey(sourceCase) {
  return [sourceCase.name, sourceCase.countryCode, sourceCase.missingSince]
    .map((value) => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
    .join('|')
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}
