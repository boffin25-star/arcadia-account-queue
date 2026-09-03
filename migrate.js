// One-time import from the previous shared queue (Supabase). Runs server-side so the
// browser never talks to Supabase. Brandon supplies the OLD team passcode in the UI.
import { ensureSchema, seedProject, upsertQuery, bumpVersion, sql } from './_lib/db.js'
import { wrap } from './_lib/auth.js'

const OLD_URL = 'https://bhofebvgpsozpubefzvx.supabase.co'
const OLD_KEY = 'sb_publishable_624QdRrnhbA3Cyv4_eFTyQ_Fp8Sc-ES'

async function oldFetch(path, passcode) {
  const r = await fetch(`${OLD_URL}/rest/v1/${path}`, { headers: { apikey: OLD_KEY, Authorization: `Bearer ${OLD_KEY}`, 'x-team-key': passcode } })
  if (!r.ok) throw new Error(`Old queue rejected the request (${r.status}). Check the old passcode.`)
  return r.json()
}

export default wrap(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  await ensureSchema()
  const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const pass = String(b.oldPasscode || '')
  const oldProjects = await oldFetch('edi_queue_projects?select=*&active=is.true&order=sort_order', pass)
  if (!oldProjects.length) throw new Error('No projects found in the old queue.')

  const summary = []
  for (const op of oldProjects) {
    const q = (t) => oldFetch(`${t}?select=*&project_id=eq.${op.id}`, pass)
    const [members, items, notes, statuses, reasons, checklist, settings] = await Promise.all([
      q('edi_queue_team_members'), q('edi_queue_items'), q('edi_queue_item_notes'), q('edi_queue_statuses'),
      q('edi_queue_resolution_types'), q('edi_queue_checklist_items'), q('edi_queue_settings'),
    ])
    const s = Object.fromEntries(settings.map((r) => [r.key, r.value]))
    let [proj] = await sql`select id from projects where name = ${op.name}`
    if (!proj) [proj] = await sql`insert into projects (name, sort_order) values (${op.name}, ${op.sort_order || 0}) returning id`
    const pid = proj.id
    await seedProject(pid, {
      statuses: statuses.sort((a, b2) => a.sort_order - b2.sort_order).map((x) => ({ name: x.name, color: x.color, isTerminal: x.is_terminal, requiresReason: x.requires_reason, requiresChecklist: x.requires_checklist })),
      resolutionTypes: reasons.sort((a, b2) => a.sort_order - b2.sort_order).map((x) => x.name),
      checklistItems: checklist.sort((a, b2) => a.sort_order - b2.sort_order).map((x) => x.name),
      teamMembers: members.map((m) => ({ name: m.name, active: m.active, isAdmin: m.is_admin })),
      visibleColumns: s.visible_columns, customColumns: s.custom_columns, columnEditLocations: s.column_edit_locations,
    })
    const itemRows = items.map((it) => ({ ...it, project_id: pid, extra_fields: it.extra_fields || {}, checklist: it.checklist || {} }))
    for (const r of itemRows) { delete r.upload_id }
    for (let i = 0; i < itemRows.length; i += 200) await upsertQuery('items', itemRows.slice(i, i + 200), ['id'])
    const noteRows = notes.map((n) => ({ id: n.id, project_id: pid, item_id: n.item_id, author: n.author || 'Unknown', note: n.note || '', created_at: n.created_at }))
    for (let i = 0; i < noteRows.length; i += 200) await upsertQuery('item_notes', noteRows.slice(i, i + 200), ['id'])
    await bumpVersion(pid)
    summary.push({ project: op.name, items: items.length, notes: notes.length })
  }
  res.status(200).json({ ok: true, summary })
})
