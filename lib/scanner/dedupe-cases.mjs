export function dedupeCases(incoming, existing = []) {
  const seenUrls = new Set(existing.map((item) => normUrl(item.sourceUrl)).filter(Boolean))
  const seenExternalIds = new Set(existing.map((item) => `${item.sourceName || ''}|${item.externalId || item.sourceCaseId || ''}`).filter((item) => !item.endsWith('|')))
  const seenKeys = new Set(existing.map((item) => item.duplicateKey).filter(Boolean))
  const accepted = []
  const duplicates = []

  for (const item of incoming) {
    const sourceUrl = normUrl(item.sourceUrl)
    const externalKey = `${item.sourceName || ''}|${item.externalId || ''}`
    if (sourceUrl && seenUrls.has(sourceUrl)) {
      duplicates.push({ sourceUrl: item.sourceUrl, reason: 'duplicate-source-url' })
      continue
    }
    if (item.externalId && seenExternalIds.has(externalKey)) {
      duplicates.push({ sourceUrl: item.sourceUrl, reason: 'duplicate-external-id' })
      continue
    }
    if (item.duplicateKey && seenKeys.has(item.duplicateKey)) {
      duplicates.push({ sourceUrl: item.sourceUrl, reason: 'duplicate-name-date-country' })
      continue
    }
    if (sourceUrl) seenUrls.add(sourceUrl)
    if (item.externalId) seenExternalIds.add(externalKey)
    if (item.duplicateKey) seenKeys.add(item.duplicateKey)
    accepted.push(item)
  }

  return { accepted, duplicates }
}

function normUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}
