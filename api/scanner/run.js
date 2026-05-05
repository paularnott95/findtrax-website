export default function handler(req, res) {
  const configured = Boolean(process.env.SCANNER_ADMIN_SECRET)
  const provided = req.headers['x-scanner-admin-secret'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!configured || provided !== process.env.SCANNER_ADMIN_SECRET) {
    return res.status(401).json({ ok: false, error: 'Scanner mutation requires SCANNER_ADMIN_SECRET.' })
  }
  return res.status(202).json({ ok: true, message: 'Scanner run accepted. Use npm run scan in this static deployment to update source data.' })
}
