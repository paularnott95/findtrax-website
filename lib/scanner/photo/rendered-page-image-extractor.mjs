export async function collectRenderedImageCandidates(sourceUrl, options = {}) {
  if (process.env.SCANNER_ENABLE_RENDERED_IMAGE_EXTRACTION !== 'true') {
    return { enabled: false, candidates: [], reason: 'rendered-extraction-disabled' }
  }
  try {
    const playwright = await import('playwright')
    const browser = await playwright.chromium.launch({ headless: true })
    const page = await browser.newPage({ userAgent: 'MissingAlertsScanner/1.0 (+https://missingalerts.com)' })
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs || 15000 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await page.waitForTimeout(800)
    const candidates = await page.evaluate(() => {
      const visible = (element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        return rect.width >= 120 && rect.height >= 120 && style.visibility !== 'hidden' && style.display !== 'none'
      }
      const images = Array.from(document.images).filter(visible).map((image) => ({
        url: image.currentSrc || image.src,
        method: 'rendered-browser:img',
        alt: image.alt || '',
        nearbyText: image.closest('article,main,section,figure')?.textContent?.slice(0, 600) || '',
      }))
      const backgrounds = Array.from(document.querySelectorAll('article *, main *, figure *, section *')).flatMap((element) => {
        if (!visible(element)) return []
        const bg = window.getComputedStyle(element).backgroundImage || ''
        const match = bg.match(/url\\([\"']?(.*?)[\"']?\\)/)
        return match ? [{ url: match[1], method: 'rendered-browser:background', alt: '', nearbyText: element.textContent?.slice(0, 600) || '' }] : []
      })
      return [...images, ...backgrounds]
    })
    await browser.close()
    return { enabled: true, candidates }
  } catch (error) {
    return { enabled: true, candidates: [], reason: error instanceof Error ? error.message : 'rendered-extraction-failed' }
  }
}
