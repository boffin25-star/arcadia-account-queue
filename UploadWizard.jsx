import React, { useState } from 'react'
import { CORE_FIELDS } from '../constants.js'
import { parseSpreadsheetFile, suggestColumnMap, suggestWorkflowMap } from '../utils/xlsxParse.js'

const STEPS = { PICK: 'pick', MAP: 'map', IMPORTING: 'importing', DONE: 'done' }

const WORKFLOW_FIELDS = [
  { key: 'assigned_to', label: 'Assigned To' },
  { key: 'status', label: 'Status' },
  { key: 'resolution_type', label: 'Reason (e.g. Excluded Reason)' },
]

export default function UploadWizard({ currentUser, onImport }) {
  const [step, setStep] = useState(STEPS.PICK)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [map, setMap] = useState({})
  const [workflowMap, setWorkflowMap] = useState({})
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [result, setResult] = useState({ added: 0, skipped: 0 })

  async function handleFile(file) {
    if (!file) return
    setError('')
    try {
      const { headers, rows } = await parseSpreadsheetFile(file)
      if (!rows.length) {
        setError('That file has no rows Claude could read. Check the sheet and try again.')
        return
      }
      setFileName(file.name)
      setHeaders(headers)
      setRows(rows)
      setMap(suggestColumnMap(headers))
      setWorkflowMap(suggestWorkflowMap(headers))
      setLabel(file.name.replace(/\.[^/.]+$/, ''))
      setStep(STEPS.MAP)
    } catch (err) {
      setError('Could not parse that file. Make sure it is a valid .xlsx or .csv.')
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    handleFile(file)
  }

  const mappedHeaders = new Set([...Object.values(map), ...Object.values(workflowMap)].filter(Boolean))
  const extraHeaders = headers.filter((h) => !mappedHeaders.has(h))

  async function confirmImport() {
    setStep(STEPS.IMPORTING)
    const itemsToInsert = rows.map((row) => {
      const core = {}
      for (const field of CORE_FIELDS) {
        const sourceCol = map[field.key]
        let val = sourceCol ? row[sourceCol] : ''
        if (field.key === 'amount') {
          const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''))
          val = isNaN(num) ? null : num
        }
        core[field.key] = val === '' ? null : val
      }
      const workflow = {}
      for (const field of WORKFLOW_FIELDS) {
        const sourceCol = workflowMap[field.key]
        const val = sourceCol ? String(row[sourceCol] ?? '').trim() : ''
        workflow[field.key] = val || undefined
      }
      const extra = {}
      for (const h of extraHeaders) {
        if (row[h] !== '' && row[h] !== undefined) extra[h] = row[h]
      }
      return { ...core, ...workflow, extra_fields: extra }
    })

    const outcome = await onImport({
      filename: fileName,
      label,
      uploaded_by: currentUser,
      column_map: map,
      workflow_map: workflowMap,
      items: itemsToInsert,
    })
    setResult(outcome)
    setStep(STEPS.DONE)
  }

  function reset() {
    setStep(STEPS.PICK)
    setFileName('')
    setHeaders([])
    setRows([])
    setMap({})
    setWorkflowMap({})
    setError('')
  }

  if (step === STEPS.PICK) {
    return (
      <div className="card">
        <h2>Drop in a spreadsheet</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Every row becomes an action item in the queue. Map the columns that matter — everything else still gets saved with the account.
        </p>
        <label
          className={`dropzone ${dragActive ? 'active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <span className="glyph mono" style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>↑</span>
          Tap to choose a file, or drop it here<br />
          <span className="faint">.xlsx, .xls, or .csv</span>
        </label>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}
      </div>
    )
  }

  if (step === STEPS.MAP) {
    return (
      <div className="card">
        <h2>Map your columns</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          {fileName} · {rows.length} row{rows.length === 1 ? '' : 's'}
        </p>

        <div className="field">
          <label className="field-label">Batch label</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>

        <div className="section-label" style={{ marginTop: 0 }}>Core fields</div>
        {CORE_FIELDS.map((field) => (
          <div className="mapping-row" key={field.key}>
            <div className="col-header">{field.label}</div>
            <select
              value={map[field.key] || ''}
              onChange={(e) => setMap((m) => ({ ...m, [field.key]: e.target.value || undefined }))}
            >
              <option value="">— not mapped —</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}

        <div className="section-label">Workflow fields</div>
        <p className="faint" style={{ marginTop: -4, marginBottom: 8 }}>
          If the sheet already has these, map them so imported rows keep their existing state instead of starting fresh.
        </p>
        {WORKFLOW_FIELDS.map((field) => (
          <div className="mapping-row" key={field.key}>
            <div className="col-header">{field.label}</div>
            <select
              value={workflowMap[field.key] || ''}
              onChange={(e) => setWorkflowMap((m) => ({ ...m, [field.key]: e.target.value || undefined }))}
            >
              <option value="">— not mapped —</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}

        {extraHeaders.length > 0 && (
          <>
            <div className="section-label">Carried over as-is ({extraHeaders.length})</div>
            <p className="faint">{extraHeaders.join(', ')}</p>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn" onClick={confirmImport}>Import {rows.length} items</button>
          <button className="btn secondary" onClick={reset}>Start over</button>
        </div>
      </div>
    )
  }

  if (step === STEPS.IMPORTING) {
    return <div className="card"><h2>Importing…</h2><p className="muted">Adding rows to the queue.</p></div>
  }

  if (step === STEPS.DONE) {
    return (
      <div className="card">
        <h2>Imported</h2>
        <p className="muted">
          {result.added} item{result.added === 1 ? '' : 's'} added from {fileName}.
          {result.skipped > 0 && ` ${result.skipped} skipped — already in the queue (matched by Account ID).`}
        </p>
        <button className="btn" onClick={reset}>Upload another</button>
      </div>
    )
  }

  return null
}
