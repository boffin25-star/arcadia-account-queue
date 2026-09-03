import React, { useMemo, useState } from 'react'
import { getFieldValue } from '../utils/fields.js'

const DUE_SOON_DAYS = 2
const AMBER = '#D97706'
const RED = '#D64545'
const IN_PROGRESS_BLUE = '#64CCDB'
const OTHER_GRAY = '#64748B'
const ALERT_RED_TEXT = '#A32D2D'
const ALERT_RED_BG = '#F6D5D5'
const ALERT_ORANGE_TEXT = '#8A4E09'
const ALERT_ORANGE_BG = '#F9E3C8'
const ALERT_ORANGE_BORDER = '#B45309'
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200, 500]
const DEFAULT_COLUMN_WIDTHS = {
  alert: 40,
  status: 230,
  assigned_to: 130,
  account_id: 110,
  account_name: 160,
  follow_up_date: 150,
  amount: 120,
}
const MIN_COLUMN_WIDTH = 50

function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

function isInProgressStatus(statusName) {
  return String(statusName || '').trim().toLowerCase().startsWith('in-progress')
}

// The single source of truth for "is this account overdue / due today" —
// used by the row coloring, the sortable ! column, and its filter.
function getAlertLabel(item, statuses) {
  const statusDef = statuses.find((s) => s.name === item.status)
  if (statusDef?.isTerminal) return ''
  const days = daysUntil(item.follow_up_date)
  if (days === null) return ''
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due today'
  return ''
}

function alertTheme(label) {
  if (label === 'Overdue') return { bg: ALERT_RED_BG, text: ALERT_RED_TEXT, border: ALERT_RED_TEXT }
  if (label === 'Due today') return { bg: ALERT_ORANGE_BG, text: ALERT_ORANGE_TEXT, border: ALERT_ORANGE_BORDER }
  return null
}

function getCellValue(item, key, statuses) {
  if (key === 'status') return item.status
  if (key === 'account_id') return item.account_id
  if (key === 'account_name') return item.account_name
  if (key === 'alert') return getAlertLabel(item, statuses)
  return getFieldValue(item, key)
}

function getRowStyle(item, statusDef, isSelected) {
  let style
  const days = daysUntil(item.follow_up_date)
  const isOpen = !statusDef?.isTerminal
  if (isOpen && days !== null && days < 0) {
    style = { background: `${RED}22`, color: ALERT_RED_TEXT }
  } else if (isOpen && days === 0) {
    style = { background: `${AMBER}22`, color: ALERT_ORANGE_TEXT }
  } else if (isOpen && days !== null && days <= DUE_SOON_DAYS) {
    style = { background: `${AMBER}22` }
  } else if (statusDef?.isTerminal) {
    style = { background: `${statusDef.color || OTHER_GRAY}26` }
  } else if (isInProgressStatus(item.status)) {
    style = { background: `${IN_PROGRESS_BLUE}33` }
  } else {
    style = { background: `${OTHER_GRAY}1f` }
  }
  if (isSelected) style = { ...style, boxShadow: 'inset 0 0 0 2px var(--evening-sea)' }
  return style
}

function FollowUpBadge({ value }) {
  const days = daysUntil(value)
  if (days === null) return null
  if (days < 0) return <span className="due-badge overdue">{Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="due-badge soon">Due today</span>
  if (days <= DUE_SOON_DAYS) return <span className="due-badge soon">Due in {days}d</span>
  return null
}

function FilterControl({ meta, value, onChange }) {
  if (meta.kind === 'select') {
    const selected = value || []
    return (
      <details className="col-filter-select">
        <summary>{selected.length ? `${selected.length} selected` : 'All'}</summary>
        <div className="col-filter-panel">
          {meta.options.map((opt) => (
            <label key={opt} className="col-filter-option">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => {
                  const next = selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt]
                  onChange(next)
                }}
              />
              {opt}
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" className="col-filter-clear" onClick={() => onChange([])}>Clear</button>
          )}
        </div>
      </details>
    )
  }
  if (meta.kind === 'number') {
    return (
      <div className="col-filter-number">
        <input type="number" placeholder="Min" value={value?.min ?? ''} onChange={(e) => onChange({ ...(value || {}), min: e.target.value })} />
        <input type="number" placeholder="Max" value={value?.max ?? ''} onChange={(e) => onChange({ ...(value || {}), max: e.target.value })} />
      </div>
    )
  }
  if (meta.kind === 'date') {
    return (
      <select value={value || 'all'} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All</option>
        <option value="overdue">Overdue</option>
        <option value="today">Due today</option>
        <option value="soon">Due ≤ {DUE_SOON_DAYS}d</option>
        <option value="upcoming">Upcoming</option>
        <option value="no_date">No date</option>
      </select>
    )
  }
  return (
    <input type="text" className="col-filter-text" placeholder="Filter…" value={value || ''} onChange={(e) => onChange(e.target.value)} />
  )
}

