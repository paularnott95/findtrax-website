import { runScanner } from '../../lib/missing-alerts-scanner.mjs'

export default function handler(req, res) {
  const configured = Boolean(process.env.SCANNER_ADMIN_SECRET)
  const provided = req.headers['x-scanner-admin-secret'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!configured || provided !== process.env.SCANNER_ADMIN_SECRET) {
    return res.status(401).json({ ok: false, error: 'Scanner mutation requires SCANNER_ADMIN_SECRET.' })
  }
  return runScanner({ noWrite: true })
    .then((result) => res.status(200).json({ ok: true, status: result.status, message: 'Scanner run completed in the serverless runtime. Use scheduled CLI publishing for persistent report commits and Shopify publishing.' }))
    .catch((error) => res.status(500).json({ ok: false, error: error.message }))
}
