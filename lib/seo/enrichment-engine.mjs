export const CONTENT_MODULES = {
  urgentReportingNote: {
    id: 'urgent-reporting-note',
    label: 'Urgent reporting note',
    appliesTo: ['advice-hub', 'advice-article', 'country-page', 'country-intelligence'],
    purpose: 'Tell users to contact emergency services or police first when there is immediate risk.',
  },
  officialReportingLinks: {
    id: 'official-reporting-links',
    label: 'Official reporting links',
    appliesTo: ['country-page', 'country-intelligence', 'advice-article'],
    purpose: 'Provide source-backed police, government, charity, or agency links.',
  },
  safeSharingGuidance: {
    id: 'safe-sharing-guidance',
    label: 'Safe sharing guidance',
    appliesTo: ['advice-hub', 'advice-article', 'country-page', 'case-article'],
    purpose: 'Keep appeals factual and privacy-safe.',
  },
  missingAlertsHelp: {
    id: 'missing-alerts-help',
    label: 'How Missing Alerts helps',
    appliesTo: ['advice-hub', 'advice-article', 'country-page', 'country-intelligence'],
    purpose: 'Explain the platform role without replacing police reporting.',
  },
  activeCases: {
    id: 'active-cases',
    label: 'Active cases',
    appliesTo: ['country-page', 'country-intelligence', 'homepage'],
    purpose: 'Show verified public cases filtered to the relevant country/location.',
  },
  foundSafePrivacy: {
    id: 'found-safe-privacy',
    label: 'Found-safe privacy',
    appliesTo: ['found-safe', 'case-article'],
    purpose: 'Use blurred/protected visuals and avoid active appeal treatment for resolved cases.',
  },
  cctvSightings: {
    id: 'cctv-sightings',
    label: 'CCTV and sightings',
    appliesTo: ['advice-article', 'case-article'],
    purpose: 'Guide users to preserve public observations and report them safely.',
  },
  faq: {
    id: 'faq',
    label: 'FAQ',
    appliesTo: ['advice-article', 'country-page', 'country-intelligence'],
    purpose: 'Answer practical user questions with clear safety boundaries.',
  },
  internalLinks: {
    id: 'internal-links',
    label: 'Internal links',
    appliesTo: ['advice-hub', 'advice-article', 'country-page', 'country-intelligence', 'case-article'],
    purpose: 'Connect related advice, country pages, cases, and official sources.',
  },
}

export function recommendEnrichmentModules(page = {}) {
  const pattern = page.patternName || page.template || 'unknown'
  const modules = []
  for (const module of Object.values(CONTENT_MODULES)) {
    if (module.appliesTo.includes(pattern)) modules.push(module.id)
  }
  if (page.issues?.includes('thin-content')) modules.push('unique-local-context')
  if (!page.metaDescription) modules.push('unique-meta-description')
  if (!page.canonical) modules.push('canonical')
  if (page.imageStatus === 'missing' || page.imageStatus === 'unknown') modules.push('relevant-image-or-safe-fallback')
  return Array.from(new Set(modules))
}

export function buildEnrichmentQueue(pages = []) {
  return pages
    .filter((page) => ['noindex-until-enriched', 'noindex', 'canonicalize'].includes(page.indexDecision))
    .map((page) => ({
      url: page.url,
      patternName: page.patternName || page.template,
      currentScore: page.qualityScore,
      indexDecision: page.indexDecision,
      priority: page.patternName === 'country-page' || page.patternName === 'advice-article' ? 'high' : 'normal',
      neededModules: recommendEnrichmentModules(page),
      action: page.recommendedAction,
    }))
}

