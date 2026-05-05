import { readFile, writeFile } from 'node:fs/promises'

import { importOfficialUrl } from '../lib/missing-alerts-scanner.mjs'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index]
  if (arg.startsWith('--')) args.set(arg.slice(2), process.argv[index + 1] && !process.argv[index + 1].startsWith('--') ? process.argv[++index] : true)
}

const file = args.get('file')
if (!file) {
  console.error('Usage: npm run scanner:import-batch -- --file data/official-url-batch.json [--publish]')
  process.exit(1)
}

const publish = Boolean(args.get('publish'))
const items = JSON.parse(await readFile(file, 'utf8'))
const results = []

for (const item of items) {
  if (!item?.url || !item?.countryCode) {
    results.push({ ok: false, reason: 'missing-url-or-countryCode', item })
    continue
  }
  try {
    const result = await importOfficialUrl({ url: item.url, countryCode: item.countryCode, publish })
    results.push({ ok: true, url: item.url, countryCode: item.countryCode, publishable: result.publishable, published: Boolean(result.published?.published?.length), case: result.case })
  } catch (error) {
    results.push({ ok: false, url: item.url, countryCode: item.countryCode, reason: error.message })
  }
}

await writeFile('data/scanner-import-batch-report.json', `${JSON.stringify({ at: new Date().toISOString(), publish, results }, null, 2)}\n`)
const published = results.filter((item) => item.published).length
const failed = results.filter((item) => !item.ok).length
console.log(`batch=${results.length} published=${published} failed=${failed} publish=${publish}`)
