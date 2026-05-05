import status from '../../data/scanner-status.json' assert { type: 'json' }

export default function handler(req, res) {
  res.status(200).json({ ok: true, status })
}
