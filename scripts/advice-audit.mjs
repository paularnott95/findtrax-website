import { mkdir, readFile, writeFile } from 'node:fs/promises'

const seoAudit = JSON.parse(await readFile('data/seo-page-audit.json', 'utf8'))
const advicePages = seoAudit.pages.filter((page) => page.url.includes('/missing-person-advice') || page.template.includes('advice'))

const duplicateGroups = new Map()
for (const page of advicePages) {
  if (!page.duplicateGroup) continue
  if (!duplicateGroups.has(page.duplicateGroup)) duplicateGroups.set(page.duplicateGroup, [])
  duplicateGroups.get(page.duplicateGroup).push(page.url)
}

const audit = {
  generatedAt: new Date().toISOString(),
  totalAdvicePagesSampled: advicePages.length,
  duplicateGroups: Array.from(duplicateGroups.entries()).map(([group, urls]) => ({ group, urls })),
  pages: advicePages.map((page) => ({
    url: page.url,
    title: page.title,
    wordCount: page.wordCount,
    duplicateGroup: page.duplicateGroup,
    action: classifyAdvicePage(page),
    issues: page.issues,
    canonicalTarget: page.duplicateGroup ? '/pages/missing-person-advice' : page.canonical,
    missingImages: page.issues.includes('thin-content'),
    brokenLinks: page.issues.includes('empty-links')
  }))
}

await mkdir('data', { recursive: true })
await writeFile('data/advice-blog-audit.json', JSON.stringify(audit, null, 2))
console.log('Advice audit wrote data/advice-blog-audit.json')

function classifyAdvicePage(page) {
  if (page.issues.includes('thin-content')) return 'rewrite-or-noindex'
  if (page.duplicateGroup) return 'merge-or-canonicalize'
  if (page.issues.includes('missing-meta-description') || page.issues.includes('missing-title')) return 'enrich-metadata'
  return 'keep-and-monitor'
}
