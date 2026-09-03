export const PASSCODE_KEY = 'arcadia_edi_queue_team_key_session'
export const PROJECT_KEY = 'arcadia_edi_queue_active_project'

function headers() {
  return { 'Content-Type': 'application/json', 'x-team-key': sessionStorage.getItem(PASSCODE_KEY) || '' }
}

async function call(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: headers() })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(body.error || `Request failed (${r.status})`); e.status = r.status; throw e }
  return body
}

export const api = {
  state: (projectId) => call(`/api/state${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`),
  version: (projectId) => call(`/api/version?projectId=${encodeURIComponent(projectId)}`),
  sync: (payload) => call('/api/sync', { method: 'POST', body: JSON.stringify(payload) }),
  createProject: (name, copyFromProjectId) => call('/api/projects', { method: 'POST', body: JSON.stringify({ name, copyFromProjectId }) }),
  migrate: (oldPasscode) => call('/api/migrate', { method: 'POST', body: JSON.stringify({ oldPasscode }) }),
}

const noteRows = (state) => (state.items || []).flatMap((it) => (it.notes || []).map((n) => ({ id: n.id, item_id: it.id, author: n.author, note: n.note, created_at: n.created_at })))
const stripNotes = ({ notes, ...rest }) => rest
function changed(prev, next, key, map) {
  const old = new Map((prev || []).map((r, i) => [key(r), JSON.stringify(map(r, i))]))
  return (next || []).map(map).filter((row, i) => old.get(key(next[i])) !== JSON.stringify(row))
}
const missing = (prev, next, key) => (prev || []).map(key).filter((k) => !(next || []).some((r) => key(r) === k))

// Computes the minimal payload to bring the server from `prev` to `next`.
export function buildSyncPayload(prev, next, projectId) {
  const p = { projectId }
  p.members = changed(prev.teamMembers, next.teamMembers, (m) => m.id, (m) => ({ id: m.id, name: m.name, active: m.active, isAdmin: !!m.isAdmin }))
  p.deletedMemberIds = missing(prev.teamMembers, next.teamMembers, (m) => m.id)
  p.statuses = changed(prev.statuses, next.statuses, (s) => s.name, (s, i) => ({ ...s, sort_order: i }))
  p.deletedStatuses = missing(prev.statuses, next.statuses, (s) => s.name)
  p.reasons = changed(prev.resolutionTypes, next.resolutionTypes, (n) => n, (n, i) => ({ name: n, sort_order: i }))
  p.deletedReasons = missing(prev.resolutionTypes, next.resolutionTypes, (n) => n)
  p.checklist = changed(prev.checklistItems, next.checklistItems, (n) => n, (n, i) => ({ name: n, sort_order: i }))
  p.deletedChecklist = missing(prev.checklistItems, next.checklistItems, (n) => n)
  p.items = changed(prev.items, next.items, (it) => it.id, stripNotes)
  p.deletedItemIds = missing(prev.items, next.items, (it) => it.id)
  const pn = noteRows(prev), nn = noteRows(next)
  p.notes = changed(pn, nn, (n) => n.id, (n) => n)
  p.deletedNoteIds = missing(pn, nn, (n) => n.id)
  p.settings = {}
  for (const [k, field] of [['visible_columns', 'visibleColumns'], ['custom_columns', 'customColumns'], ['column_edit_locations', 'columnEditLocations']]) {
    if (JSON.stringify(prev[field] ?? null) !== JSON.stringify(next[field] ?? null)) p.settings[k] = next[field]
  }
  const empty = ['members','deletedMemberIds','statuses','deletedStatuses','reasons','deletedReasons','checklist','deletedChecklist','items','deletedItemIds','notes','deletedNoteIds'].every((k) => !p[k].length) && !Object.keys(p.settings).length
  return empty ? null : p
}
