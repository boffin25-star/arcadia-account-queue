import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { newId } from './lib/store.js'
import { api, buildSyncPayload, PASSCODE_KEY, PROJECT_KEY } from './lib/api.js'
import PasscodeGate from './components/PasscodeGate.jsx'
import { exportQueueToExcel } from './utils/xlsxExport.js'
import { computeAvailableColumns } from './utils/fields.js'
import { CURRENT_USER_KEY } from './constants.js'
import NamePicker from './components/NamePicker.jsx'
import QueueView from './components/QueueView.jsx'
import ItemDetail from './components/ItemDetail.jsx'
import UploadWizard from './components/UploadWizard.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import MetricsView from './components/MetricsView.jsx'

function initials(name) {
  return (name || '')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function normalizeKey(v) {
  return String(v ?? '').trim().toLowerCase()
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem(CURRENT_USER_KEY) || '')
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem(PASSCODE_KEY))
  const [state, setState] = useState(null)
  const [projects, setProjects] = useState([])
  const [loadError, setLoadError] = useState('')
  const [syncStatus, setSyncStatus] = useState('live')
  const shadow = useRef(null)
  const syncing = useRef(false)
  const pending = useRef(null)
  const [tab, setTab] = useState('queue')
  const [openItemId, setOpenItemId] = useState(null)
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }, [])

  // ---- shared backend: load, sync, poll ----
  const loadFromServer = useCallback(async (projectId) => {
    const data = await api.state(projectId || sessionStorage.getItem(PROJECT_KEY) || '')
    const { projects: list, version, ...rest } = data
    sessionStorage.setItem(PROJECT_KEY, rest.projectId)
    shadow.current = { ...rest, version }
    setProjects(list)
    setState(rest)
  }, [])

  useEffect(() => {
    if (!unlocked) return
    loadFromServer().catch((e) => {
      if (e.status === 401) { sessionStorage.removeItem(PASSCODE_KEY); setUnlocked(false) }
      else setLoadError(e.message)
    })
  }, [unlocked, loadFromServer])

  const flush = useCallback(async () => {
    if (syncing.current || !pending.current || !shadow.current) return
    syncing.current = true
    setSyncStatus('syncing')
    try {
      while (pending.current) {
        const next = pending.current; pending.current = null
        const payload = buildSyncPayload(shadow.current, next, shadow.current.projectId)
        if (payload) {
          const { version } = await api.sync(payload)
          shadow.current = { ...next, projectId: shadow.current.projectId, version }
        }
      }
      setSyncStatus('live')
    } catch (e) {
      console.error('sync failed', e); setSyncStatus('error')
    } finally {
      syncing.current = false
      if (pending.current) flush()
    }
  }, [])

  useEffect(() => {
    if (!state || !shadow.current || state === shadow.current.__applied) return
    pending.current = state
    flush()
  }, [state, flush])

  useEffect(() => {
    if (!unlocked || !state) return
    const id = setInterval(async () => {
      if (syncing.current || pending.current || !shadow.current) return
      try {
        const { version } = await api.version(shadow.current.projectId)
        if (version !== shadow.current.version) {
          const data = await api.state(shadow.current.projectId)
          const { projects: list, version: v, ...rest } = data
          const applied = { ...rest }
          shadow.current = { ...rest, version: v, __applied: applied }
          setProjects(list)
          setState(applied)
        }
      } catch (e) { setSyncStatus('error') }
    }, 4000)
    return () => clearInterval(id)
  }, [unlocked, state, flush])

  async function switchProject(id) {
    await flush()
    sessionStorage.setItem(PROJECT_KEY, id)
    setState(null); shadow.current = null
    loadFromServer(id).catch((e) => setLoadError(e.message))
  }

  async function createProject(name) {
    await flush()
    const { project } = await api.createProject(name, shadow.current?.projectId)
    await switchProject(project.id)
  }

  async function migrateFromOldQueue(oldPasscode) {
    const r = await api.migrate(oldPasscode)
    await loadFromServer(shadow.current?.projectId)
    return r
  }

  const safe = state || { items: [], teamMembers: [], statuses: [], resolutionTypes: [], checklistItems: [], visibleColumns: [] }
  const openItem = useMemo(
    () => (openItemId ? safe.items.find((it) => it.id === openItemId) || null : null),
    [openItemId, safe.items]
  )

  const currentMember = safe.teamMembers.find((m) => m.name === currentUser)
  const isAdmin = !!currentMember?.isAdmin

  const availableColumns = useMemo(() => computeAvailableColumns(safe.items), [safe.items])
  const visibleColumnDefs = useMemo(
    () => availableColumns.filter((c) => safe.visibleColumns.includes(c.key)),
    [availableColumns, safe.visibleColumns]
  )

  const statusUsageCounts = useMemo(() => {
    const counts = {}
    for (const it of safe.items) counts[it.status] = (counts[it.status] || 0) + 1
    return counts
  }, [safe.items])

  const resolutionUsageCounts = useMemo(() => {
    const counts = {}
    for (const it of safe.items) if (it.resolution_type) counts[it.resolution_type] = (counts[it.resolution_type] || 0) + 1
    return counts
  }, [safe.items])

  const checklistUsageCounts = useMemo(() => {
    const counts = {}
    for (const it of safe.items) {
      for (const k of Object.keys(it.checklist || {})) counts[k] = (counts[k] || 0) + 1
    }
    return counts
  }, [safe.items])

  useEffect(() => {
    if (tab === 'admin' && !isAdmin) setTab('queue')
  }, [tab, isAdmin])

  function pickUser(name) {
    localStorage.setItem(CURRENT_USER_KEY, name)
    setCurrentUser(name)
  }

  function addMember(name) {
    setState((prev) => {
      if (prev.teamMembers.some((m) => normalizeKey(m.name) === normalizeKey(name))) return prev
      const member = { id: newId(), name, active: true, isAdmin: false }
      return { ...prev, teamMembers: [...prev.teamMembers, member].sort((a, b) => a.name.localeCompare(b.name)) }
    })
  }

  function toggleMemberActive(id, active) {
    setState((prev) => ({ ...prev, teamMembers: prev.teamMembers.map((m) => (m.id === id ? { ...m, active } : m)) }))
  }

  function toggleMemberAdmin(id, isAdminFlag) {
    setState((prev) => {
      const adminCount = prev.teamMembers.filter((m) => m.isAdmin).length
      const target = prev.teamMembers.find((m) => m.id === id)
      if (!isAdminFlag && target?.isAdmin && adminCount <= 1) {
        showToast("Can't remove the last admin")
        return prev
      }
      return { ...prev, teamMembers: prev.teamMembers.map((m) => (m.id === id ? { ...m, isAdmin: isAdminFlag } : m)) }
    })
  }

  function toggleColumn(key) {
    setState((prev) => ({
      ...prev,
      visibleColumns: prev.visibleColumns.includes(key)
        ? prev.visibleColumns.filter((k) => k !== key)
        : [...prev.visibleColumns, key],
    }))
  }

  // Auto-provision helper: import can bring in status/assignee/reason values
  // that don't exist yet locally (e.g. someone edited the source sheet).
  // Rather than silently drop them, add them so nothing gets lost.
  function ensureStatus(prev, name) {
    if (!name || prev.statuses.some((s) => s.name === name)) return prev
    return { ...prev, statuses: [...prev.statuses, { name, color: '#3454D1', isTerminal: false, requiresReason: false, requiresChecklist: false }] }
  }
  function ensureResolutionType(prev, name) {
    if (!name || prev.resolutionTypes.includes(name)) return prev
    return { ...prev, resolutionTypes: [...prev.resolutionTypes, name] }
  }
  function ensureMember(prev, name) {
    if (!name || prev.teamMembers.some((m) => normalizeKey(m.name) === normalizeKey(name))) return prev
    return { ...prev, teamMembers: [...prev.teamMembers, { id: newId(), name, active: true, isAdmin: false }] }
  }

  function addStatus(name) {
    setState((prev) => ensureStatus(prev, name))
  }

  function updateStatusName(oldName, newName) {
    setState((prev) => ({
      ...prev,
      statuses: prev.statuses.map((s) => (s.name === oldName ? { ...s, name: newName } : s)),
      items: prev.items.map((it) => (it.status === oldName ? { ...it, status: newName } : it)),
    }))
  }

  function setStatusColor(name, color) {
    setState((prev) => ({ ...prev, statuses: prev.statuses.map((s) => (s.name === name ? { ...s, color } : s)) }))
  }

  function toggleTerminal(name, val) {
    setState((prev) => ({ ...prev, statuses: prev.statuses.map((s) => (s.name === name ? { ...s, isTerminal: val } : s)) }))
  }

  function toggleRequiresReason(name, val) {
    setState((prev) => ({ ...prev, statuses: prev.statuses.map((s) => (s.name === name ? { ...s, requiresReason: val } : s)) }))
  }

  function toggleRequiresChecklist(name, val) {
    setState((prev) => ({ ...prev, statuses: prev.statuses.map((s) => (s.name === name ? { ...s, requiresChecklist: val } : s)) }))
  }

  function removeStatus(name) {
    if (statusUsageCounts[name]) {
      showToast(`Can't remove — ${statusUsageCounts[name]} item(s) still use it`)
      return
    }
    setState((prev) => ({ ...prev, statuses: prev.statuses.filter((s) => s.name !== name) }))
  }

  function addResolutionType(name) {
    setState((prev) => ensureResolutionType(prev, name))
  }

  function updateResolutionType(oldName, newName) {
    setState((prev) => ({
      ...prev,
      resolutionTypes: prev.resolutionTypes.map((r) => (r === oldName ? newName : r)),
      items: prev.items.map((it) => (it.resolution_type === oldName ? { ...it, resolution_type: newName } : it)),
    }))
  }

  function removeResolutionType(name) {
    if (resolutionUsageCounts[name]) {
      showToast(`Can't remove — ${resolutionUsageCounts[name]} item(s) still use it`)
      return
    }
    setState((prev) => ({ ...prev, resolutionTypes: prev.resolutionTypes.filter((r) => r !== name) }))
  }

  function addChecklistItem(name) {
    setState((prev) => {
      if (prev.checklistItems.includes(name)) return prev
      return { ...prev, checklistItems: [...prev.checklistItems, name] }
    })
  }

  function updateChecklistItem(oldName, newName) {
    setState((prev) => ({
      ...prev,
      checklistItems: prev.checklistItems.map((c) => (c === oldName ? newName : c)),
      items: prev.items.map((it) => {
        if (!it.checklist || it.checklist[oldName] === undefined) return it
        const { [oldName]: val, ...rest } = it.checklist
        return { ...it, checklist: { ...rest, [newName]: val } }
      }),
    }))
  }

  function removeChecklistItem(name) {
    if (checklistUsageCounts[name]) {
      showToast(`Can't remove — ${checklistUsageCounts[name]} item(s) still use it`)
      return
    }
    setState((prev) => ({ ...prev, checklistItems: prev.checklistItems.filter((c) => c !== name) }))
  }

  // rows already carry mapped core + workflow fields (status/assigned_to/
  // resolution_type) plus extra_fields — see UploadWizard. Dedupe against
  // existing items by Account ID; auto-provision any new status/assignee/
  // reason values the sheet brings in.
  function handleImport({ filename, items: newRows }) {
    let added = 0
    let skipped = 0
    const defaultStatus = state.statuses[0]?.name || 'Not Started'
    setState((prev) => {
      let next = prev
      const existingIds = new Set(next.items.map((it) => normalizeKey(it.account_id)).filter((k) => k))
      const now = new Date().toISOString()
      const toAdd = []
      for (const row of newRows) {
        const key = normalizeKey(row.account_id)
        if (key && existingIds.has(key)) { skipped += 1; continue }
        if (key) existingIds.add(key)
        added += 1

        const status = row.status || defaultStatus
        next = ensureStatus(next, status)
        if (row.assigned_to) next = ensureMember(next, row.assigned_to)
        if (row.resolution_type) next = ensureResolutionType(next, row.resolution_type)

        toAdd.push({
          id: newId(),
          ...row,
          status,
          assigned_to: row.assigned_to || null,
          claimed_at: row.assigned_to ? now : null,
          resolved_at: null,
          resolution_note: row.resolution_note || '',
          resolution_type: row.resolution_type || '',
          source_file: filename,
          notes: [],
          created_at: now,
          updated_at: now,
        })
      }
      return { ...next, items: [...toAdd, ...next.items] }
    })
    showToast(`Added ${added}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}`)
    return { added, skipped }
  }

  function patchItem(id, patch) {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch, updated_at: new Date().toISOString() } : it)),
    }))
  }

  function changeStatus(id, status) {
    const statusDef = state.statuses.find((s) => s.name === status)
    patchItem(id, { status, resolved_at: statusDef?.isTerminal ? new Date().toISOString() : null })
  }

  function assignItem(id, name) {
    patchItem(id, { assigned_to: name, claimed_at: name ? new Date().toISOString() : null })
  }

  function updateFollowUpDate(id, value) {
    patchItem(id, { follow_up_date: value || null })
  }

  function addNote(itemId, text) {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === itemId
          ? { ...it, updated_at: new Date().toISOString(), notes: [{ id: newId(), author: currentUser, note: text, created_at: new Date().toISOString() }, ...(it.notes || [])] }
          : it
      ),
    }))
  }

  function formatChecklistSummary(checklistAnswers) {
    return Object.entries(checklistAnswers)
      .map(([q, a]) => `${q} ${a ? 'Yes' : 'No'}`)
      .join('; ')
  }

  function applyPendingStatus(itemId, statusName, { resolutionType, resolutionNote, checklistAnswers } = {}) {
    bulkApplyStatus([itemId], statusName, { resolutionType, resolutionNote, checklistAnswers })
  }

  function bulkAssign(ids, name) {
    if (!ids.length) return
    const idSet = new Set(ids)
    const now = new Date().toISOString()
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) => (idSet.has(it.id) ? { ...it, assigned_to: name, claimed_at: name ? now : null, updated_at: now } : it)),
    }))
    showToast(name ? `Assigned ${ids.length} item(s) to ${name}` : `Unassigned ${ids.length} item(s)`)
  }

  function bulkApplyStatus(ids, statusName, { resolutionType, resolutionNote, checklistAnswers } = {}) {
    if (!ids.length) return
    const idSet = new Set(ids)
    const now = new Date().toISOString()
    const statusDef = state.statuses.find((s) => s.name === statusName)
    const noteParts = []
    if (resolutionType || resolutionNote) noteParts.push(`${statusName} (${resolutionType}): ${resolutionNote}`)
    if (checklistAnswers) noteParts.push(`Checklist — ${formatChecklistSummary(checklistAnswers)}`)
    const summaryNote = noteParts.join(' | ') || `Status set to ${statusName}`

    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (!idSet.has(it.id)) return it
        return {
          ...it,
          status: statusName,
          ...(resolutionNote !== undefined ? { resolution_note: resolutionNote } : {}),
          ...(resolutionType !== undefined ? { resolution_type: resolutionType } : {}),
          ...(checklistAnswers !== undefined ? { checklist: { ...(it.checklist || {}), ...checklistAnswers } } : {}),
          resolved_at: statusDef?.isTerminal ? now : it.resolved_at,
          updated_at: now,
          notes: [{ id: newId(), author: currentUser, note: summaryNote, created_at: now }, ...(it.notes || [])],
        }
      }),
    }))
    showToast(`Updated ${ids.length} item(s) to ${statusName}`)
  }

  function handleExport() {
    exportQueueToExcel(state.items, state.checklistItems, `arcadia-account-queue-${new Date().toISOString().slice(0, 10)}.xlsx`)
    showToast('Excel file downloaded')
  }

  if (!unlocked) return <PasscodeGate onUnlocked={() => setUnlocked(true)} />
  if (loadError) {
    return (
      <div className="name-picker-screen"><div className="name-picker-card">
        <h1>Could not load the queue</h1><p className="muted">{loadError}</p>
        <button className="btn block" onClick={() => { setLoadError(''); loadFromServer().catch((e) => setLoadError(e.message)) }}>Try again</button>
      </div></div>
    )
  }
  if (!state) {
    return <div className="name-picker-screen"><div className="name-picker-card"><h1>Loading the shared queue…</h1></div></div>
  }

  if (!currentUser) {
    return (
      <NamePicker
        teamMembers={state.teamMembers.filter((m) => m.active)}
        onPick={pickUser}
        onAddMember={async (name) => addMember(name)}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="brand"><span className="tick" />Arcadia Account Queue</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {projects.length > 1 && (
            <select value={state.projectId} onChange={(e) => switchProject(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <span className={`sync-dot ${syncStatus}`} title={syncStatus === 'live' ? 'Shared queue is live' : syncStatus === 'syncing' ? 'Saving…' : 'Sync problem — changes may not be saved'}>
            {syncStatus === 'live' ? 'Live' : syncStatus === 'syncing' ? 'Saving…' : 'Sync issue'}
          </span>
          <button className="btn ghost sm" style={{ color: '#fff' }} title="Lock the shared queue on this device" onClick={() => { sessionStorage.removeItem(PASSCODE_KEY); setUnlocked(false); setState(null) }}>Lock</button>
          <div className="user-chip" onClick={() => { localStorage.removeItem(CURRENT_USER_KEY); setCurrentUser('') }}>
            <span className="avatar">{initials(currentUser)}</span>
            {currentUser}
          </div>
        </div>
      </div>

      <div className={`app-main ${tab === 'queue' || tab === 'metrics' ? 'full-width' : ''}`}>
        <div className="tab-bar">
          <button className={tab === 'queue' ? 'active' : ''} onClick={() => setTab('queue')}>Queue</button>
          <button className={tab === 'metrics' ? 'active' : ''} onClick={() => setTab('metrics')}>Metrics</button>
          <button className={tab === 'upload' ? 'active' : ''} onClick={() => setTab('upload')}>Upload</button>
          {isAdmin && <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>}
        </div>

        {tab === 'queue' && (
          <QueueView
            items={state.items}
            currentUser={currentUser}
            onOpen={(it) => setOpenItemId(it.id)}
            statuses={state.statuses}
            columns={visibleColumnDefs}
            teamMembers={state.teamMembers}
            resolutionTypes={state.resolutionTypes}
            checklistItems={state.checklistItems}
            onBulkAssign={bulkAssign}
            onBulkApplyStatus={bulkApplyStatus}
            onUpdateFollowUpDate={updateFollowUpDate}
            onExport={handleExport}
          />
        )}

        {tab === 'upload' && (
          <UploadWizard currentUser={currentUser} onImport={handleImport} statuses={state.statuses} resolutionTypes={state.resolutionTypes} />
        )}

        {tab === 'metrics' && (
          <MetricsView
            items={state.items}
            statuses={state.statuses}
            teamMembers={state.teamMembers}
            resolutionTypes={state.resolutionTypes}
          />
        )}

        {tab === 'admin' && isAdmin && (
          <AdminPanel
            availableColumns={availableColumns}
            visibleColumns={state.visibleColumns}
            onToggleColumn={toggleColumn}
            statuses={state.statuses}
            statusUsageCounts={statusUsageCounts}
            onAddStatus={addStatus}
            onUpdateStatus={updateStatusName}
            onRemoveStatus={removeStatus}
            onSetStatusColor={setStatusColor}
            onToggleTerminal={toggleTerminal}
            onToggleRequiresReason={toggleRequiresReason}
            onToggleRequiresChecklist={toggleRequiresChecklist}
            resolutionTypes={state.resolutionTypes}
            resolutionUsageCounts={resolutionUsageCounts}
            onAddResolutionType={addResolutionType}
            onUpdateResolutionType={updateResolutionType}
            onRemoveResolutionType={removeResolutionType}
            checklistItems={state.checklistItems}
            checklistUsageCounts={checklistUsageCounts}
            onAddChecklistItem={addChecklistItem}
            onUpdateChecklistItem={updateChecklistItem}
            onRemoveChecklistItem={removeChecklistItem}
            teamMembers={state.teamMembers}
            onAddMember={addMember}
            onToggleActive={toggleMemberActive}
            onToggleAdmin={toggleMemberAdmin}
            onCreateProject={createProject}
            onMigrateFromOldQueue={migrateFromOldQueue}
          />
        )}
      </div>

      {openItem && (
        <ItemDetail
          item={openItem}
          notes={openItem.notes || []}
          currentUser={currentUser}
          statuses={state.statuses}
          resolutionTypes={state.resolutionTypes}
          checklistItems={state.checklistItems}
          teamMembers={state.teamMembers}
          onClose={() => setOpenItemId(null)}
          onChangeStatus={async (id, status) => changeStatus(id, status)}
          onAssign={async (id, name) => assignItem(id, name)}
          onAddNote={async (id, text) => addNote(id, text)}
          onApplyPendingStatus={async (id, status, fields) => applyPendingStatus(id, status, fields)}
          onUpdateFollowUpDate={async (id, value) => updateFollowUpDate(id, value)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
