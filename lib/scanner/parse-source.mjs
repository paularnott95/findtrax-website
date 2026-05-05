export function parseFetchedSource(fetched) {
  const { source, body, url } = fetched
  if (!fetched.ok) return []
  if (source.parser === 'rss') return parseRss(body, source)
  if (source.parser === 'sitemap') return parseSitemap(body, source)
  return [parseHtmlCase(body, { ...source, sourceUrl: url })]
}

export function parseHtmlCase(html, source = {}) {
  const title = text(match(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || match(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i))
  const description = text(meta(html, 'description') || meta(html, 'og:description') || firstParagraph(html))
  const imageUrl = meta(html, 'og:image')
  return {
    title,
    name: source.name || '',
    summary: description,
    bodyText: text(html).slice(0, 5000),
    sourceName: source.sourceName || source.name,
    sourceUrl: source.sourceUrl || source.url,
    imageUrl,
    countryCode: source.countryCode,
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
