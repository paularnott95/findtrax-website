const IMAGE_ATTRS = ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-srcset', 'srcset']
const BACKGROUND_IMAGE_RE = /background(?:-image)?\s*:\s*url\((["']?)(.*?)\1\)/gi

export async function extractCasePhoto(html, sourceUrl = '') {
  const candidates = collectImageCandidates(html, sourceUrl)
  for (const candidate of candidates) {
    const validation = await validateImage(candidate.url)
    if (!validation.ok) continue
    return {
      url: candidate.url,
      method: candidate.method,
      width: validation.width,
      contentType: validation.contentType,
    }
  }
  return { url: '', method: 'fallback', width: 0, contentType: '' }
}

export function collectImageCandidates(html, sourceUrl = '') {
  const values = []
  for (const item of sourceSpecificImages(html, sourceUrl)) add(values, item.url, item.method, sourceUrl)
  add(values, meta(html, 'og:image'), 'og:image', sourceUrl)
  add(values, meta(html, 'twitter:image'), 'twitter:image', sourceUrl)
  add(values, meta(html, 'twitter:image:src'), 'twitter:image:src', sourceUrl)
  for (const item of jsonLdImages(html)) add(values, item, 'json-ld:image', sourceUrl)

  const imageTags = [...String(html || '').matchAll(/<img\b[^>]*>/gi)].map((item) => item[0])
  for (const tag of imageTags) {
    const context = `${tag} ${nearbyText(html, tag)}`.toLowerCase()
    if (/logo|sprite|icon|tracking|pixel|avatar|placeholder|favicon|brand/.test(context)) continue
    for (const attrName of IMAGE_ATTRS) {
      const raw = attr(tag, attrName)
      if (!raw) continue
      const source = attrName.includes('srcset') ? bestSrcset(raw) : raw
      add(values, source, `img:${attrName}`, sourceUrl)
    }
  }

  for (const match of String(html || '').matchAll(BACKGROUND_IMAGE_RE)) {
    add(values, match[2], 'css:background-image', sourceUrl)
  }

  for (const match of String(html || '').matchAll(/<a\b[^>]+href=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["'][^>]*>/gi)) {
    add(values, match[1], 'linked-image', sourceUrl)
  }

  const seen = new Set()
  return values.filter((item) => {
    if (!item.url || seen.has(item.url)) return false
    seen.add(item.url)
    return !isRejectedImageUrl(item.url)
  })
}

function sourceSpecificImages(html, sourceUrl) {
  const url = String(sourceUrl || '')
  const images = []
  if (url.includes('scotland.police.uk')) {
    const main = String(html || '').match(/<main[\s\S]*?<\/main>/i)?.[0] || String(html || '')
    const img = main.match(/<img\b[^>]*(?:class=["'][^"']*(?:image|media|article|featured)[^"']*["'][^>]*)?>/i)?.[0] || ''
    const src = attr(img, 'src') || bestSrcset(attr(img, 'srcset') || attr(img, 'data-srcset')) || attr(img, 'data-src')
    if (src) images.push({ url: src, method: 'police-scotland:main-image' })
  }
  return images
}

async function validateImage(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'user-agent': 'MissingAlertsScanner/1.0 (+https://missingalerts.com)', accept: 'image/*,*/*;q=0.8' },
      signal: AbortSignal.timeout(12000),
    })
    const contentType = response.headers.get('content-type') || ''
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (!response.ok || !contentType.toLowerCase().startsWith('image/')) return { ok: false }
    if (contentLength && contentLength < 2500) return { ok: false }
    return { ok: true, width: 0, contentType }
  } catch {
    return { ok: false }
  }
}

function add(values, value, method, base) {
  const resolved = absoluteUrl(value, base)
  if (resolved) values.push({ url: resolved, method })
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return match(html, new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')) ||
    match(html, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'))
}

function jsonLdImages(html) {
  const scripts = [...String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const images = []
  for (const script of scripts) {
    try {
      const json = JSON.parse(script[1].replace(/&quot;/g, '"'))
      collectJsonImages(json, images)
    } catch {
      continue
    }
  }
  return images
}

function collectJsonImages(value, images) {
  if (!value) return
  if (Array.isArray(value)) {
    for (const item of value) collectJsonImages(item, images)
    return
  }
  if (typeof value !== 'object') return
  if (typeof value.image === 'string') images.push(value.image)
  if (Array.isArray(value.image)) images.push(...value.image.filter((item) => typeof item === 'string'))
  if (typeof value.thumbnailUrl === 'string') images.push(value.thumbnailUrl)
  for (const child of Object.values(value)) collectJsonImages(child, images)
}

function bestSrcset(value) {
  const candidates = String(value || '').split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean)
  return candidates[candidates.length - 1] || ''
}

function isRejectedImageUrl(url) {
  return /logo|sprite|icon|tracking|pixel|avatar|placeholder|favicon|brand|facebook|twitter|instagram|blank|spacer|emblem|close\.svg|\.svg(?:\?|$)|og-default|appeals_og_img|banner-helpline|blue_light|blue-light|homepage|pop-up|family-hugging|social\/police/i.test(url)
}

function attr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return match(tag, new RegExp(`${escaped}=["']([^"']+)["']`, 'i')).replace(/&amp;/g, '&')
}

function match(value, regex) {
  const found = String(value || '').match(regex)
  return found ? found[1] : ''
}

function nearbyText(html, tag) {
  const source = String(html || '')
  const index = source.indexOf(tag)
  if (index < 0) return ''
  return source.slice(Math.max(0, index - 500), Math.min(source.length, index + tag.length + 500))
}

function absoluteUrl(value, base) {
  if (!value) return ''
  try {
    return new URL(value, base || 'https://missingalerts.com').toString()
  } catch {
    return value
  }
}
