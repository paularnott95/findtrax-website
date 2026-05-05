import { mkdir, rm, writeFile, copyFile } from 'node:fs/promises'
import path from 'node:path'

import { countries } from '../lib/missing-alerts-country-map.mjs'
import { activeCases, caseDetail, casesForCountry, foundSafeCases, loadCases } from '../lib/missing-alerts-cases.mjs'
import { getBoostedCases } from '../lib/missing-alerts-boosts.mjs'

const dist = path.resolve('dist')
const siteUrl = 'https://missingalerts.com'
const tools = [
  {
    slug: 'findtrax',
    name: 'FindTrax',
    type: 'Search coordination',
    title: 'FindTrax is a Missing Alerts app for search coordination.',
    body: 'FindTrax helps Missing Alerts teams organise searches around a live case without scattering information across chats, spreadsheets, and social posts.',
    features: ['Search area planning','Map-based zones','Route and coverage tracking','Volunteer assignments','Sighting intake','Tip prioritisation','Timeline updates','Location notes','Team coordination','Field status updates','Case-linked search logs','Alert-ready summaries','Offline-aware search notes','Public/private visibility controls','Command overview'],
    workflow: ['Link the active Missing Alerts case','Define search zones and routes','Assign volunteers and log field status','Turn search logs into alert-ready summaries'],
  },
  {
    slug: 'intelpro',
    name: 'IntelPro',
    type: 'Case intelligence',
    title: 'IntelPro is a Missing Alerts case-intelligence workspace.',
    body: 'IntelPro keeps complex missing-person case information organised, reviewable, and ready for professional handover.',
    features: ['Case dashboard','Person profiles','Lead management','Evidence/file organisation','Timeline builder','Location tracking','Contact logs','Notes and tasking','Relationship mapping','Document storage','Priority flags','Investigator-ready summaries','Secure collaboration','Case review status','Audit trail where supported','Public-field approval controls'],
    workflow: ['Create the case dashboard','Organise leads and locations','Review documents, contacts and timeline','Prepare investigator-ready summaries'],
  },
  {
    slug: 'mediareach',
    name: 'MediaReach',
    type: 'Media and outreach',
    title: 'MediaReach is a Missing Alerts outreach and media visibility app.',
    body: 'MediaReach helps Missing Alerts publish controlled, accurate public appeals without exposing private investigation details.',
    features: ['Press-ready case summaries','Public appeal builder','Media kit creation','Social post templates','Alert signup campaigns','Update publishing workflow','Verified information blocks','Contact call-to-action management','Shareable case pages','Outreach performance tracking','Partner/media contact organisation','Family-safe messaging controls','Public appeal approval flow','Takedown/close-case workflow'],
    workflow: ['Build a verified public appeal','Prepare press and social assets','Publish controlled updates','Close or take down appeals when status changes'],
  },
]

await rm(dist, { recursive: true, force: true })
await mkdir(path.join(dist, 'assets'), { recursive: true })
await copyFile('src/styles/main.css', path.join(dist, 'assets/main.css'))

const rawCases = await loadCases()
const active = activeCases(rawCases)
const found = foundSafeCases(rawCases)
const boosted = getBoostedCases(rawCases)
const now = new Date().toISOString()

