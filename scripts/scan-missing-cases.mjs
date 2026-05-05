import { readFile, writeFile } from 'node:fs/promises'

import { scanFixtureCases } from '../lib/missing-alerts-scanner.mjs'

let result

if (process.env.SCANNER_FIXTURE_MODE === '1') {
  const fixtures = JSON.parse(await readFile('data/scanner-source-fixtures.json', 'utf8'))
  result = scanFixtureCases(fixtures)
} else {
  result = {
    imported: [],
    skipped: [],
    errors: [],
    notes: ['No live trusted scanner source is enabled. Configure approved public source feeds before production auto-import.'],
  }
}

const status = {
  lastScanAt: new Date().toISOString(),
  importedCount: result.imported.length,
  skippedCount: result.skipped.length,
  errorCount: result.errors.length,
  skipped: result.skipped,
  errors: result.errors,
  notes: result.notes || [],
  publishedPreview: result.imported,
}
await writeFile('data/scanner-status.json', `${JSON.stringify(status, null, 2)}\n`)
console.log(`imported=${status.importedCount} skipped=${status.skippedCount} errors=${status.errorCount}`)
