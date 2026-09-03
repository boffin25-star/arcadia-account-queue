import { ensureSchema, ensureDefaultProject, loadState, sql } from './_lib/db.js'
import { wrap } from './_lib/auth.js'

export default wrap(async (req, res) => {
  await ensureSchema()
  const projects = await sql`select id, name, sort_order from projects where active order by sort_order, created_at`
  const projectId = req.query.projectId && projects.some((p) => p.id === req.query.projectId)
    ? req.query.projectId : (projects[0]?.id || await ensureDefaultProject())
  const state = await loadState(projectId)
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ...state, projects: projects.length ? projects : [{ id: projectId, name: 'Account Queue' }] })
})