await page('index.html', homePage())
await page('missing/index.html', missingPage())
await page('found-safe/index.html', foundSafePage())
await page('cases/index.html', casesIndex())
for (const [, , slug] of countries) {
  await page(`cases/${slug}/index.html`, countryCasesPage(slug))
  for (const item of casesForCountry(rawCases, slug)) {
    await page(`cases/${slug}/${item.slug}/index.html`, caseDetailPage(slug, item.slug))
  }
}
await page('tools/index.html', toolsPage())
for (const tool of tools) await page(`tools/${tool.slug}/index.html`, productPage(tool))
await page('scanner/index.html', scannerPage())
await page('private-control-access/index.html', privateAccessPage())
await page('dashboard/index.html', dashboardPage())
await page('support/index.html', simplePage('Support the Mission', 'Support helps Missing Alerts keep public alerts visible while preserving respectful case handling.'))
await page('advice-hub/index.html', simplePage('Advice Hub', 'Practical, source-backed guidance for reporting, sharing and organising missing-person information.'))
await page('member-area/index.html', privateAccessPage('Member Area'))
await page('pro-area/index.html', privateAccessPage('Pro Area'))
await page('404.html', simplePage('Page not found', 'Use the Missing Alerts navigation to continue.'))
await writeFile(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /dashboard\nDisallow: /api/\nSitemap: ${siteUrl}/sitemap.xml\n`)
await writeFile(path.join(dist, 'sitemap.xml'), sitemap())

async function page(file, html) {
  const full = path.join(dist, file)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, html)
}

function layout(title, description, body, canonical = '/') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${siteUrl}${canonical}"><link rel="stylesheet" href="/assets/main.css"></head><body><div class="topbar">LIVE MISSING ALERTS — PLEASE SHARE ACTIVE CASES</div>${header()}<main>${body}</main>${footer()}<script>${signupScript()}</script></body></html>`
}

function header() {
  return `<header class="site-header"><div class="nav-wrap"><a class="brand" href="/">MISSINGALERTS.COM</a><div class="selectors"><span class="pill">Country: Global</span><span class="pill">Language: English</span></div><nav class="main-nav"><a href="/">Home</a><a href="/missing">Missing</a><a href="/found-safe">Found Safe</a><a href="/advice-hub">Advice Hub</a><span class="tools-menu"><span>Tools</span><div><a href="/tools">Tools overview</a><a href="/tools/findtrax">FindTrax</a><a href="/tools/intelpro">IntelPro</a><a href="/tools/mediareach">MediaReach</a></div></span><a href="/support">Support</a><a href="/member-area">Member Area</a><a href="/pro-area">Pro Area</a><a href="/private-control-access">Login</a></nav></div></header>`
}

function footer() {
  return `<footer class="footer"><div class="container"><div><strong>MISSINGALERTS.COM</strong><p>Public missing-person visibility with source attribution, duplicate prevention, safe found-safe updates and professional tools.</p></div><div><a href="/missing">Missing</a><a href="/found-safe">Found Safe</a><a href="/cases">Cases</a><a href="/tools">Tools</a><a href="/scanner">Scanner</a><a href="/dashboard">Dashboard</a></div></div></footer>`
}

function homePage() {
  const featured = active[0]
  return layout('Missing Alerts | Public Missing-Person Alerts', 'Browse verified public missing-person alerts, boosted appeals, found-safe updates and Missing Alerts tools.', `
    <section class="hero"><div class="container hero-grid"><div><p class="eyebrow">Missing Alerts</p><h1 class="h1">Verified public missing-person alerts, organised by country.</h1><p class="lead">Missing Alerts helps people share source-backed active cases, protect found-safe privacy, and connect serious searches with tools such as FindTrax, IntelPro and MediaReach.</p><div class="actions"><a class="btn primary" href="/missing">View active missing cases</a><a class="btn ghost" href="/cases">Browse by country</a><a class="btn ghost" href="/tools">Open Tools</a></div></div><div class="panel"><div class="map-preview"><div class="zone z1">Latest Verified</div><div class="zone z2">Priority Cases</div><div class="zone z3">Found Safe Protected</div></div></div></div></section>
    <section class="section"><div class="container layout-with-sidebar"><div>
      ${sectionHead('Featured Case', 'A source-backed public case highlighted for visibility.')}
      ${featured ? caseCard(featured) : empty('No featured public case is available.')}
      ${sectionHead('Featured Selection', 'Country-aware public appeals selected from verified sources.')}
      <div class="grid cards-3">${active.slice(0,3).map(caseCard).join('')}</div>
      ${sectionHead('Boosted Appeals', 'Active boosts receive priority while the case remains public and missing.')}
      <div class="boosted-appeals">${boosted.length ? boosted.map(caseCard).join('') : empty('No boosted appeals are live right now.')}</div>
      ${sectionHead('Latest Verified Cases', 'Active, urgent and long-term public cases only.')}
      <div class="grid cards-3">${active.slice(0,6).map(caseCard).join('')}</div>
      ${sectionHead('Found Safe Updates', 'Resolved updates with protected imagery by default.')}
      <div class="grid cards-3">${found.map((item) => caseCard(item, 'found-card')).join('')}</div>
      ${newsletter()}
      ${supportMission()}
    </div>${boostSidebar()}</div></section>
  `)
}

