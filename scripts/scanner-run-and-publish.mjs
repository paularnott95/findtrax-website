import { runScanner } from '../lib/missing-alerts-scanner.mjs'
import { publishCasesToShopify } from '../lib/scanner/shopify-publisher.mjs'
import { writeFile } from 'node:fs/promises'

const scanner = await runScanner()
const publisher = await publishCasesToShopify(scanner.publishable)
await writeFile('data/scanner-publish-report.json', `${JSON.stringify({ at: new Date().toISOString(), ...publisher }, null, 2)}\n`)
console.log(`imported=${scanner.status.importedCount} publishable=${scanner.status.publishableCount} shopifyPublished=${publisher.published.length} publishErrors=${publisher.errors.length}`)
for (const error of publisher.errors) console.log(`error=${error.reason}`)
