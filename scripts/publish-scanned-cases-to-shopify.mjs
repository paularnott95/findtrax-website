import { readFile, writeFile } from 'node:fs/promises'

import { publishCasesToShopify } from '../lib/scanner/shopify-publisher.mjs'

const dryRun = process.argv.includes('--dry-run')
const records = JSON.parse(await readFile('data/scanned-cases-published.json', 'utf8').catch(() => '[]'))
const result = await publishCasesToShopify(records, { dryRun })
await writeFile('data/scanner-publish-report.json', `${JSON.stringify({ at: new Date().toISOString(), dryRun, ...result }, null, 2)}\n`)
console.log(`shopifyPublishReady=${result.ok} published=${result.published.length} errors=${result.errors.length} dryRun=${dryRun}`)
for (const error of result.errors) console.log(`error=${error.reason}`)
