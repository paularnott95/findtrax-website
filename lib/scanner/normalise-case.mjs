import crypto from 'node:crypto'

import { assignLocation, slugify } from './assign-location.mjs'
import { classifyStatus } from './classify-status.mjs'

export function normaliseCase(sourceCase, source = {}) {
  const now = new Date().toISOString()
  const location = assignLocation({ ...sourceCase, countryCode: sourceCase.countryCode || source.countryCode })
  const name = cleanName(sourceCase.name || sourceCase.fullName || titleName(sourceCase.title))
  const status = classifyStatus(sourceCase)
  const sourceUrl = sourceCase.sourceUrl || sourceCase.url || ''
  const sourceName = sourceCase.sourceName || source.sourceName || source.name || ''
  const missingSince = clean(sourceCase.missingSince || sourceCase.lastSeenDate || sourceCase.date || '')
  const slug = slugify(sourceCase.slug || name || sourceCase.externalId || hash(sourceUrl).slice(0, 10))

  return {
    id: sourceCase.id || sourceCase.externalId || `${location.countryCode}-${slug}`,
    externalId: sourceCase.externalId || sourceCase.sourceCaseId || '',
    slug,
    name,
    age: sourceCase.age ?? null,
    missingSince,
    status,
    isPublic: sourceCase.isPublic !== false,
    caseType: 'missing-person',
    sourceName,
    sourceUrl,
    sourcePublishedAt: clean(sourceCase.sourcePublishedAt || sourceCase.publishedAt || ''),
    importedAt: sourceCase.importedAt || now,
    lastCheckedAt: now,
    shortSummary: cleanSummary(sourceCase.summary || sourceCase.excerpt || ''),
    publicDescription: cleanSummary(sourceCase.publicDescription || sourceCase.summary || sourceCase.excerpt || ''),
    gender: clean(sourceCase.gender || ''),
    physicalDescription: clean(sourceCase.physicalDescription || ''),
    clothing: clean(sourceCase.clothing || ''),
    travelContext: clean(sourceCase.travelContext || ''),
    sourceTitle: clean(sourceCase.title || ''),
    sourceImageUrl: sourceCase.imageUrl || sourceCase.photoUrl || '',
    photoUrl: sourceCase.photoUrl || sourceCase.imageUrl || '',
    photoExtractionMethod: sourceCase.photoExtractionMethod || '',
    photoVisibility: sourceCase.photoVisibility || (sourceCase.photoUrl || sourceCase.imageUrl ? 'public-active' : 'placeholder'),
    canShowPhotoWhileActive: Boolean(sourceCase.canShowPhotoWhileActive),
    canShowPhotoAfterFound: false,
    consentToDisplayAfterResolved: false,
    isMinor: Boolean(sourceCase.isMinor),
    tags: Array.from(new Set([
      'scanner-imported',
      'public-source',
      `status:${status}`,
      `country:${location.countryName}`,
      `country-code:${location.countryCode}`,
      `country-slug:${location.countrySlug}`,
      `location:${location.locationSlug}`,
      sourceCase.city ? `city:${sourceCase.city}` : '',
      sourceCase.region ? `region:${sourceCase.region}` : '',
      status,
    ].filter(Boolean))),
    contactInstruction: sourceCase.contactInstruction || 'Use the official source contact instructions.',
    duplicateKey: duplicateKey({ name, countryCode: location.countryCode, missingSince }),
    ...location,
  }
}

export function duplicateKey(record) {
  return [record.name, record.countryCode, record.missingSince]
    .map((value) => clean(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim())
    .join('|')
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function cleanName(value) {
  return clean(value).replace(/\b(missing|appeal|person|police|trace|tracing|help|find)\b/gi, '').replace(/\s+/g, ' ').trim()
}

function titleName(title = '') {
  let first = clean(title)
  if (first.includes(':')) first = first.split(':').slice(1).join(':').trim()
  first = first.split(/\s[-–—|]\s/)[0]
  first = first.replace(/^(missing person appeal|appeal to help trace|appeal to trace|help trace|missing)\s*/i, '')
  first = first.replace(/,?\s*believed to have.*$/i, '')
  return first
}

function cleanSummary(value) {
  const summary = clean(String(value || '').replace(/<[^>]*>/g, ''))
  if (!summary) return 'Public appeal details are available from the official case source.'
  return summary.length > 420 ? `${summary.slice(0, 417).trim()}...` : summary
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}
