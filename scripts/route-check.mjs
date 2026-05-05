import { existsSync, readdirSync } from 'node:fs'

const routes = [
  '/',
  '/missing',
  '/found-safe',
  '/tools',
  '/tools/findtrax',
  '/tools/intelpro',
  '/tools/mediareach',
  '/cases',
  '/cases/united-kingdom',
  '/cases/ireland',
  '/cases/australia',
  '/cases/new-zealand',
  '/cases/united-states',
  '/cases/canada',
  '/scanner',
  '/dashboard',
  '/private-control-access',
  '/sitemap.xml',
]

function fileFor(route) {
  if (route === '/') return 'dist/index.html'
  if (route.endsWith('.xml')) return `dist${route}`
  return `dist${route}/index.html`
}

for (const route of routes) {
  const file = fileFor(route)
  if (!existsSync(file)) {
    console.error(`route missing: ${route} -> ${file}`)
    process.exitCode = 1
  } else {
    console.log(`200 ${route}`)
  }
}

for (const country of ['united-kingdom', 'ireland', 'australia', 'new-zealand', 'united-states', 'canada']) {
  const dir = `dist/cases/${country}`
  const details = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : []
  if (!details.length) {
    console.error(`no case detail for ${country}`)
    process.exitCode = 1
  } else {
    console.log(`case detail ${country}/${details[0]}`)
  }
}

if (process.exitCode) process.exit(process.exitCode)
