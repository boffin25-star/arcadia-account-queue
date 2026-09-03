import { ensureSchema, seedProject, loadState, sql } from './_lib/db.js'
import { wrap } from './_lib/auth.js'

export default wrap(async (req, res) => {
  await ensureSchema()
  if (req.method === 'GET') {
    const rows = await sql`select id, name, sort_order from projects where active order by sort_order, created_at`
    return res.status(200).json({ projects: rows })
  }
  if (req.method !== 'POST') return res.status(405).end()
  const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const name = String(b.name || '').trim()
  if (!name) return res.status(400).json({ error: 'name required' })
  const [{ next }] = await sql`select coalesce(max(sort_order), -1) + 1 as next from projects`
  let project
  try { [project] = await sql`insert into projects (name, sort_order) values (${name}, ${next}) returning id, name, sort_order` }
  catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'A project with that name already exists.' }); throw e }
  const source = b.copyFromProjectId ? await loadState(b.copyFromProjectId) : null
  await seedProject(project.id, source)
  res.status(200).json({ project })
})