function AssignPicker({ teamMembers, onPick, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 320 }}>
        <h2 style={{ marginTop: 0 }}>Assign to…</h2>
        <div className="name-grid">
          {teamMembers.filter((m) => m.active).map((m) => (
            <button key={m.id} onClick={() => onPick(m.name)}>{m.name}</button>
          ))}
        </div>
        <button className="btn secondary block" style={{ marginTop: 12 }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function BulkStatusModal({ statuses, resolutionTypes, checklistItems, count, initialStatus, onConfirm, onCancel }) {
  const [statusName, setStatusName] = useState(initialStatus || statuses[0]?.name || '')
  const [reasonType, setReasonType] = useState(resolutionTypes[0] || '')
  const [reasonNote, setReasonNote] = useState('')
  const [checklistAnswers, setChecklistAnswers] = useState({})

  const statusDef = statuses.find((s) => s.name === statusName)
  const needsReason = !!statusDef?.requiresReason
  const needsChecklist = !!statusDef?.requiresChecklist
  const checklistComplete = !needsChecklist || checklistItems.every((c) => checklistAnswers[c] !== undefined)
  const reasonComplete = !needsReason || reasonNote.trim()
  const canConfirm = !!statusName && checklistComplete && reasonComplete

  function submit(e) {
    e.preventDefault()
    if (!canConfirm) return
    onConfirm(statusName, {
      resolutionType: needsReason ? reasonType : undefined,
      resolutionNote: needsReason ? reasonNote.trim() : undefined,
      checklistAnswers: needsChecklist ? checklistAnswers : undefined,
    })
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>Bulk update {count} item{count === 1 ? '' : 's'}</h2>

        <div className="section-label" style={{ marginTop: 0 }}>New status</div>
        <select value={statusName} onChange={(e) => { setStatusName(e.target.value); setChecklistAnswers({}) }}>
          {statuses.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>

        {needsReason && (
          <>
            <div className="section-label">Reason</div>
            <select value={reasonType} onChange={(e) => setReasonType(e.target.value)}>
              {resolutionTypes.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
            </select>
            <div className="section-label">Note (required, applied to all selected)</div>
            <textarea value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} placeholder="What happened with these accounts?" />
          </>
        )}

        {needsChecklist && (
          <>
            <div className="section-label">Completion checklist (applied to all selected)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {checklistItems.map((c) => (
                <div key={c}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>{c}</div>
                  <div className="filter-row" style={{ marginBottom: 0 }}>
                    <button type="button" className={`chip ${checklistAnswers[c] === true ? 'active' : ''}`} onClick={() => setChecklistAnswers((a) => ({ ...a, [c]: true }))}>Yes</button>
                    <button type="button" className={`chip ${checklistAnswers[c] === false ? 'active' : ''}`} onClick={() => setChecklistAnswers((a) => ({ ...a, [c]: false }))}>No</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="submit" className="btn" disabled={!canConfirm}>Apply to {count}</button>
          <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

export default function QueueView({
  items, currentUser, onOpen, statuses, columns,
  teamMembers, resolutionTypes, checklistItems,
  onBulkAssign, onBulkApplyStatus, onUpdateFollowUpDate, onExport,
}) {
  const [search, setSearch] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [filters, setFilters] = useState(() => ({
    status: statuses.filter((s) => !s.isTerminal).map((s) => s.name),
  }))
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [columnWidths, setColumnWidths] = useState({})
  const [showAssignPicker, setShowAssignPicker] = useState(false)
  const [statusModal, setStatusModal] = useState(null) // { ids, presetStatus?, isBulk }

  function getColWidth(key) {
    return columnWidths[key] ?? DEFAULT_COLUMN_WIDTHS[key] ?? 130
  }

  function startResize(e, key) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = getColWidth(key)
    function onMouseMove(moveEvent) {
      const next = Math.max(MIN_COLUMN_WIDTH, startWidth + (moveEvent.clientX - startX))
      setColumnWidths((w) => ({ ...w, [key]: next }))
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const allColumns = useMemo(() => {
    const assignedCol = columns.find((c) => c.key === 'assigned_to')
    const rest = columns.filter((c) => c.key !== 'assigned_to')
    const base = [{ key: 'alert', label: '!' }, { key: 'status', label: 'Status' }]
    if (assignedCol) base.push({ key: 'assigned_to', label: 'Assigned To' })
    base.push(
      { key: 'account_id', label: 'Account #' },
      { key: 'account_name', label: 'Customer' },
      ...rest.map((c) => ({ key: c.key, label: c.label }))
    )
    return base
  }, [columns])

  const columnMeta = useMemo(() => {
    const meta = {}
    for (const col of allColumns) {
      if (col.key === 'alert') {
        meta[col.key] = { kind: 'select', options: ['Overdue', 'Due today'] }
        continue
      }
      if (col.key === 'status') {
        meta[col.key] = { kind: 'select', options: statuses.map((s) => s.name) }
        continue
      }
      if (col.key === 'amount') {
        meta[col.key] = { kind: 'number' }
        continue
      }
      if (col.key === 'follow_up_date') {
        meta[col.key] = { kind: 'date' }
        continue
      }
      const uniques = new Set()
      for (const it of items) {
        const v = getCellValue(it, col.key, statuses)
        if (v !== undefined && v !== null && v !== '') uniques.add(String(v))
      }
      meta[col.key] = uniques.size > 0 && uniques.size <= 12
        ? { kind: 'select', options: Array.from(uniques).sort() }
        : { kind: 'text' }
    }
    return meta
  }, [allColumns, items, statuses])

  const terminalNames = new Set(statuses.filter((s) => s.isTerminal).map((s) => s.name))
  const terminalNameList = statuses.filter((s) => s.isTerminal).map((s) => s.name)
  const showingCompleted = terminalNameList.length > 0 && terminalNameList.some((n) => (filters.status || []).includes(n))

  function toggleShowCompleted() {
    setFilters((f) => {
      const current = f.status || []
      const next = showingCompleted
        ? current.filter((n) => !terminalNameList.includes(n))
        : [...current, ...terminalNameList.filter((n) => !current.includes(n))]
      return { ...f, status: next }
    })
    setPage(1)
  }

  const counts = useMemo(() => {
    const c = { total: items.length, open: 0, mine: 0, done: 0 }
    for (const it of items) {
      if (terminalNames.has(it.status)) c.done += 1
      else c.open += 1
      if (it.assigned_to === currentUser) c.mine += 1
    }
    return c
  }, [items, currentUser, terminalNames])

  const followUpCallout = useMemo(() => {
    let overdue = 0
    let dueToday = 0
    for (const it of items) {
      if (terminalNames.has(it.status)) continue
      const days = daysUntil(it.follow_up_date)
      if (days === null) continue
      if (days < 0) overdue += 1
      else if (days === 0) dueToday += 1
    }
    return { overdue, dueToday }
  }, [items, terminalNames])

  function passesFilter(item, col) {
    const meta = columnMeta[col.key]
    const val = filters[col.key]
    if (meta.kind === 'select') {
      if (!val || val.length === 0) return true
      return val.includes(String(getCellValue(item, col.key, statuses) ?? ''))
    }
    if (meta.kind === 'text') {
      if (!val) return true
      return String(getCellValue(item, col.key, statuses) ?? '').toLowerCase().includes(val.toLowerCase())
    }
    if (meta.kind === 'number') {
      const v = Number(getCellValue(item, col.key, statuses))
      if (val?.min !== undefined && val.min !== '' && v < Number(val.min)) return false
      if (val?.max !== undefined && val.max !== '' && v > Number(val.max)) return false
      return true
    }
    if (meta.kind === 'date') {
      const preset = val || 'all'
      if (preset === 'all') return true
      const days = daysUntil(getCellValue(item, col.key, statuses))
      if (preset === 'no_date') return days === null
      if (days === null) return false
      if (preset === 'overdue') return days < 0
      if (preset === 'today') return days === 0
      if (preset === 'soon') return days >= 0 && days <= DUE_SOON_DAYS
      if (preset === 'upcoming') return days > DUE_SOON_DAYS
      return true
    }
    return true
  }

  function getSortValue(item, key) {
    if (key === 'alert') {
      const label = getCellValue(item, key, statuses)
      if (label === 'Overdue') return 0
      if (label === 'Due today') return 1
      return 2
    }
    if (key === 'status') {
      const idx = statuses.findIndex((s) => s.name === item.status)
      return idx === -1 ? 999 : idx
    }
    const meta = columnMeta[key]
    const v = getCellValue(item, key, statuses)
    if (meta?.kind === 'number') return Number(v) || 0
    if (key === 'follow_up_date') {
      const t = v ? new Date(v).getTime() : NaN
      return isNaN(t) ? Infinity : t
    }
    return String(v ?? '').toLowerCase()
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const rows = useMemo(() => {
    let list = items.filter((it) => {
      if (onlyMine && it.assigned_to !== currentUser) return false
      for (const col of allColumns) {
        if (!passesFilter(it, col)) return false
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const hay = [it.account_id, it.account_name, it.client, it.vendor, it.description]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const va = getSortValue(a, sortKey)
        const vb = getSortValue(b, sortKey)
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else {
      list = [...list].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filters, search, onlyMine, sortKey, sortDir, allColumns, columnMeta, currentUser])

  const effectivePageSize = pageSize === 'all' ? Math.max(rows.length, 1) : pageSize
  const totalPages = Math.max(1, Math.ceil(rows.length / effectivePageSize))
  const clampedPage = Math.min(page, totalPages)
  const pageStart = (clampedPage - 1) * effectivePageSize
  const pageRows = rows.slice(pageStart, pageStart + effectivePageSize)

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
    setPage(1)
  }

  function handlePageSizeChange(e) {
    const v = e.target.value
    setPageSize(v === 'all' ? 'all' : Number(v))
    setPage(1)
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = pageRows.length > 0 && pageRows.every((r) => next.has(r.id))
      if (allSelected) pageRows.forEach((r) => next.delete(r.id))
      else pageRows.forEach((r) => next.add(r.id))
      return next
    })
  }

  function toggleSelectRow(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCount = selectedIds.size
  const selectedIdsArray = Array.from(selectedIds)

  function handleAssignToMe() {
    onBulkAssign(selectedIdsArray, currentUser)
    setSelectedIds(new Set())
  }
  function handleUnassign() {
    onBulkAssign(selectedIdsArray, null)
    setSelectedIds(new Set())
  }
  function handleAssignPick(name) {
    onBulkAssign(selectedIdsArray, name)
    setSelectedIds(new Set())
    setShowAssignPicker(false)
  }
  function openBulkStatusModal() {
    setStatusModal({ ids: selectedIdsArray, isBulk: true })
  }
  function handleInlineStatusChange(item, newStatusName) {
    const statusDef = statuses.find((s) => s.name === newStatusName)
    if (statusDef?.requiresReason || statusDef?.requiresChecklist) {
      setStatusModal({ ids: [item.id], presetStatus: newStatusName, isBulk: false })
    } else {
      onBulkApplyStatus([item.id], newStatusName, {})
    }
  }
  function handleStatusModalConfirm(statusName, fields) {
    if (!statusModal) return
    onBulkApplyStatus(statusModal.ids, statusName, fields)
    if (statusModal.isBulk) setSelectedIds(new Set())
    setStatusModal(null)
  }
  function handleStatusModalCancel() {
    setStatusModal(null)
  }

  const appliedFilterChips = []
  if (onlyMine) appliedFilterChips.push({ key: '__mine', label: 'Assigned to me', clear: () => setOnlyMine(false) })
  for (const col of allColumns) {
    const meta = columnMeta[col.key]
    const val = filters[col.key]
    let active = false
    if (meta?.kind === 'select') active = !!(val && val.length > 0)
    else if (meta?.kind === 'text') active = !!val
    else if (meta?.kind === 'number') active = !!((val?.min !== undefined && val.min !== '') || (val?.max !== undefined && val.max !== ''))
    else if (meta?.kind === 'date') active = !!(val && val !== 'all')
    if (active) {
      appliedFilterChips.push({ key: col.key, label: col.label, clear: () => updateFilter(col.key, undefined) })
    }
  }

  function clearAllFilters() {
    setFilters({})
    setOnlyMine(false)
    setPage(1)
  }

  const tableWidth = 36 * 3 + allColumns.reduce((sum, col) => sum + getColWidth(col.key), 0)

  return (
    <div>
      <div className="stat-row">
        <div className="stat-box"><div className="num">{counts.total}</div><div className="lbl">Total</div></div>
        <div className="stat-box"><div className="num">{counts.open}</div><div className="lbl">Open</div></div>
        <div className="stat-box"><div className="num">{counts.mine}</div><div className="lbl">Assigned to me</div></div>
        <div className="stat-box"><div className="num">{counts.done}</div><div className="lbl">Done</div></div>
      </div>

      <div className="queue-actions-toolbar">
        <button className="toolbar-btn" disabled={!selectedCount} onClick={handleAssignToMe}>Assign to me</button>
        <button className="toolbar-btn" disabled={!selectedCount} onClick={handleUnassign}>Unassign</button>
        <button className="toolbar-btn" disabled={!selectedCount} onClick={() => setShowAssignPicker(true)}>Assign to…</button>
        <button className="toolbar-btn" disabled={!selectedCount} onClick={openBulkStatusModal}>Bulk Update Status</button>
        <button className="toolbar-btn primary" onClick={onExport}>Export Grid</button>
      </div>

      {(followUpCallout.overdue > 0 || followUpCallout.dueToday > 0) && (
        <div className="followup-callout-row">
          {followUpCallout.overdue > 0 && (
            <button type="button" className="callout-chip overdue" onClick={() => updateFilter('follow_up_date', 'overdue')}>
              ⚠ {followUpCallout.overdue} overdue
            </button>
          )}
          {followUpCallout.dueToday > 0 && (
            <button type="button" className="callout-chip today" onClick={() => updateFilter('follow_up_date', 'today')}>
              📅 {followUpCallout.dueToday} due today
            </button>
          )}
        </div>
      )}

      {appliedFilterChips.length > 0 && (
        <div className="applied-filters-row">
          <span className="applied-filters-label">Applied filters ({appliedFilterChips.length}):</span>
          {appliedFilterChips.map((c) => (
            <span key={c.key} className="filter-chip">
              {c.label}
              <button type="button" onClick={c.clear}>×</button>
            </span>
          ))}
          <button type="button" className="clear-filters-link" onClick={clearAllFilters}>Clear Filters</button>
        </div>
      )}

      <div className="queue-toolbar">
        <input
          type="search"
          placeholder="Search account, client, vendor…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <button className={`chip ${onlyMine ? 'active' : ''}`} onClick={() => { setOnlyMine((v) => !v); setPage(1) }}>
          Only mine
        </button>
        <button className={`chip ${showingCompleted ? 'active' : ''}`} onClick={toggleShowCompleted}>
          {showingCompleted ? 'Hide completed/excluded' : 'Show completed/excluded'}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <span className="glyph">[ ]</span>
          Nothing matches these filters. Adjust them or drop in a new spreadsheet.
        </div>
      ) : (
        <>
          <div className="queue-table-wrap">
            <table className="queue-table" style={{ width: tableWidth }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 36 }} />
                <col style={{ width: 36 }} />
                {allColumns.map((col) => (
                  <col key={col.key} style={{ width: getColWidth(col.key) }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id))}
                      onChange={toggleSelectAllOnPage}
                    />
                  </th>
                  <th className="col-num">#</th>
                  <th className="col-action">Action</th>
                  {allColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`sortable ${col.key === 'alert' ? 'col-alert' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                      <span
                        className="col-resize-handle"
                        onMouseDown={(e) => startResize(e, col.key)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </th>
                  ))}
                </tr>
                <tr className="filter-row-tr">
                  <th></th>
                  <th></th>
                  <th></th>
                  {allColumns.map((col) => (
                    <th key={col.key}>
                      <FilterControl
                        meta={columnMeta[col.key]}
                        value={filters[col.key]}
                        onChange={(v) => updateFilter(col.key, v)}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((item, idx) => {
                  const statusDef = statuses.find((s) => s.name === item.status)
                  const color = statusDef?.color || '#64748B'
                  const isSelected = selectedIds.has(item.id)
                  const alertLabel = getAlertLabel(item, statuses)
                  const theme = alertTheme(alertLabel)
                  return (
                    <tr key={item.id} style={getRowStyle(item, statusDef, isSelected)}>
                      <td className="col-check">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelectRow(item.id)} />
                      </td>
                      <td className="col-num faint mono">{pageStart + idx + 1}</td>
                      <td className="col-action">
                        <button type="button" className="edit-btn" onClick={() => onOpen(item)} aria-label="Edit">✎</button>
                      </td>
                      {allColumns.map((col) => {
                        if (col.key === 'alert') {
                          return (
                            <td key={col.key} className="col-alert">
                              {alertLabel === 'Overdue' && <span style={{ color: ALERT_RED_TEXT, fontWeight: 900, fontSize: 15 }}>!</span>}
                              {alertLabel === 'Due today' && <span style={{ color: ALERT_ORANGE_TEXT, fontWeight: 900, fontSize: 15 }}>!</span>}
                            </td>
                          )
                        }
                        if (col.key === 'status') {
                          return (
                            <td key={col.key}>
                              <select
                                className="status-select"
                                value={item.status}
                                onChange={(e) => handleInlineStatusChange(item, e.target.value)}
                                style={theme
                                  ? { background: theme.bg, color: theme.text, borderColor: theme.border }
                                  : { background: `${color}26`, color, borderColor: color }}
                              >
                                {statuses.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                              </select>
                            </td>
                          )
                        }
                        if (col.key === 'account_id') return <td key={col.key} className="mono">{item.account_id || '—'}</td>
                        if (col.key === 'account_name') return <td key={col.key}>{item.account_name || item.description || '—'}</td>
                        if (col.key === 'follow_up_date') {
                          return (
                            <td key={col.key}>
                              <input
                                type="date"
                                value={item.follow_up_date || ''}
                                onChange={(e) => onUpdateFollowUpDate(item.id, e.target.value)}
                                style={theme ? { color: theme.text } : undefined}
                              />
                              <FollowUpBadge value={item.follow_up_date} />
                            </td>
                          )
                        }
                        if (col.key === 'assigned_to') {
                          return (
                            <td key={col.key}>
                              <select
                                value={item.assigned_to || ''}
                                onChange={(e) => onBulkAssign([item.id], e.target.value || null)}
                                style={theme ? { color: theme.text, borderColor: theme.border } : undefined}
                              >
                                <option value="">Unassigned</option>
                                {teamMembers.filter((m) => m.active).map((m) => (
                                  <option key={m.id} value={m.name}>{m.name}</option>
                                ))}
                              </select>
                            </td>
                          )
                        }
                        const val = getFieldValue(item, col.key)
                        if (val === undefined || val === null || val === '') return <td key={col.key} className="faint">—</td>
                        return <td key={col.key}>{col.key === 'amount' ? `$${Number(val).toLocaleString()}` : String(val)}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label className="faint" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Rows:
                <select className="page-size-select" value={pageSize} onChange={handlePageSizeChange}>
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  <option value="all">All</option>
                </select>
              </label>
              <span className="faint">Showing {pageStart + 1} to {Math.min(pageStart + effectivePageSize, rows.length)} of {rows.length} items</span>
            </div>
            <div className="pagination-controls">
              <button disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
              <span className="faint">Page {clampedPage} of {totalPages}</span>
              <button disabled={clampedPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
            </div>
          </div>
        </>
      )}

      {showAssignPicker && (
        <AssignPicker teamMembers={teamMembers} onPick={handleAssignPick} onClose={() => setShowAssignPicker(false)} />
      )}
      {statusModal && (
        <BulkStatusModal
          statuses={statuses}
          resolutionTypes={resolutionTypes}
          checklistItems={checklistItems}
          count={statusModal.ids.length}
          initialStatus={statusModal.presetStatus}
          onConfirm={handleStatusModalConfirm}
          onCancel={handleStatusModalCancel}
        />
      )}
    </div>
  )
}
