import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

function assert(condition, message) {
  if (!condition) {
    console.error(`Validation failed: ${message}`)
    process.exitCode = 1
  }
}

const required = [
  'dist/index.html',
  'dist/missing/index.html',
  'dist/found-safe/index.html',
  'dist/tools/index.html',
  'dist/tools/findtrax/index.html',
  'dist/tools/intelpro/index.html',
  'dist/tools/mediareach/index.html',
  'dist/cases/index.html',
  'dist/cases/united-kingdom/index.html',
  'dist/cases/ireland/index.html',
  'dist/cases/australia/index.html',
  'dist/cases/new-zealand/index.html',
  'dist/cases/united-states/index.html',
  'dist/cases/canada/index.html',
  'dist/scanner/index.html',
  'dist/dashboard/index.html',
  'dist/sitemap.xml',
  'dist/robots.txt',
]

for (const file of required) assert(existsSync(file), `${file} exists`)

const home = readFileSync('dist/index.html', 'utf8')
assert(!home.includes('Failed to open page'), 'homepage does not contain Failed to open page')
assert(!home.includes('findtrax-website'), 'homepage does not expose repo name')
assert((home.match(/Boosted Appeals/g) || []).length === 1, 'homepage contains one Boosted Appeals heading')
assert(home.includes('Latest Verified Cases'), 'homepage has Latest Verified Cases')
assert(home.includes('Found Safe Updates'), 'homepage has Found Safe Updates')
assert(home.includes('Boost Sidebar'), 'homepage has boost sidebar')
assert(home.includes('Tools'), 'navigation includes Tools')
assert(!bodyWithoutHeaderNav(home).includes('FindTrax'), 'homepage body does not brand the site as FindTrax outside the Tools nav')

const found = readFileSync('dist/found-safe/index.html', 'utf8')
assert(found.includes('privacy protected visual') || found.includes('Found Safe'), 'found-safe uses protected visual')
assert(!found.includes('protected-found-safe-photo.jpg'), 'found-safe full photo URL is not exposed')

const sitemap = readFileSync('dist/sitemap.xml', 'utf8')
for (const path of ['/tools', '/tools/findtrax', '/tools/intelpro', '/tools/mediareach']) {
  assert(sitemap.includes(path), `sitemap includes ${path}`)
}
assert(!sitemap.includes('krystle-mcdonagh-found-safe'), 'sitemap excludes found-safe case detail')

const scanner = readFileSync('dist/scanner/index.html', 'utf8')
assert(scanner.includes('Live trusted source feeds are not connected yet'), 'scanner honestly reports live feeds are not connected')
assert(scanner.includes('Disabled - source feeds not connected'), 'scanner status is disabled without live feeds')
assert(!scanner.includes('<th>Imported</th><td>6</td>'), 'scanner does not claim live imports from seeded cases')

const cases = JSON.parse(readFileSync('data/missing-alerts-public-cases.json', 'utf8'))
for (const country of ['United Kingdom', 'Ireland', 'Australia', 'New Zealand', 'United States', 'Canada']) {
  assert(cases.some((item) => item.countryName === country && ['active', 'urgent', 'long-term'].includes(item.status)), `${country} has active public case`)
}

const forbidden = [
  'findtrax-website',
  'paularnott95/findtrax-website',
  'Repo:',
  'Confirmed repo',
  'fix-missing-alerts-home-tools-scanner-cases',
  '920e56b',
  'Search Command HQ',
]

for (const file of htmlFiles('dist')) {
  const html = readFileSync(file, 'utf8')
  for (const token of forbidden) assert(!html.includes(token), `${file} does not contain forbidden public text ${token}`)
  if (!file.includes(`${path.sep}tools${path.sep}`)) {
    assert(!bodyWithoutHeaderNav(html).includes('FindTrax'), `${file} contains FindTrax only in the Tools navigation`)
  }
}

if (process.exitCode) process.exit(process.exitCode)
console.log('content validation passed')

function htmlFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) files.push(...htmlFiles(full))
    else if (full.endsWith('.html')) files.push(full)
  }
  return files
}

function bodyWithoutHeaderNav(html) {
  return html
    .replace(/<header[\s\S]*?<\/header>/g, '')
    .replace(/<footer[\s\S]*?<\/footer>/g, '')
}