function missingPage() {
  return layout('Missing People | Missing Alerts', 'Active public missing-person cases only.', `<section class="section"><div class="container">${sectionHead('Missing', 'Active, urgent and long-term public cases.')}<div class="grid cards-3">${active.map(caseCard).join('')}</div></div></section>`, '/missing')
}

function foundSafePage() {
  return layout('Found Safe Updates | Missing Alerts', 'Privacy-safe found-safe and resolved updates.', `<section class="section"><div class="container">${sectionHead('Found Safe Updates', 'Resolved updates hide identifying photos by default.')}<div class="grid cards-3">${found.map((item) => caseCard(item, 'found-card')).join('')}</div></div></section>`, '/found-safe')
}

function casesIndex() {
  return layout('Cases by Country | Missing Alerts', 'Browse public active cases by country.', `<section class="section"><div class="container">${sectionHead('Cases', 'Country filters and latest public active cases.')}<div class="grid cards-3">${countries.map(([code,name,slug])=>`<a class="card" href="/cases/${slug}"><h3>${name}</h3><p>${casesForCountry(rawCases, slug).length} active public cases</p></a>`).join('')}</div><h2>Latest public active cases</h2><div class="grid cards-3">${active.map(caseCard).join('')}</div></div></section>`, '/cases')
}

function countryCasesPage(slug) {
  const country = countries.find(([, , itemSlug]) => itemSlug === slug)
  const list = casesForCountry(rawCases, slug)
  return layout(`${country[1]} Missing Person Alerts | Missing Alerts`, `Public active missing-person alerts for ${country[1]}.`, `<section class="section"><div class="container">${sectionHead(`${country[1]} cases`, 'Public active cases only.')}<div class="grid cards-3">${list.length ? list.map(caseCard).join('') : empty('No public active cases are currently published for this country.')}</div></div></section>`, `/cases/${slug}`)
}

function caseDetailPage(countrySlug, caseSlug) {
  const item = caseDetail(rawCases, countrySlug, caseSlug)
  if (!item) return layout('Case not available | Missing Alerts', 'This case is not available as a public active case.', `<section class="section"><div class="container">${empty('This case is not available as a public active case.')}</div></section>`)
  return layout(`${item.name} | Missing Alerts`, item.shortSummary, `<section class="section"><div class="container"><article class="card"><h1>${esc(item.name)}</h1>${caseVisual(item)}<p><strong>Country:</strong> ${item.countryName}</p><p><strong>Region:</strong> ${esc(item.region)}</p><p><strong>Missing since:</strong> ${esc(item.missingSince)}</p><p><strong>Last seen:</strong> ${esc(item.lastSeenLocationPublic)}</p><p>${esc(item.publicDescription)}</p><p><strong>Contact:</strong> ${esc(item.contactInstruction)}</p><p class="source">Source: <a href="${item.sourceUrl}">${esc(item.sourceName)}</a></p><p>This page uses public source information only.</p></article></div></section>`, `/cases/${countrySlug}/${caseSlug}`)
}

