import { mkdir, writeFile } from 'node:fs/promises'

export async function writeScannerReports(result) {
  await mkdir('data', { recursive: true })
  await writeJson('data/scanner-status.json', result.status)
  await writeJson('data/scanner-import-report.json', result.report)
  await writeJson('data/scanned-cases-published.json', result.publishable)
  await writeJson('data/scanned-cases-review.json', result.review)
  await writeJson('data/scanned-cases-skipped.json', result.skipped)
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}
