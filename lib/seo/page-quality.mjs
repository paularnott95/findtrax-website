const LOW_VALUE_PATTERNS = [
  /\/search/i,
  /\/tagged\//i,
  /\/cdn\/shop\/t\/\d+\/assets\/(?:location|translation|nearby|alert|no-case|guide|help|district|cluster|recent)-sitemap/i,
  /\/pages\/(?:missing-people-location|missing-alerts-near-me|missing-cases-near|no-active-missing-cases|missing-people-near-me|recent-missing-cases|help-find-missing)/i,
]

export function evaluatePageQuality(page = {}) {
  const issues = new Set(page.issues || [])
  const url = page.url || ''
  const wordCount = Number(page.wordCount || 0)
  const robots = String(page.robots || '').toLowerCase()
  const hasNoindex = robots.includes('noindex')
  const hasCanonical = Boolean(page.canonical)
  const duplicate = Boolean(page.duplicateGroup)
  const lowValuePattern = LOW_VALUE_PATTERNS.some((pattern) => pattern.test(url))
  const isCasePage = /\/blogs\/missing-persons\//.test(url)
  const isCorePage = /\/$|\/pages\/missing-person-advice$|\/pages\/country-intelligence$|\/blogs\/missing-persons$|\/blogs\/found-safe$/.test(url)
  const hasUsefulContent = wordCount >= (isCasePage ? 90 : 220)
  const hasTitle = Boolean(String(page.title || '').trim())
  const hasMeta = Boolean(String(page.metaDescription || '').trim())

  let score = 100
  if (!hasTitle) score -= 18
  if (!hasMeta) score -= 18
  if (!hasCanonical) score -= 14
  if (wordCount < 120 && !isCasePage) score -= 24
  else if (!hasUsefulContent && !isCasePage) score -= 14
  if (duplicate) score -= 28
  if (lowValuePattern) score -= 40
  if (page.status >= 400) score -= 60
  if (issues.has('empty-links')) score -= 12
  if (issues.has('broken-image')) score -= 12
  if (hasNoindex) score -= 8

  score = Math.max(0, Math.min(100, score))

  const fields = {
    uniqueTitle: hasTitle && !duplicate,
    uniqueMetaDescription: hasMeta && !duplicate,
    canonicalValid: hasCanonical,
    robotsDecision: hasNoindex ? 'noindex' : 'indexable',
    wordCount,
    uniqueLocalDataCount: Number(page.uniqueLocalDataCount || 0),
    sourceLinksCount: Number(page.sourceLinksCount || 0),
    internalLinksCount: Number(page.internalLinksCount || 0),
    brokenLinksCount: Number(page.brokenLinksCount || 0),
    imageStatus: page.imageStatus || 'unknown',
    duplicateSimilarityGroup: page.duplicateGroup || '',
    officialLinksPresent: Boolean(page.officialLinksPresent),
    caseDataPresent: Boolean(page.caseDataPresent || isCasePage),
    countrySpecificBlocksPresent: Boolean(page.countrySpecificBlocksPresent),
    topicSpecificBlocksPresent: Boolean(page.topicSpecificBlocksPresent),
    faqPresent: Boolean(page.faqPresent),
    schemaPresent: Boolean(page.schemaPresent),
    thinRisk: score < 70 || issues.has('thin-content'),
    adsenseRisk: lowValuePattern || duplicate || (wordCount < 180 && !isCasePage),
    qualityScore: score,
  }

  fields.indexDecision = decideIndexDecision({ page, fields, isCorePage, isCasePage, lowValuePattern, hasNoindex, duplicate })
  fields.recommendedAction = recommendedAction(fields.indexDecision, fields)
  return fields
}

function decideIndexDecision({ page, fields, isCorePage, isCasePage, lowValuePattern, hasNoindex, duplicate }) {
  if (page.status >= 400) return 'redirect-or-remove'
  if (hasNoindex) return 'noindex'
  if (lowValuePattern) return 'noindex'
  if (duplicate) return 'canonicalize'
  if (!fields.canonicalValid) return 'noindex'
  if (isCorePage && fields.qualityScore >= 70) return 'index'
  if (isCasePage && fields.qualityScore >= 65) return 'index'
  if (fields.qualityScore >= 85) return 'index'
  if (fields.qualityScore >= 70 && !fields.adsenseRisk) return 'index'
  if (fields.qualityScore >= 50) return 'noindex-until-enriched'
  return 'noindex'
}

function recommendedAction(indexDecision, fields) {
  if (indexDecision === 'index') return 'Keep indexable and continue enrichment.'
  if (indexDecision === 'canonicalize') return 'Canonicalize to the strongest equivalent page and remove duplicate from sitemap.'
  if (indexDecision === 'redirect-or-remove') return 'Redirect to the closest useful page or remove from sitemap.'
  if (indexDecision === 'noindex-until-enriched') return 'Apply noindex, follow until enough unique useful content exists.'
  if (fields.adsenseRisk) return 'Noindex/remove from sitemap; do not use as ad inventory.'
  return 'Noindex, follow and queue for enrichment only if the page has real user value.'
}