function toolsPage() {
  return layout('Tools | Missing Alerts', 'Missing Alerts apps for search coordination, case intelligence and outreach.', `<section class="hero"><div class="container"><p class="eyebrow">Missing Alerts Tools</p><h1 class="h1">FindTrax, IntelPro and MediaReach are Missing Alerts apps.</h1><p class="lead">Professional tools for live search coordination, case intelligence and controlled public outreach.</p></div></section><section class="section"><div class="container"><div class="grid cards-3">${tools.map(tool=>`<a class="card" href="/tools/${tool.slug}"><h3>${tool.name}</h3><p>${tool.body}</p></a>`).join('')}</div></div></section>`, '/tools')
}

function productPage(tool) {
  return layout(`${tool.name} | Missing Alerts Tools`, tool.body, `<section class="hero"><div class="container hero-grid"><div><p class="eyebrow">${tool.type}</p><h1 class="h1">${tool.title}</h1><p class="lead">${tool.body}</p><div class="actions"><a class="btn primary" href="#launch">Sign up for alerts here</a><a class="btn ghost" href="/tools">All tools</a></div></div>${productVisual(tool)}</div></section><section class="section"><div class="container">${sectionHead('Complete features', `${tool.name} supports the full workflow.`)}<div class="grid cards-4">${tool.features.map((f)=>`<div class="card"><h3>${f}</h3></div>`).join('')}</div></div></section><section class="section dark"><div class="container">${sectionHead('Workflow', 'From case context to controlled action.')}<div class="grid cards-4">${tool.workflow.map((f,i)=>`<div class="card"><h3>Step ${i+1}</h3><p>${f}</p></div>`).join('')}</div></div></section><section class="section"><div class="container">${sectionHead('Security, privacy and trust', 'Designed for careful missing-person workflows.')}<div class="grid cards-3"><div class="card"><p>Public and private case information stay separated.</p></div><div class="card"><p>Approval workflows reduce accidental disclosure.</p></div><div class="card"><p>Source-backed summaries keep outreach factual.</p></div></div></div></section><section id="launch" class="section dark"><div class="container" style="text-align:center"><p class="eyebrow">${tool.name}</p><h2>Coming July 1st 2026</h2><p>Join the Missing Alerts product update list.</p>${signupForm(tool.name)}</div></section>`, `/tools/${tool.slug}`)
}

function scannerPage() {
  return layout('Scanner | Missing Alerts', 'Scanner status, configured source logic and protected import workflow.', `<section class="section"><div class="container">${sectionHead('Scanner', 'Verified public case import status.')}<div class="card"><button class="btn dark" type="button">Scan button requires dashboard secret</button><p>Country selector: United Kingdom, Ireland, Australia, New Zealand, United States, Canada.</p><p>Source selector: official public sources and approved feeds only.</p><table class="scan-table"><tr><th>Status</th><td>Ready</td></tr><tr><th>Imported</th><td>${active.length}</td></tr><tr><th>Skipped</th><td>Found-safe, duplicate and unverified records are skipped.</td></tr></table></div></div></section>`, '/scanner')
}

function privateAccessPage(title = 'Private Control Access') {
  return layout(title, 'Private Missing Alerts access route.', `<section class="section"><div class="container"><div class="dashboard-box"><h1>${title}</h1><p>This route is for protected Missing Alerts dashboard access. Public pages are available without login; dashboard and scanner mutations require authorized access.</p><a class="btn dark" href="/">Return home</a></div></div></section>`, '/private-control-access')
}

function dashboardPage() {
  return layout('Dashboard | Missing Alerts', 'Protected dashboard route check.', `<section class="section"><div class="container"><div class="dashboard-box"><h1>Missing Alerts Dashboard</h1><p>Dashboard route loaded. In production this area should be protected by the platform control access layer.</p><p>Scanner mutations require SCANNER_ADMIN_SECRET.</p></div></div></section>`, '/dashboard')
}

function simplePage(title, body) {
  return layout(`${title} | Missing Alerts`, body, `<section class="section"><div class="container"><h1>${title}</h1><p>${body}</p></div></section>`)
}

