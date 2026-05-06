const MIN_BYTES = 2500
const MIN_DIMENSION = 180

export async function validatePhotoUrl(url, options = {}) {
  const target = String(url || '').trim()
  if (!target) return rejected('missing-url')
  if (/\.svg(?:\?|$)/i.test(target) && !options.allowSvg) return rejected('svg-not-allowed')

  try {
    const response = await fetch(target, {
      method: 'GET',
      headers: {
        'user-agent': 'MissingAlertsScanner/1.0 (+https://missingalerts.com)',
        accept: 'image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(options.timeoutMs || 12000),
      redirect: 'follow',
    })
    const contentType = response.headers.get('content-type') || ''
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (!response.ok) return rejected(`http-${response.status}`)
    if (!contentType.toLowerCase().startsWith('image/')) return rejected('not-image-content-type', { contentType })
    if (contentLength && contentLength < MIN_BYTES) return rejected('tiny-file', { contentType, contentLength })

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length < MIN_BYTES) return rejected('tiny-file', { contentType, contentLength: buffer.length })
    const dimensions = imageDimensions(buffer, contentType)
    if (dimensions.width && dimensions.height && !options.allowSmall) {
      if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
        return rejected('tiny-dimensions', { contentType, contentLength: buffer.length, ...dimensions })
      }
      const ratio = Math.max(dimensions.width, dimensions.height) / Math.max(1, Math.min(dimensions.width, dimensions.height))
      if (ratio > 5) return rejected('extreme-aspect-ratio', { contentType, contentLength: buffer.length, ...dimensions })
    }
    return {
      ok: true,
      url: response.url || target,
      contentType,
      contentLength: buffer.length,
      width: dimensions.width,
      height: dimensions.height,
    }
  } catch (error) {
    return rejected(error instanceof Error ? error.message : 'image-fetch-error')
  }
}

function rejected(reason, extra = {}) {
  return { ok: false, reason, ...extra }
}

function imageDimensions(buffer, contentType) {
  if (/png/i.test(contentType) && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (/gif/i.test(contentType) && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
  }
  if (/webp/i.test(contentType) && buffer.length >= 30) {
    if (buffer.toString('ascii', 12, 16) === 'VP8X') {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      }
    }
  }
  if (/jpe?g/i.test(contentType)) return jpegDimensions(buffer)
  return { width: 0, height: 0 }
}

function jpegDimensions(buffer) {
  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) break
    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  return { width: 0, height: 0 }
}
