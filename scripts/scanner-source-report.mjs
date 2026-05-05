import { writeFile } from 'node:fs/promises'

import { scannerSourceReport } from '../lib/missing-alerts-scanner.mjs'

const report = await scannerSourceReport()
await writeFile('data/scanner-source-report.json', `${JSON.stringify(report, null, 2)}\n`)
console.log(`sources=${report.total} enabled=${report.enabled} countries=${report.countries.join(',')}`)
