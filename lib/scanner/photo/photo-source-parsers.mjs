export function sourceSpecificPhotoCandidates(html, sourceUrl = '') {
  const url = String(sourceUrl || '')
  const source = String(html || '')
  const main = source.match(/<main[\s\S]*?<\/main>/i)?.[0] || source
  const article = source.match(/<article[\s\S]*?<\/article>/i)?.[0] || main
  const candidates = []

  if (/scotland\.police\.uk/i.test(url)) {
    addFirstImage(candidates, article, sourceUrl, 'source-specific:police-scotland')
  }
  if (/garda\.ie/i.test(url)) {
    addFirstImage(candidates, article, sourceUrl, 'source-specific:garda')
  }
  if (/missingkids\.org/i.test(url)) {
    addSelectorImages(candidates, source, sourceUrl, 'source-specific:ncmec', /<img\b[^>]*(?:poster|child|missing|photo)[^>]*>/gi)
  }
  if (/missingpersons\.gov\.au/i.test(url)) {
    addSelectorImages(candidates, source, sourceUrl, 'source-specific:nmpcc', /<img\b[^>]*(?:missing|person|profile|field-name-field-image|photo)[^>]*>/gi)
  }
  if (/police\.govt\.nz/i.test(url)) {
    addFirstImage(candidates, article, sourceUrl, 'source-specific:nz-police')
  }
  if (/vpd\.ca|tps\.ca|rcmp|surreypolice\.ca/i.test(url)) {
    addFirstImage(candidates, article, sourceUrl, 'source-specific:canada-police')
  }
  if (/fbi\.gov/i.test(url)) {
    addFirstImage(candidates, article, sourceUrl, 'source-specific:fbi')
  }

  return candidates
}

function addSelectorImages(candidates, html, base, method, regex) {
  for (const match of String(html || '').matchAll(regex)) addTag(candidates, match[0], base, method)
}

function addFirstImage(candidates, html, base, method) {
  const tag = String(html || '').match(/<img\b[^>]*>/i)?.[0]
  if (tag) addTag(candidates, tag, base, method)
}

function addTag(candidates, tag, base, method) {
  const src = attr(tag, 'src') || bestSrcset(attr(tag, 'srcset') || attr(tag, 'data-srcset')) || attr(tag, 'data-src') || attr(tag, 'data-original') || attr(tag, 'data-lazy-src')
  if (!src) return
  candidates.push({
    url: absoluteUrl(src, base),
    method,
    alt: attr(tag, 'alt'),
    nearbyText: tag,
  })
}

function attr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (String(tag || '').match(new RegExp(`${escaped}=["']([^"']+)["']`, 'i'))?.[1] || '').replace(/&amp;/g, '&')
}

function bestSrcset(value) {
  const candidates = String(value || '').split(',').map((part) => {
    const [url, size] = part.trim().split(/\s+/)
    return { url, score: Number(String(size || '').replace(/[^\d.]/g, '')) || 0 }
  }).filter((item) => item.url)
  candidates.sort((a, b) => a.score - b.score)
  return candidates.at(-1)?.url || ''
}

function absoluteUrl(value, base) {
  try {
    return new URL(value, base || 'https://missingalerts.com').toString()
  } catch {
    return value || ''
  }
}
