const resolvedTerms = [
  'found safe',
  'safe and well',
  'safely located',
  'has been located',
  'have been located',
  'no longer missing',
  'appeal cancelled',
  'appeal stood down',
  'traced safe',
  'returned home',
  'closed',
  'resolved',
  'located deceased',
]

const activeTerms = [
  'missing',
  'appeal',
  'public assistance',
  'trace',
  'tracing',
  'last seen',
  'concern',
]

export function classifyStatus(input = {}) {
  const explicit = String(input.status || '').toLowerCase().trim()
  const text = [input.title, input.summary, input.bodyText, input.sourceStatus].filter(Boolean).join(' ').toLowerCase()

  if (['found-safe', 'located', 'closed', 'resolved'].includes(explicit)) return 'found-safe'
  if (['active', 'urgent', 'long-term'].includes(explicit)) return explicit
  if (resolvedTerms.some((term) => text.includes(term))) return 'found-safe'
  if (!text || !activeTerms.some((term) => text.includes(term))) return 'review'
  if (text.includes('urgent') || text.includes('high risk')) return 'urgent'
  if (text.includes('long-term') || text.includes('long term')) return 'long-term'
  return 'active'
}

export function isPublishableActive(status) {
  return ['active', 'urgent', 'long-term'].includes(String(status || '').toLowerCase())
}
