import { countryFromCode } from './missing-alerts-country-map.mjs'
import { getPublicCaseImage } from './missing-alerts-photo-policy.mjs'

export const activeStatuses = new Set(['active', 'urgent', 'long-term'])
export const resolvedStatuses = new Set(['located', 'found-safe', 'closed'])
export const blockedStatuses = new Set(['archived', 'draft', 'review', 'private'])

export function toPublicCase(caseRecord, context = 'active-card') {
  const country = countryFromCode(caseRecord.countryCode)
  const status = caseRecord.status || 'review'
  const image = getPublicCaseImage(caseRecord, context)

  return {
    id: caseRecord.id,
    slug: caseRecord.slug,
    countryCode: country.code,
    countryName: caseRecord.countryName || country.name,
    countrySlug: caseRecord.countrySlug || country.slug,
    region: caseRecord.region || '',
    city: caseRecord.city || '',
    name: caseRecord.name,
    age: caseRecord.age ?? null,
    missingSince: caseRecord.missingSince || '',
    lastSeenLocationPublic: caseRecord.lastSeenLocationPublic || '',
    shortSummary: caseRecord.shortSummary || '',
    publicDescription: caseRecord.publicDescription || caseRecord.shortSummary || '',
    publicPhotoUrl: image.type === 'image' ? image.url : '',
    image,
    sourceName: caseRecord.sourceName,
    sourceUrl: caseRecord.sourceUrl,
    sourcePublishedAt: caseRecord.sourcePublishedAt || '',
    importedAt: caseRecord.importedAt,
    lastCheckedAt: caseRecord.lastCheckedAt,
    status,
    publicStatus: activeStatuses.has(status) ? 'missing' : resolvedStatuses.has(status) ? 'resolved' : 'not-public',
    isPublic: Boolean(caseRecord.isPublic),
    caseType: caseRecord.caseType || 'missing-person',
    tags: Array.isArray(caseRecord.tags) ? caseRecord.tags : [],
    contactInstruction: caseRecord.contactInstruction || 'Use the official source contact instructions.',
    boost: publicBoost(caseRecord.boost),
  }
}

export function canListAsActive(caseRecord) {
  return Boolean(caseRecord.isPublic) && activeStatuses.has(caseRecord.status)
}

export function canListAsFoundSafe(caseRecord) {
  return Boolean(caseRecord.isPublic) && resolvedStatuses.has(caseRecord.status)
}

export function canShowDetail(caseRecord) {
  return canListAsActive(caseRecord)
}

function publicBoost(boost = {}) {
  return {
    active: Boolean(boost.active),
    points: Number(boost.points || 0),
    expiresAt: boost.expiresAt || '',
  }
}
