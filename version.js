import { ensureSchema, sql } from './_lib/db.js'
import { wrap } from './_lib/auth.js'

export default wrap(async (req, res) => {
  await ensureSchema()
  const rows = await sql`select version from meta where project_id = ${req.query.projectId}`
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ version: rows[0]?.version ?? 0 })
})
