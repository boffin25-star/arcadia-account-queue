import React, { useState } from 'react'

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

export default function ItemDetail({
  item, notes, currentUser, statuses, resolutionTypes, checklistItems, teamMembers,
  onClose, onChangeStatus, onAssign, onAddNote, onApplyPendingStatus, onUpdateFollowUpDate,
}) {
  const [noteText, setNoteText] = useState('')
  const [pending, setPending] = useState(null) // { status, needsReason, needsChecklist }
  const [reasonNote, setReasonNote] = useState('')
  const [reasonType, setReasonType] = useState(resolutionTypes[0] || '')
  const [checklistAnswers, setChecklistAnswers] = useState({})
  const [busy, setBusy] = useState(false)

  const extraEntries = Object.entries(item.extra_fields || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  const existingChecklist = item.checklist || {}

  function clickStatus(s) {
    if (s.requiresReason || s.requiresChecklist) {
      setReasonType(resolutionTypes[0] || '')
      setReasonNote('')
      setChecklistAnswers({})
      setPending({ status: s.name, needsReason: s.requiresReason, needsChecklist: s.requiresChecklist })
    } else {
      onChangeStatus(item.id, s.name)
    }
  }

  const checklistComplete = !pending?.needsChecklist || checklistItems.every((c) => checklistAnswers[c] !== undefined)
  const reasonComplete = !pending?.needsReason || reasonNote.trim()
  const canConfirm = pending && checklistComplete && reasonComplete

  async function submitNote(e) {
    e.preventDefault()
    if (!noteText.trim()) return
    setBusy(true)
    await onAddNote(item.id, noteText.trim())
    setNoteText('')
    setBusy(false)
  }

  async function submitPending(e) {
    e.preventDefault()
    if (!canConfirm) return
    setBusy(true)
    await onApplyPendingStatus(item.id, pending.status, {
      resolutionType: pending.needsReason ? reasonType : undefined,
      resolutionNote: pending.needsReason ? reasonNote.trim() : undefined,
      checklistAnswers: pending.needsChecklist ? checklistAnswers : undefined,
    })
    setBusy(false)
    setPending(null)
  }

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <div>
            {item.account_id && <div className="acct-id mono">{item.account_id}</div>}
            <h2>{item.account_name || item.description || 'Untitled account'}</h2>
            <div className="faint">Updated {timeAgo(item.updated_at)}</div>
          </div>
          <button className="btn ghost sm" onClick={onClose}>Close</button>
        </div>

        <div className="section-label">Status</div>
        {!pending ? (
          <select
            value={item.status}
            onChange={(e) => clickStatus(statuses.find((s) => s.name === e.target.value))}
            disabled={busy}
            style={{ marginBottom: 16 }}
          >
            {statuses.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        ) : (
          <form onSubmit={submitPending} className="card" style={{ padding: 12, marginBottom: 16 }}>
            <div className="faint" style={{ marginBottom: 8 }}>Setting status to <b>{pending.status}</b> — a few things first.</div>

            {pending.needsReason && (
              <>
                <div className="section-label" style={{ marginTop: 0 }}>Reason</div>
                <select value={reasonType} onChange={(e) => setReasonType(e.target.value)}>
                  {resolutionTypes.map((rt) => (
                    <option key={rt} value={rt}>{rt}</option>
                  ))}
                </select>
                <div className="section-label">Note (required)</div>
                <textarea
                  autoFocus
                  placeholder="What happened with this account?"
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                />
              </>
            )}

            {pending.needsChecklist && (
              <>
                <div className="section-label" style={{ marginTop: pending.needsReason ? 20 : 0 }}>Completion checklist</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {checklistItems.map((c) => (
                    <div key={c}>
                      <div style={{ fontSize: 13, marginBottom: 6 }}>{c}</div>
                      <div className="filter-row" style={{ marginBottom: 0 }}>
                        <button
                          type="button"
                          className={`chip ${checklistAnswers[c] === true ? 'active' : ''}`}
                          onClick={() => setChecklistAnswers((a) => ({ ...a, [c]: true }))}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={`chip ${checklistAnswers[c] === false ? 'active' : ''}`}
                          onClick={() => setChecklistAnswers((a) => ({ ...a, [c]: false }))}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn" disabled={busy || !canConfirm}>Confirm</button>
              <button type="button" className="btn secondary" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </form>
        )}

        <div className="section-label">Assigned to</div>
        <select
          value={item.assigned_to || ''}
          onChange={(e) => onAssign(item.id, e.target.value || null)}
          style={{ marginBottom: 16 }}
        >
          <option value="">Unassigned</option>
          {teamMembers.filter((m) => m.active).map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>

        <div className="section-label">Follow up date</div>
        <input
          type="date"
          value={item.follow_up_date || ''}
          onChange={(e) => onUpdateFollowUpDate(item.id, e.target.value)}
          style={{ marginBottom: 16 }}
        />

        <div className="section-label">Account details</div>
        <div className="card" style={{ padding: 12 }}>
          {item.client && <div className="meta" style={{ marginBottom: 6 }}>Client: <b className="mono">{item.client}</b></div>}
          {item.vendor && <div className="meta" style={{ marginBottom: 6 }}>Utility: <b className="mono">{item.vendor}</b></div>}
          {item.amount !== null && item.amount !== undefined && item.amount !== '' && (
            <div className="meta" style={{ marginBottom: 6 }}>Avg Current Charges: <b className="mono">${Number(item.amount).toLocaleString()}</b></div>
          )}
          {item.description && <div className="meta">{item.description}</div>}
        </div>

        {extraEntries.length > 0 && (
          <>
            <div className="section-label">Additional fields</div>
            <div className="extra-fields-grid">
              {extraEntries.map(([k, v]) => (
                <div className="extra-field" key={k}>
                  <div className="k">{k}</div>
                  <div className="v">{String(v)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {(item.resolution_note || item.resolution_type) && (
          <div className="card" style={{ marginTop: 4, marginBottom: 16, padding: 12, background: 'var(--surface-sunken)' }}>
            <div className="section-label" style={{ marginTop: 0 }}>Reason on file</div>
            {item.resolution_type && <div className="faint" style={{ marginBottom: 4 }}>{item.resolution_type}</div>}
            <div style={{ fontSize: 13 }}>{item.resolution_note}</div>
          </div>
        )}

        {Object.keys(existingChecklist).length > 0 && (
          <div className="card" style={{ marginTop: 4, marginBottom: 16, padding: 12, background: 'var(--surface-sunken)' }}>
            <div className="section-label" style={{ marginTop: 0 }}>Completion checklist</div>
            {checklistItems.filter((c) => existingChecklist[c] !== undefined).map((c) => (
              <div key={c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{c}</span>
                <b style={{ color: existingChecklist[c] ? 'var(--evening-sea)' : 'var(--danger)' }}>
                  {existingChecklist[c] ? 'Yes' : 'No'}
                </b>
              </div>
            ))}
          </div>
        )}

        <div className="section-label">Notes ({notes.length})</div>
        {notes.length === 0 && <div className="faint" style={{ marginBottom: 10 }}>No notes yet.</div>}
        {notes.map((n) => (
          <div className="note-item" key={n.id}>
            <div className="note-meta">{n.author} · {timeAgo(n.created_at)}</div>
            <div className="note-text">{n.note}</div>
          </div>
        ))}

        <form onSubmit={submitNote} style={{ marginTop: 10 }}>
          <textarea
            placeholder={`Add a note as ${currentUser}…`}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button type="submit" className="btn secondary sm" style={{ marginTop: 6 }} disabled={busy || !noteText.trim()}>
            Add note
          </button>
        </form>
      </div>
    </div>
  )
}
