import { ensureSchema, upsertQuery, bumpVersion, sql } from './_lib/db.js'
import { wrap } from './_lib/auth.js'

const toItemRow = (pid) => (it) => ({
  id: it.id, project_id: pid, account_id: it.account_id || null, account_name: it.account_name || null,
  client: it.client || null, vendor: it.vendor || null,
  amount: it.amount === '' || it.amount == null || !Number.isFinite(Number(it.amount)) ? null : Number(it.amount),
  description: it.description || null, extra_fields: it.extra_fields || {}, status: it.status || 'Not Started',
  assigned_to: it.assigned_to || null, claimed_at: it.claimed_at || null, resolved_at: it.resolved_at || null,
  resolution_note: it.resolution_note || null, resolution_type: it.resolution_type || null, checklist: it.checklist || {},
  follow_up_date: it.follow_up_date || null, source_file: it.source_file || null,
  created_at: it.created_at || new Date().toISOString(), updated_at: it.updated_at || new Date().toISOString(),
})

export default wrap(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end()
  await ensureSchema()
  const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  const pid = b.projectId
  if (!pid) return res.status(400).json({ error: 'projectId required' })

  if (b.members?.length) await upsertQuery('team_members', b.members.map((m) => ({ id: m.id, project_id: pid, name: m.name, active: m.active !== false, is_admin: !!m.isAdmin })), ['project_id', 'name'])
  if (b.statuses?.length) await upsertQuery('statuses', b.statuses.map((s) => ({ project_id: pid, name: s.name, color: s.color || '#64748B', is_terminal: !!s.isTerminal, requires_reason: !!s.requiresReason, requires_checklist: !!s.requiresChecklist, sort_order: s.sort_order ?? 0 })), ['project_id', 'name'])
  if (b.reasons?.length) await upsertQuery('resolution_types', b.reasons.map((r) => ({ project_id: pid, name: r.name, sort_order: r.sort_order ?? 0 })), ['project_id', 'name'])
  if (b.checklist?.length) await upsertQuery('checklist_items', b.checklist.map((c) => ({ project_id: pid, name: c.name, sort_order: c.sort_order ?? 0 })), ['project_id', 'name'])
  if (b.items?.length) await upsertQuery('items', b.items.map(toItemRow(pid)), ['id'])
  if (b.notes?.length) await upsertQuery('item_notes', b.notes.map((n) => ({ id: n.id, project_id: pid, item_id: n.item_id, author: n.author || 'Unknown', note: n.note || '', created_at: n.created_at || new Date().toISOString() })), ['id'])
  if (b.settings && Object.keys(b.settings).length) await upsertQuery('settings', Object.entries(b.settings).map(([key, value]) => ({ project_id: pid, key, value })), ['project_id', 'key'])

  if (b.deletedNoteIds?.length) await sql`delete from item_notes where project_id = ${pid} and id = any(${b.deletedNoteIds}::uuid[])`
  if (b.deletedItemIds?.length) await sql`delete from items where project_id = ${pid} and id = any(${b.deletedItemIds}::uuid[])`
  if (b.deletedStatuses?.length) await sql`delete from statuses where project_id = ${pid} and name = any(${b.deletedStatuses}::text[])`
  if (b.deletedReasons?.length) await sql`delete from resolution_types where project_id = ${pid} and name = any(${b.deletedReasons}::text[])`
  if (b.deletedChecklist?.length) await sql`delete from checklist_items where project_id = ${pid} and name = any(${b.deletedChecklist}::text[])`
  if (b.deletedMemberIds?.length) await sql`delete from team_members where project_id = ${pid} and id = any(${b.deletedMemberIds}::uuid[])`

  const version = await bumpVersion(pid)
  res.status(200).json({ ok: true, version })
})
