export async function fetchSource(source, options = {}) {
  if (!source.enabled && !options.includeDisabled) {
    return { ok: false, skipped: true, reason: 'source-disabled', source }
  }
  if (source.requiresApiKey && !process.env[source.apiKeyEnv || '']) {
    return { ok: false, skipped: true, reason: `missing-${source.apiKeyEnv || 'api-key'}`, source }
  }
  if (!source.url && !source.sourceUrl) {
    return { ok: false, skipped: true, reason: 'missing-source-url', source }
  }
  const url = source.url || source.sourceUrl
  const response = await fetch(url, {
    headers: {
      'user-agent': 'MissingAlertsScanner/1.0 (+https://missingalerts.com)',
      accept: source.sourceType === 'rss' ? 'application/rss+xml,application/xml,text/xml,text/html' : 'text/html,application/xhtml+xml,application/xml',
    },
  })
  const body = await response.text()
  return { ok: response.ok, status: response.status, body, source, url }
}
