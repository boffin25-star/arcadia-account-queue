import React, { useMemo } from 'react'

const DUE_SOON_DAYS = 2

function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

function BarRow({ label, subLabel, count, total, color }) {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0
  return (
    <div className="metric-row">
      <div className="metric-row-label">
        {color && <span className="metric-dot" style={{ background: color }} />}
        <div>
          <div className="name">{label}</div>
          {subLabel && <div className="faint">{subLabel}</div>}
        </div>
      </div>
      <div className="metric-row-bar-wrap">
        <div className="metric-row-bar" style={{ width: `${pct}%`, background: color || 'var(--evening-sea)' }} />
      </div>
      <div className="metric-row-count mono">{count}</div>
    </div>
  )
}

export default function MetricsView({ items, statuses, teamMembers, resolutionTypes }) {
  const terminalNames = useMemo(() => new Set(statuses.filter((s) => s.isTerminal).map((s) => s.name)), [statuses])

  const total = items.length
  const openCount = useMemo(() => items.filter((it) => !terminalNames.has(it.status)).length, [items, terminalNames])
  const doneCount = total - openCount
  const unassignedCount = useMemo(() => items.filter((it) => !it.assigned_to).length, [items])

  const statusCounts = useMemo(() => (
    statuses.map((s) => ({ name: s.name, color: s.color, count: items.filter((it) => it.status === s.name).length }))
  ), [items, statuses])

  const employeeCounts = useMemo(() => {
    const rows = teamMembers.filter((m) => m.active).map((m) => {
      const open = items.filter((it) => it.assigned_to === m.name && !terminalNames.has(it.status)).length
      const done = items.filter((it) => it.assigned_to === m.name && terminalNames.has(it.status)).length
      return { name: m.name, open, done, total: open + done }
    })
    const unOpen = items.filter((it) => !it.assigned_to && !terminalNames.has(it.status)).length
    const unDone = items.filter((it) => !it.assigned_to && terminalNames.has(it.status)).length
    rows.push({ name: 'Unassigned', open: unOpen, done: unDone, total: unOpen + unDone })
    return rows
  }, [items, teamMembers, terminalNames])

  const followUp = useMemo(() => {
    let overdue = 0
    let dueToday = 0
    let soon = 0
    let upcoming = 0
    let noDate = 0
    for (const it of items) {
      if (terminalNames.has(it.status)) continue
      const days = daysUntil(it.follow_up_date)
      if (days === null) { noDate += 1; continue }
      if (days < 0) overdue += 1
      else if (days === 0) dueToday += 1
      else if (days <= DUE_SOON_DAYS) soon += 1
      else upcoming += 1
    }
    return { overdue, dueToday, soon, upcoming, noDate }
  }, [items, terminalNames])

  const excludedReasonCounts = useMemo(() => (
    resolutionTypes.map((rt) => ({ name: rt, count: items.filter((it) => it.resolution_type === rt).length }))
  ), [items, resolutionTypes])

  const maxStatusCount = Math.max(1, ...statusCounts.map((s) => s.count))
  const maxEmployeeCount = Math.max(1, ...employeeCounts.map((e) => e.total))
  const maxReasonCount = Math.max(1, ...excludedReasonCounts.map((r) => r.count))
  const followUpTotal = openCount || 1

  return (
    <div>
      <div className="metrics-summary">
        <div className="stat-box"><div className="num">{total}</div><div className="lbl">Total</div></div>
        <div className="stat-box"><div className="num">{openCount}</div><div className="lbl">Open</div></div>
        <div className="stat-box"><div className="num">{doneCount}</div><div className="lbl">Done</div></div>
        <div className="stat-box"><div className="num">{unassignedCount}</div><div className="lbl">Unassigned</div></div>
        <div className="stat-box"><div className="num" style={{ color: 'var(--danger)' }}>{followUp.overdue}</div><div className="lbl">Overdue</div></div>
        <div className="stat-box"><div className="num" style={{ color: '#B45309' }}>{followUp.dueToday}</div><div className="lbl">Due Today</div></div>
      </div>

      <div className="section-label" style={{ marginTop: 0 }}>By status</div>
      <div className="card metrics-card">
        {statusCounts.map((s) => (
          <BarRow key={s.name} label={s.name} count={s.count} total={maxStatusCount} color={s.color} />
        ))}
      </div>

      <div className="section-label">By employee</div>
      <div className="card metrics-card">
        {employeeCounts.map((e) => (
          <BarRow
            key={e.name}
            label={e.name}
            subLabel={`${e.open} open · ${e.done} done`}
            count={e.total}
            total={maxEmployeeCount}
            color="var(--blue-marguerite)"
          />
        ))}
      </div>

      <div className="section-label">Follow-ups (open items)</div>
      <div className="card metrics-card">
        <BarRow label="Overdue" count={followUp.overdue} total={followUpTotal} color="var(--danger)" />
        <BarRow label="Due today" count={followUp.dueToday} total={followUpTotal} color="#B45309" />
        <BarRow label={`Due in ≤${DUE_SOON_DAYS}d`} count={followUp.soon} total={followUpTotal} color="var(--blue-marguerite)" />
        <BarRow label="Upcoming" count={followUp.upcoming} total={followUpTotal} color="var(--viking)" />
        <BarRow label="No follow-up date" count={followUp.noDate} total={followUpTotal} color="var(--ink-faint)" />
      </div>

      {excludedReasonCounts.some((r) => r.count > 0) && (
        <>
          <div className="section-label">By excluded reason</div>
          <div className="card metrics-card">
            {excludedReasonCounts.map((r) => (
              <BarRow key={r.name} label={r.name} count={r.count} total={maxReasonCount} color="var(--electric-violet)" />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
