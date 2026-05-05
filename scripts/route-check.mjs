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
  '/cases/united-kingdom/jan-hussain',
  '/cases/ireland/john-morgan',
  '/cases/australia/michael-vrankovic',
  '/cases/new-zealand/inna-waiheke',
  '/cases/united-states/breanna-letrice-carson',
  '/cases/canada/adam-donaldson',
  '/scanner',
  '/dashboard',
  '/private-control-access',
  '/sitemap.xml',
]

const baseUrl = process.env.ROUTE_CHECK_BASE_URL

if (baseUrl) {
  await checkRemote(baseUrl)
  if (process.exitCode) process.exit(process.exitCode)
  process.exit(0)
}

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

async function checkRemote(base) {
  const root = base.replace(/\/+$/, '')
  for (const route of routes) {
    const response = await fetch(`${root}${route}`, { redirect: 'follow' })
    const text = await response.text()
    const auth = /Authentication Required|Vercel Authentication/i.test(text)
    const hasMissingAlertsBrand = route === '/sitemap.xml' ? text.includes('missingalerts.com') : /MISSINGALERTS\.COM|Missing Alerts/.test(text)
    const forbidden = /findtrax-website|paularnott95\/findtrax-website|Repo:|Confirmed repo|Search Command HQ|920e56b|fix-missing-alerts-home-tools-scanner-cases/.test(text)
    console.log(`${response.status} ${route} auth=${auth ? 'yes' : 'no'} missing_alerts=${hasMissingAlertsBrand ? 'yes' : 'no'} forbidden=${forbidden ? 'yes' : 'no'}`)
    if (response.status !== 200 || auth || !hasMissingAlertsBrand || forbidden) process.exitCode = 1
  }
}
