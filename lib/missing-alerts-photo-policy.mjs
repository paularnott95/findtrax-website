const resolvedStatuses = new Set(['found-safe', 'located', 'closed'])

export function getPublicCaseImage(caseRecord, context = 'active-card') {
  const status = caseRecord.status || caseRecord.publicStatus
  const isResolved = resolvedStatuses.has(status)
  const hasPhoto = Boolean(caseRecord.photoUrl)

  if (!caseRecord.isPublic || ['private', 'draft', 'review', 'archived'].includes(status)) {
    return protectedImage('Private case')
  }

  if (isResolved) {
    if (caseRecord.isMinor) return protectedImage('Found Safe')
    if (caseRecord.consentToDisplayAfterResolved && caseRecord.canShowPhotoAfterFound && hasPhoto) {
      return { type: 'image', url: caseRecord.photoUrl, alt: `${caseRecord.name} public source image` }
    }
    return protectedImage(status === 'found-safe' ? 'Found Safe' : 'Resolved')
  }

  if (context === 'found-safe-card') return protectedImage('Found Safe')

  if (caseRecord.canShowPhotoWhileActive && hasPhoto) {
    return { type: 'image', url: caseRecord.photoUrl, alt: `${caseRecord.name} public source image` }
  }

  return protectedImage('Missing Alert')
}

function protectedImage(label) {
  return { type: 'placeholder', label, url: '', alt: `${label} privacy protected visual` }
}
