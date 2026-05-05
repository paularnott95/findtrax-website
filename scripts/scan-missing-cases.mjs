import { runScanner } from '../lib/missing-alerts-scanner.mjs'

const fixtureMode = process.env.SCANNER_FIXTURE_MODE === '1' || process.argv.includes('--fixtures')
const result = await runScanner({ fixtureMode })
console.log(`imported=${result.status.importedCount} publishable=${result.status.publishableCount} review=${result.status.reviewCount} skipped=${result.status.skippedCount} duplicates=${result.status.duplicateCount} errors=${result.status.errorCount}`)
if (result.status.notes?.length) console.log(result.status.notes.join('\n'))
