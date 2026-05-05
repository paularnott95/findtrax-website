import { writeFile } from 'node:fs/promises'

import { importOfficialUrl } from '../lib/missing-alerts-scanner.mjs'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith('--')) {
    args.set(process.argv[index].slice(2), process.argv[index + 1] && !process.argv[index + 1].startsWith('--') ? process.argv[index + 1] : true)
  }
}

const url = args.get('url')
const country = args.get('country') || args.get('countryCode')
if (!url || !country) {
  console.error('Usage: npm run scanner:import-url -- --url <official-url> --country <GB|IE|AU|NZ|US|CA> [--publish]')
  process.exit(1)
}

const result = await importOfficialUrl({ url, countryCode: country, publish: Boolean(args.get('publish')) })
await writeFile('data/scanner-import-url-report.json', `${JSON.stringify(result, null, 2)}\n`)
console.log(`urlImported=${Boolean(result.case)} publishable=${result.publishable} published=${Boolean(result.published?.published?.length)}`)
