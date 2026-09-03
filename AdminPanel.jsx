import React, { useState } from 'react'
import { STATUS_COLOR_PRESETS } from '../constants.js'

function EditableList({ items, usageCounts, onAdd, onUpdate, onRemove, placeholder, renderExtra }) {
  const [newVal, setNewVal] = useState('')
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')

  function submitAdd(e) {
    e.preventDefault()
    const v = newVal.trim()
    if (!v) return
    onAdd(v)
    setNewVal('')
  }

  function startEdit(name) {
    setEditing(name)
    setEditVal(name)
  }

  function submitEdit(oldName) {
    const v = editVal.trim()
    if (v && v !== oldName) onUpdate(oldName, v)
    setEditing(null)
  }

  return (
    <div>
      <div className="item-list">
        {items.map((it) => {
          const name = typeof it === 'string' ? it : it.name
          const count = usageCounts?.[name] || 0
          return (
            <div key={name} className="card" style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {editing === name ? (
                <>
                  <input type="text" value={editVal} onChange={(e) => setEditVal(e.target.value)} autoFocus style={{ flex: 1 }} />
                  <button className="btn secondary sm" onClick={() => submitEdit(name)}>Save</button>
                  <button className="btn ghost sm" onClick={() => setEditing(null)}>Cancel</button>
                </>
              ) : (
                <>
                  {renderExtra ? renderExtra(it) : null}
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 14, minWidth: 100 }}>{name}</span>
                  <button className="btn ghost sm" onClick={() => startEdit(name)}>Rename</button>
                  {count > 0 ? (
                    <span className="faint">{count} in use</span>
                  ) : (
                    <button className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => onRemove(name)}>Remove</button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      <form onSubmit={submitAdd} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input type="text" placeholder={placeholder} value={newVal} onChange={(e) => setNewVal(e.target.value)} />
        <button type="submit" className="btn sm">Add</button>
      </form>
    </div>
  )
}

export default function AdminPanel({
  availableColumns,
  visibleColumns,
  onToggleColumn,
  statuses,
  statusUsageCounts,
  onAddStatus,
  onUpdateStatus,
  onRemoveStatus,
  onSetStatusColor,
  onToggleTerminal,
  onToggleRequiresReason,
  onToggleRequiresChecklist,
  resolutionTypes,
  resolutionUsageCounts,
  onAddResolutionType,
  onUpdateResolutionType,
  onRemoveResolutionType,
  checklistItems,
  checklistUsageCounts,
  onAddChecklistItem,
  onUpdateChecklistItem,
  onRemoveChecklistItem,
  teamMembers,
  onAddMember,
  onToggleActive,
  onToggleAdmin,
  onCreateProject,
  onMigrateFromOldQueue,
}) {
  const [newProject, setNewProject] = useState('')
  const [oldPass, setOldPass] = useState('')
  const [dataMsg, setDataMsg] = useState('')
  const [dataBusy, setDataBusy] = useState(false)
  async function runMigrate() {
    if (!oldPass.trim() || !window.confirm('Import every project, account, and note from the previous shared queue into this one? Existing rows with the same IDs are overwritten.')) return
    setDataBusy(true); setDataMsg('')
    try { const r = await onMigrateFromOldQueue(oldPass.trim()); setDataMsg(r.summary.map((x) => `${x.project}: ${x.items} accounts, ${x.notes} notes`).join(' · ')); setOldPass('') }
    catch (e) { setDataMsg(e.message) } finally { setDataBusy(false) }
  }
  async function runCreate(e) {
    e.preventDefault(); if (!newProject.trim()) return
    setDataBusy(true); setDataMsg('')
    try { await onCreateProject(newProject.trim()); setNewProject('') } catch (err) { setDataMsg(err.message) } finally { setDataBusy(false) }
  }
  return (
    <div>
      <div className="section-label" style={{ marginTop: 0 }}>Projects & data</div>
      <div className="card" style={{ padding: 12, marginBottom: 20 }}>
        <form onSubmit={runCreate} style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="New project name (copies statuses, reasons, checklist, team)" value={newProject} onChange={(e) => setNewProject(e.target.value)} />
          <button type="submit" className="btn sm" disabled={dataBusy}>Create project</button>
        </form>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input type="password" placeholder="Old shared-queue passcode" value={oldPass} onChange={(e) => setOldPass(e.target.value)} />
          <button type="button" className="btn secondary sm" disabled={dataBusy || !oldPass.trim()} onClick={runMigrate}>{dataBusy ? 'Working…' : 'Import from previous queue'}</button>
        </div>
        {dataMsg && <div className="faint" style={{ marginTop: 8 }}>{dataMsg}</div>}
      </div>
      <div className="section-label">Queue columns</div>
      <div className="card" style={{ padding: 12 }}>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Choose which fields show on each item in the queue list.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {availableColumns.map((col) => (
            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={visibleColumns.includes(col.key)}
                onChange={() => onToggleColumn(col.key)}
              />
              {col.label}
            </label>
          ))}
        </div>
      </div>

      <div className="section-label">Status types</div>
      <EditableList
        items={statuses}
        usageCounts={statusUsageCounts}
        onAdd={onAddStatus}
        onUpdate={onUpdateStatus}
        onRemove={onRemoveStatus}
        placeholder="Add a status"
        renderExtra={(s) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {STATUS_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => onSetStatusColor(s.name, c)}
                  title={c}
                  style={{
                    width: 16, height: 16, borderRadius: '50%', background: c,
                    border: s.color === c ? '2px solid var(--ink)' : '2px solid transparent',
                  }}
                />
              ))}
            </div>
            <button
              className="btn ghost sm"
              title="Counts as done/out of the active queue"
              style={s.isTerminal ? { color: 'var(--ink)', fontWeight: 700, textDecoration: 'underline' } : {}}
              onClick={() => onToggleTerminal(s.name, !s.isTerminal)}
            >
              {s.isTerminal ? '✓ Done bucket' : 'Mark as done'}
            </button>
            <button
              className="btn ghost sm"
              title="Requires picking a reason + note before this status applies"
              style={s.requiresReason ? { color: 'var(--danger)', fontWeight: 700, textDecoration: 'underline' } : {}}
              onClick={() => onToggleRequiresReason(s.name, !s.requiresReason)}
            >
              {s.requiresReason ? '✓ Needs reason' : 'Needs reason?'}
            </button>
            <button
              className="btn ghost sm"
              title="Requires answering the completion checklist before this status applies"
              style={s.requiresChecklist ? { color: 'var(--blue-marguerite)', fontWeight: 700, textDecoration: 'underline' } : {}}
              onClick={() => onToggleRequiresChecklist(s.name, !s.requiresChecklist)}
            >
              {s.requiresChecklist ? '✓ Needs checklist' : 'Needs checklist?'}
            </button>
          </div>
        )}
      />

      <div className="section-label">Resolution types</div>
      <EditableList
        items={resolutionTypes}
        usageCounts={resolutionUsageCounts}
        onAdd={onAddResolutionType}
        onUpdate={onUpdateResolutionType}
        onRemove={onRemoveResolutionType}
        placeholder="Add a resolution type"
      />

      <div className="section-label">Completion checklist</div>
      <EditableList
        items={checklistItems}
        usageCounts={checklistUsageCounts}
        onAdd={onAddChecklistItem}
        onUpdate={onUpdateChecklistItem}
        onRemove={onRemoveChecklistItem}
        placeholder="Add a checklist question"
      />

      <div className="section-label">Team</div>
      <div className="item-list">
        {teamMembers.map((m) => (
          <div key={m.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, gap: 8 }}>
            <span style={{ fontWeight: 600, opacity: m.active ? 1 : 0.5, flex: 1 }}>
              {m.name} {m.isAdmin && <span className="faint">· admin</span>}
            </span>
            <button className="btn ghost sm" onClick={() => onToggleAdmin(m.id, !m.isAdmin)}>
              {m.isAdmin ? 'Remove admin' : 'Make admin'}
            </button>
            <button className="btn secondary sm" onClick={() => onToggleActive(m.id, !m.active)}>
              {m.active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); const v = e.target.elements.newMember.value.trim(); if (v) { onAddMember(v); e.target.reset() } }}
        style={{ display: 'flex', gap: 8, marginTop: 10 }}
      >
        <input type="text" name="newMember" placeholder="Add a team member" />
        <button type="submit" className="btn sm">Add</button>
      </form>
    </div>
  )
}
