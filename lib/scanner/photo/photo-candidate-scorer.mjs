const POSITIVE_URL_RE = /\b(missing|appeal|person|people|media|image|upload|photo|poster|child|case)\b/i
const NEGATIVE_URL_RE = /\b(logo|crest|badge|icon|sprite|avatar|placeholder|favicon|brand|facebook|twitter|instagram|youtube|linkedin|tracking|pixel|blank|spacer|emblem|qr|map|banner|homepage|og-default|share)\b/i
const NEGATIVE_TEXT_RE = /\b(logo|crest|badge|icon|social|facebook|twitter|instagram|map|qr|banner|homepage|placeholder)\b/i

export function scorePhotoCandidate(candidate = {}, context = {}) {
  const url = String(candidate.url || '')
  const method = String(candidate.method || '')
  const text = [candidate.alt, candidate.caption, candidate.nearbyText, context.name].filter(Boolean).join(' ')
  let score = 0
  const reasons = []

  if (/source-specific|police|garda|ncmec|rcmp|missingkids|nmpcc|article-main/i.test(method)) {
    score += 40
    reasons.push('source-specific-or-main-content')
  }
  if (/json-ld|og:image|twitter:image/i.test(method)) {
    score += 18
    reasons.push(method)
  }
  if (POSITIVE_URL_RE.test(url)) {
    score += 12
    reasons.push('positive-url-path')
  }
  if (context.sourceHostname && safeHostname(url).endsWith(context.sourceHostname)) {
    score += 14
    reasons.push('source-domain')
  }
  if (context.name && text.toLowerCase().includes(String(context.name).toLowerCase())) {
    score += 18
    reasons.push('name-near-image')
  }
  if (/\bmissing|appeal|have you seen|last seen\b/i.test(text)) {
    score += 10
    reasons.push('missing-appeal-context')
  }

  if (NEGATIVE_URL_RE.test(url)) {
    score -= 45
    reasons.push('rejected-url-signal')
  }
  if (NEGATIVE_TEXT_RE.test(text)) {
    score -= 35
    reasons.push('rejected-text-signal')
  }
  if (/\.svg(?:\?|$)/i.test(url) && !/poster|person|missing/i.test(url)) {
    score -= 50
    reasons.push('svg-likely-logo')
  }

  const clamped = Math.max(0, Math.min(100, score))
  const confidence = clamped >= 70 ? 'high' : clamped >= 50 ? 'medium' : clamped > 0 ? 'low' : 'rejected'
  return { score: clamped, confidence, reasons }
}

export function isHardRejectedPhoto(candidate = {}) {
  const haystack = [candidate.url, candidate.alt, candidate.caption, candidate.nearbyText].filter(Boolean).join(' ')
  return NEGATIVE_URL_RE.test(String(candidate.url || '')) || NEGATIVE_TEXT_RE.test(haystack)
}

function safeHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
