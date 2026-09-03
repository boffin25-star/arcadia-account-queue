import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!url) throw new Error('DATABASE_URL is not set. Connect the Vercel Postgres database to this project.')
export const sql = neon(url)

let schemaReady
export function ensureSchema() {
  if (!schemaReady) schemaReady = createSchema()
  return schemaReady
}

async function createSchema() {
  await sql`create extension if not exists pgcrypto`
  await sql`create table if not exists projects (
    id uuid primary key default gen_random_uuid(), name text not null unique,
    sort_order int not null default 0, active boolean not null default true,
    created_at timestamptz not null default now())`
  await sql`create table if not exists team_members (
    id uuid primary key, project_id uuid not null references projects(id) on delete cascade,
    name text not null, active boolean not null default true, is_admin boolean not null default false,
    unique (project_id, name))`
  await sql`create table if not exists items (
    id uuid primary key, project_id uuid not null references projects(id) on delete cascade,
    account_id text, account_name text, client text, vendor text, amount numeric, description text,
    extra_fields jsonb not null default '{}', status text not null default 'Not Started', assigned_to text,
    claimed_at timestamptz, resolved_at timestamptz, resolution_note text, resolution_type text,
    checklist jsonb not null default '{}', follow_up_date date, source_file text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now())`
  await sql`create index if not exists items_project_idx on items (project_id)`
  await sql`create table if not exists item_notes (
    id uuid primary key, project_id uuid not null, item_id uuid not null references items(id) on delete cascade,
    author text not null default 'Unknown', note text not null default '', created_at timestamptz not null default now())`
  await sql`create index if not exists item_notes_item_idx on item_notes (item_id)`
  await sql`create table if not exists statuses (
    project_id uuid not null references projects(id) on delete cascade, name text not null, color text not null default '#64748B',
    is_terminal boolean not null default false, requires_reason boolean not null default false,
    requires_checklist boolean not null default false, sort_order int not null default 0, primary key (project_id, name))`
  await sql`create table if not exists resolution_types (
    project_id uuid not null references projects(id) on delete cascade, name text not null, sort_order int not null default 0, primary key (project_id, name))`
  await sql`create table if not exists checklist_items (
    project_id uuid not null references projects(id) on delete cascade, name text not null, sort_order int not null default 0, primary key (project_id, name))`
  await sql`create table if not exists settings (
    project_id uuid not null references projects(id) on delete cascade, key text not null, value jsonb not null, primary key (project_id, key))`
  await sql`create table if not exists meta (project_id uuid primary key references projects(id) on delete cascade, version bigint not null default 1)`
}

// Generic bulk upsert: rows is an array of plain objects whose keys are column names.
export function upsertQuery(table, rows, conflictCols) {
  if (!rows.length) return null
  const cols = Object.keys(rows[0])
  const updates = cols.filter((c) => !conflictCols.includes(c)).map((c) => `${c} = excluded.${c}`).join(', ')
  const text = `insert into ${table} (${cols.join(', ')})
    select ${cols.join(', ')} from jsonb_populate_recordset(null::${table}, $1::jsonb)
    on conflict (${conflictCols.join(', ')}) do update set ${updates || conflictCols[0] + ' = excluded.' + conflictCols[0]}`
  return sql(text, [JSON.stringify(rows)])
}

export async function loadState(projectId) {
  const [members, items, notes, statuses, reasons, checklist, settings, meta] = await Promise.all([
    sql`select * from team_members where project_id = ${projectId} order by name`,
    sql`select * from items where project_id = ${projectId} order by created_at desc`,
    sql`select * from item_notes where project_id = ${projectId} order by created_at desc`,
    sql`select * from statuses where project_id = ${projectId} order by sort_order`,
    sql`select * from resolution_types where project_id = ${projectId} order by sort_order`,
    sql`select * from checklist_items where project_id = ${projectId} order by sort_order`,
    sql`select key, value from settings where project_id = ${projectId}`,
    sql`select version from meta where project_id = ${projectId}`,
  ])
  const notesByItem = new Map()
  for (const n of notes) {
    const list = notesByItem.get(n.item_id) || []
    list.push({ id: n.id, author: n.author, note: n.note, created_at: n.created_at })
    notesByItem.set(n.item_id, list)
  }
  const s = Object.fromEntries(settings.map((r) => [r.key, r.value]))
  return {
    projectId,
    version: meta[0]?.version ?? 1,
    teamMembers: members.map((m) => ({ id: m.id, name: m.name, active: m.active, isAdmin: m.is_admin })),
    items: items.map((it) => ({
      id: it.id, account_id: it.account_id || '', account_name: it.account_name || '', client: it.client || '',
      vendor: it.vendor || '', amount: it.amount === null ? null : Number(it.amount), description: it.description || '',
      extra_fields: it.extra_fields || {}, status: it.status, assigned_to: it.assigned_to, claimed_at: it.claimed_at,
      resolved_at: it.resolved_at, resolution_note: it.resolution_note || '', resolution_type: it.resolution_type || '',
      checklist: it.checklist || {}, follow_up_date: it.follow_up_date ? String(it.follow_up_date).slice(0, 10) : null,
      source_file: it.source_file || '', created_at: it.created_at, updated_at: it.updated_at,
      notes: notesByItem.get(it.id) || [],
    })),
    statuses: statuses.map((st) => ({ name: st.name, color: st.color, isTerminal: st.is_terminal, requiresReason: st.requires_reason, requiresChecklist: st.requires_checklist })),
    resolutionTypes: reasons.map((r) => r.name),
    checklistItems: checklist.map((c) => c.name),
    visibleColumns: Array.isArray(s.visible_columns) ? s.visible_columns : ['vendor', 'amount', 'assigned_to', 'follow_up_date'],
    customColumns: Array.isArray(s.custom_columns) ? s.custom_columns : [],
    columnEditLocations: s.column_edit_locations && typeof s.column_edit_locations === 'object' ? s.column_edit_locations : {},
  }
}

