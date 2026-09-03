export function checkAuth(req, res) {
  const expected = process.env.TEAM_PASSCODE
  if (!expected) { res.status(500).json({ error: 'TEAM_PASSCODE is not set on the server.' }); return false }
  const given = req.headers['x-team-key']
  if (given !== expected) { res.status(401).json({ error: 'Invalid team passcode.' }); return false }
  return true
}

export function wrap(handler) {
  return async (req, res) => {
    if (!checkAuth(req, res)) return
    try { await handler(req, res) }
    catch (e) { console.error(e); res.status(500).json({ error: e.message || 'Server error' }) }
  }
}
