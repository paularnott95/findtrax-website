import { addPhotoReviewItem } from './photo/manual-photo-review.mjs'
import { scorePhotoCandidate, isHardRejectedPhoto } from './photo/photo-candidate-scorer.mjs'
import { sourceSpecificPhotoCandidates } from './photo/photo-source-parsers.mjs'
import { validatePhotoUrl } from './photo/photo-validator.mjs'

const IMAGE_ATTRS = ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-image', 'data-media', 'data-srcset', 'srcset']
const BACKGROUND_IMAGE_RE = /background(?:-image)?\s*:\s*url\((["']?)(.*?)\1\)/gi

export async function extractCasePhoto(html, sourceUrl = '', context = {}) {
  const candidates = collectImageCandidates(html, sourceUrl, context)
  const rejected = []
  for (const candidate of candidates) {
    const scored = scorePhotoCandidate(candidate, { ...context, sourceHostname: hostname(sourceUrl) })
    if (scored.confidence === 'rejected' || isHardRejectedPhoto(candidate)) {
      rejected.push({ ...candidate, score: scored.score, reason: scored.reasons.join(',') || 'hard-rejected' })
      continue
    }
    const validation = await validatePhotoUrl(candidate.url, { allowSmall: scored.score >= 80 })
    if (!validation.ok) {
      rejected.push({ ...candidate, score: scored.score, reason: validation.reason })
      continue
    }
    return {
      url: validation.url || candidate.url,
      method: candidate.method,
      confidence: scored.confidence,
      score: scored.score,
      width: validation.width,
      height: validation.height,
      contentType: validation.contentType,
      imageStatus: 'official_person_photo',
    }
  }
  if (context.sourceUrl || sourceUrl) {
    await addPhotoReviewItem({
      name: context.name || '',
      sourceUrl: context.sourceUrl || sourceUrl,
      reason: rejected.length ? 'no accepted image candidate after validation' : 'no image candidates found',
      rejected: rejected.slice(0, 12),
    })
  }
  return { url: '', method: 'fallback_silhouette', confidence: 'none', score: 0, width: 0, height: 0, contentType: '', imageStatus: 'fallback_silhouette' }
}

export function collectImageCandidates(html, sourceUrl = '', context = {}) {
  const values = []
  for (const item of sourceSpecificPhotoCandidates(html, sourceUrl)) add(values, item.url, item.method, sourceUrl, item)
  for (const item of sourceSpecificImages(html, sourceUrl)) add(values, item.url, item.method, sourceUrl, item)
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
      add(values, source, `img:${attrName}`, sourceUrl, { alt: attr(tag, 'alt'), nearbyText: nearbyText(html, tag) })
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

function add(values, value, method, base, extra = {}) {
  const resolved = absoluteUrl(value, base)
  if (resolved) values.push({ url: resolved, method, ...extra })
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

function hostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
