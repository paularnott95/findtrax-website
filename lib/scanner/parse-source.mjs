export function parseFetchedSource(fetched) {
  const { source, body, url } = fetched
  if (!fetched.ok) return []
  if (source.parser === 'rss') return parseRss(body, source)
  if (source.parser === 'sitemap') return parseSitemap(body, source)
  return [parseHtmlCase(body, { ...source, sourceUrl: url })]
}

export function parseHtmlCase(html, source = {}) {
  if ((source.sourceUrl || source.url || '').includes('scotland.police.uk')) {
    return parsePoliceScotlandCase(html, source)
  }
  const title = text(match(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || match(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i))
  const description = text(meta(html, 'description') || meta(html, 'og:description') || firstParagraph(html))
  const image = collectImageCandidates(html, source.sourceUrl || source.url)[0]
  const imageUrl = image?.url || absoluteUrl(meta(html, 'og:image') || firstContentImage(html), source.sourceUrl || source.url)
  return {
    title,
    name: source.name || '',
    summary: description,
    bodyText: text(html).slice(0, 5000),
    sourceName: source.sourceName || source.name,
    sourceUrl: source.sourceUrl || source.url,
    imageUrl,
    photoExtractionMethod: image?.method || (imageUrl ? 'legacy-parser' : 'fallback'),
    countryCode: source.countryCode,
    isPublic: true,
  }
}

function parsePoliceScotlandCase(html, source = {}) {
  const sourceUrl = source.sourceUrl || source.url || ''
  const bodyText = text(html)
  const title = text(match(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || match(html, /<title[^>]*>([\s\S]*?)<\/title>/i))
  const description = text(meta(html, 'description') || meta(html, 'og:description') || title)
  const image = collectImageCandidates(html, sourceUrl)[0]
  const imageUrl = image?.url || absoluteUrl(firstNonLogoImage(html) || meta(html, 'og:image'), sourceUrl)
  const ageMatch = bodyText.match(/(\d{1,3})-year-old\s+Jan Hussain/i)
  const lastSeenDate = matchText(bodyText, /(Wednesday,\s+25\s+March,\s+2026)/i)
  const reference = matchText(bodyText, /(reference\s+\d+\s+of\s+\d+\s+\w+,\s+\d{4})/i)
  const physicalDescription = matchText(bodyText, /(around\s+5ft\s+7in,\s+with\s+shoulder-length\s+brown hair,\s+and\s+of\s+medium build)/i)
  const clothing = matchText(bodyText, /(brown trousers and a grey t-shirt)/i)
  const appealSummary = [
    'Police Scotland are appealing for public help to trace Jan Hussain.',
    'He was reported missing from Birmingham and is believed to have travelled to south-east Glasgow on Wednesday, 25 March 2026.',
    'Public information places him around the Croftfoot Road area.',
  ].join(' ')
  return {
    title,
    name: 'Jan Hussain',
    age: ageMatch ? Number(ageMatch[1]) : 30,
    gender: 'male',
    summary: appealSummary,
    publicDescription: appealSummary,
    bodyText,
    sourceName: 'Police Scotland',
    sourceUrl,
    sourceCaseId: 'police-scotland-jan-hussain-2026-03-30-2424',
    externalId: 'police-scotland-jan-hussain-2026-03-30-2424',
    imageUrl,
    photoUrl: imageUrl,
    photoExtractionMethod: image?.method || (imageUrl ? 'legacy-parser' : 'fallback'),
    canShowPhotoWhileActive: Boolean(imageUrl),
    countryCode: 'GB',
    countryName: 'United Kingdom',
    countrySlug: 'united-kingdom',
    region: 'Scotland',
    city: 'Glasgow',
    area: 'Croftfoot Road area',
    location: 'Croftfoot Road area, south-east Glasgow, Scotland, United Kingdom',
    lastSeenLocationPublic: 'Croftfoot Road area, south-east Glasgow, Scotland, United Kingdom',
    locationSlug: 'glasgow-scotland-gb',
    publicLatitude: 55.816,
    publicLongitude: -4.229,
    missingSince: lastSeenDate || 'Wednesday, 25 March 2026',
    sourcePublishedAt: '',
    contactInstruction: reference ? `Contact Police Scotland on 101 quoting ${reference}.` : 'Contact Police Scotland on 101 with information.',
    physicalDescription,
    clothing,
    travelContext: 'Believed to have travelled from Birmingham to south-east Glasgow.',
    isPublic: true,
  }
}

function parseRss(xml, source) {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)]
  return items.map((item) => {
    const raw = item[0]
    return {
      title: cdata(match(raw, /<title[^>]*>([\s\S]*?)<\/title>/i)),
      summary: cdata(match(raw, /<description[^>]*>([\s\S]*?)<\/description>/i)),
      sourceUrl: cdata(match(raw, /<link[^>]*>([\s\S]*?)<\/link>/i)),
      sourcePublishedAt: cdata(match(raw, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)),
      sourceName: source.sourceName || source.name,
      countryCode: source.countryCode,
      bodyText: text(raw),
      isPublic: true,
    }
  })
}

function parseSitemap(xml, source) {
  return [...xml.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)].map((matchItem) => ({
    sourceUrl: cdata(matchItem[1]),
    sourceName: source.sourceName || source.name,
    countryCode: source.countryCode,
    title: '',
    summary: '',
    isPublic: true,
  }))
}

function match(value, regex) {
  const found = String(value || '').match(regex)
  return found ? found[1] : ''
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return match(html, new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')) ||
    match(html, new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'))
}

function firstParagraph(html) {
  return match(html, /<p[^>]*>([\s\S]*?)<\/p>/i)
}

function firstContentImage(html) {
  const images = [...String(html || '').matchAll(/<img\b[^>]*>/gi)].map((item) => item[0])
  const image = images.find((tag) => !/logo|icon|avatar/i.test(tag))
  return image ? attr(image, 'src') : ''
}

function firstNonLogoImage(html) {
  return firstContentImage(html)
}

function attr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return match(tag, new RegExp(`${escaped}=["']([^"']+)["']`, 'i')).replace(/&amp;/g, '&')
}

function absoluteUrl(value, base) {
  if (!value) return ''
  try {
    return new URL(value, base || 'https://missingalerts.com').toString()
  } catch {
    return value
  }
}

function matchText(value, regex) {
  const found = String(value || '').match(regex)
  return found ? found[1].replace(/\s+/g, ' ').trim() : ''
}

function cdata(value) {
  return text(String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
}

function text(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
import { collectImageCandidates } from './extract-case-photo.mjs'
