import { scannerHealthcheck } from '../lib/missing-alerts-scanner.mjs'

console.log(JSON.stringify(await scannerHealthcheck(), null, 2))