function sectionHead(eyebrow, title) {
  return `<p class="eyebrow">${eyebrow}</p><h2>${title}</h2>`
}

function caseCard(item, extraClass = '') {
  const href = item.publicStatus === 'missing' ? `/cases/${item.countrySlug}/${item.slug}` : '/found-safe'
  return `<article class="card case-card ${extraClass}">${caseVisual(item)}<span class="status">${esc(item.status)}</span><h3>${esc(item.name)}</h3><p>${esc(item.shortSummary)}</p><p><strong>${item.countryName}</strong>${item.region ? ` — ${esc(item.region)}` : ''}</p><a class="btn dark" href="${href}">${item.publicStatus === 'missing' ? 'View case' : 'View update'}</a></article>`
}

function caseVisual(item) {
  if (item.publicPhotoUrl) return `<img class="case-visual" src="${item.publicPhotoUrl}" alt="${esc(item.name)} public source image">`
  return `<div class="case-visual privacy-visual">${esc(item.image?.label || 'Missing Alert')}</div>`
}

function boostSidebar() {
  const selected = boosted[0]
  return `<aside class="boost-sidebar"><h2>Boost Sidebar</h2><p>Live priority visibility for active public cases.</p>${selected ? `<h3>${esc(selected.name)}</h3><p>${esc(selected.shortSummary)}</p><div class="metric"><span>Status</span><span>Active boost</span></div><div class="metric"><span>Priority score</span><span>${selected.boost.points}</span></div><a class="btn primary" href="/support">Support boost</a>` : '<p>No active boosted case selected.</p>'}<p>Boosted cases appear first while boosts are live. Expired boosts and resolved cases are removed from active priority placement.</p></aside>`
}

function newsletter() {
  return `<section class="card"><h2>Missing person alerts</h2><p>Sign up for respectful public alert updates.</p>${signupForm('Missing Alerts')}</section>`
}

function supportMission() {
  return `<section class="card"><h2>Support the Mission</h2><p>Support keeps verified public alerts visible and helps maintain privacy-safe case handling.</p><a class="btn primary" href="/support">Support Missing Alerts</a></section>`
}

function productVisual(tool) {
  return `<div class="product-visual" aria-label="${tool.name} UI preview"><div class="ui-block" style="left:7%;top:10%;right:45%">Case linked workspace</div><div class="ui-block" style="right:7%;top:28%;left:45%">Priority queue</div><div class="ui-block" style="left:12%;bottom:14%;right:12%">Secure Missing Alerts workflow preview</div></div>`
}

function signupForm(product) {
  return `<form class="signup" data-product="${product}"><input name="email" type="email" placeholder="you@example.com" required><input type="hidden" name="productInterest" value="${product}"><button class="btn primary" type="submit">Sign up for alerts here</button><p class="notice" aria-live="polite"></p></form>`
}

function signupScript() {
  return `document.querySelectorAll('.signup').forEach(function(form){form.addEventListener('submit',async function(e){e.preventDefault();var email=form.email.value.trim();var notice=form.querySelector('.notice');if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){notice.textContent='Please enter a valid email address.';return;}try{var res=await fetch('/api/tool-alert-signups',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email,productInterest:form.productInterest.value})});if(!res.ok)throw new Error('bad');notice.textContent='You’re on the list. We’ll send product updates before launch.';form.reset();}catch(err){notice.textContent='Please enter a valid email address.';}})})`
}

function empty(text) {
  return `<div class="empty">${text}</div>`
}

function sitemap() {
  const urls = ['/', '/missing', '/found-safe', '/cases', '/tools', '/tools/findtrax', '/tools/intelpro', '/tools/mediareach', '/scanner']
  for (const [, , slug] of countries) urls.push(`/cases/${slug}`)
  for (const item of active) urls.push(`/cases/${item.countrySlug}/${item.slug}`)
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url)=>`<url><loc>${siteUrl}${url}</loc><lastmod>${now}</lastmod></url>`).join('')}</urlset>`
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char])
}