export async function ensureDefaultProject() {
  const rows = await sql`select id from projects where active order by sort_order, created_at limit 1`
  if (rows.length) return rows[0].id
  const [p] = await sql`insert into projects (name) values ('Account Queue') returning id`
  await seedProject(p.id, null)
  return p.id
}

export async function seedProject(projectId, source) {
  const statuses = source?.statuses?.length ? source.statuses : [
    { name: 'Not Started', color: '#64CCDB' }, { name: 'In-Progress: Contacted Vendor', color: '#6A5BB1' },
    { name: 'In-Progress: Contacted CR', color: '#6A5BB1' }, { name: 'In-Progress: Waiting for Response', color: '#6A5BB1' },
    { name: 'In-Progress', color: '#6A5BB1' }, { name: 'On-Hold', color: '#8F00FF' },
    { name: 'Successfully Registered', color: '#0FFF87', isTerminal: true, requiresChecklist: true },
    { name: 'Unable to Register: Excluded', color: '#D64545', isTerminal: true, requiresReason: true },
  ]
  const reasons = source?.resolutionTypes?.length ? source.resolutionTypes : ['Incorrect Tax Id', 'Already Registered', 'Account ineligible', 'Other info incorrect']
  const checklist = source?.checklistItems?.length ? source.checklistItems : [
    'Did they update the BRM in AVI?', 'Did they add an Excluded or Registered note in AVI?',
    'Did they add the login credentials to the Dashboard?', 'Did they turn off Paper on the website?']
  const members = source?.teamMembers?.length ? source.teamMembers : [
    { name: 'Brandon', isAdmin: true }, { name: 'Laura' }, { name: 'Rich' }, { name: 'Anna' }, { name: 'Marie' }]
  await upsertQuery('statuses', statuses.map((s, i) => ({ project_id: projectId, name: s.name, color: s.color || '#64748B', is_terminal: !!s.isTerminal, requires_reason: !!s.requiresReason, requires_checklist: !!s.requiresChecklist, sort_order: i })), ['project_id', 'name'])
  await upsertQuery('resolution_types', reasons.map((name, i) => ({ project_id: projectId, name, sort_order: i })), ['project_id', 'name'])
  await upsertQuery('checklist_items', checklist.map((name, i) => ({ project_id: projectId, name, sort_order: i })), ['project_id', 'name'])
  await upsertQuery('team_members', members.map((m) => ({ id: crypto.randomUUID(), project_id: projectId, name: m.name, active: m.active !== false, is_admin: !!m.isAdmin })), ['project_id', 'name'])
  await upsertQuery('settings', [
    { project_id: projectId, key: 'visible_columns', value: source?.visibleColumns || ['vendor', 'amount', 'assigned_to', 'follow_up_date'] },
    { project_id: projectId, key: 'custom_columns', value: source?.customColumns || [] },
    { project_id: projectId, key: 'column_edit_locations', value: source?.columnEditLocations || {} },
  ], ['project_id', 'key'])
  await sql`insert into meta (project_id, version) values (${projectId}, 1) on conflict (project_id) do nothing`
}

export async function bumpVersion(projectId) {
  const [r] = await sql`insert into meta (project_id, version) values (${projectId}, 2)
    on conflict (project_id) do update set version = meta.version + 1 returning version`
  return r.version
}
