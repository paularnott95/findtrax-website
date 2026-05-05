import { appendFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const validProducts = new Set(['FindTrax', 'IntelPro', 'MediaReach', 'Missing Alerts'])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false })
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const email = String(body.email || '').trim().toLowerCase()
  const productInterest = String(body.productInterest || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validProducts.has(productInterest)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' })
  }
  const record = { email, productInterest, createdAt: new Date().toISOString(), source: 'missing-alerts-website' }
  if (process.env.TOOL_ALERT_SIGNUP_WEBHOOK_URL) {
    const response = await fetch(process.env.TOOL_ALERT_SIGNUP_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(record),
    })
    if (!response.ok) return res.status(502).json({ ok: false })
    return res.status(200).json({ ok: true, providerConfigured: true })
  }
  await appendFile(path.join(tmpdir(), 'missing-alerts-tool-alert-signups.jsonl'), `${JSON.stringify(record)}\n`)
  return res.status(200).json({ ok: true, providerConfigured: false })
}
