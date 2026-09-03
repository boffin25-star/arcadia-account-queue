import * as XLSX from 'xlsx'
import { CORE_FIELDS } from '../constants.js'

function formatNotes(notes) {
  if (!notes || !notes.length) return ''
  return notes
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((n) => {
      const d = n.created_at ? new Date(n.created_at).toLocaleString() : ''
      return `[${d}] ${n.author}: ${n.note}`
    })
    .join('\n')
}

export function exportQueueToExcel(items, checklistItems = [], filename = 'arcadia-account-queue-export.xlsx') {
  // Union of all extra_fields keys across every item, so every row gets a
  // column even if only some accounts used it.
  const extraKeys = []
  const seen = new Set()
  for (const it of items) {
    for (const k of Object.keys(it.extra_fields || {})) {
      if (!seen.has(k)) { seen.add(k); extraKeys.push(k) }
    }
  }

  const rows = items.map((it) => {
    const row = {}
    for (const field of CORE_FIELDS) {
      row[field.label] = it[field.key] ?? ''
    }
    row['Status'] = it.status
    row['Assigned To'] = it.assigned_to || ''
    row['Excluded Reason'] = it.resolution_type || ''
    row['Resolution Note'] = it.resolution_note || ''
    for (const c of checklistItems) {
      const v = it.checklist ? it.checklist[c] : undefined
      row[c] = v === undefined ? '' : (v ? 'Yes' : 'No')
    }
    row['Note Count'] = (it.notes || []).length
    row['All Notes'] = formatNotes(it.notes)
    row['Created'] = it.created_at ? new Date(it.created_at).toLocaleString() : ''
    row['Updated'] = it.updated_at ? new Date(it.updated_at).toLocaleString() : ''
    for (const k of extraKeys) {
      row[k] = it.extra_fields?.[k] ?? ''
    }
    return row
  })

  // One row per note across every account, so notes can be filtered and
  // sorted in Excel independently of which account they belong to.
  const noteRows = []
  for (const it of items) {
    const sortedNotes = (it.notes || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    for (const n of sortedNotes) {
      noteRows.push({
        'Account Number': it.account_id || '',
        'Customer': it.account_name || it.description || '',
        'Author': n.author || '',
        'Date': n.created_at ? new Date(n.created_at).toLocaleString() : '',
        'Note': n.note || '',
      })
    }
  }

  const wb = XLSX.utils.book_new()

  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Account Queue')

  const notesWs = XLSX.utils.json_to_sheet(
    noteRows.length ? noteRows : [{ 'Account Number': '', Customer: '', Author: '', Date: '', Note: '' }]
  )
  XLSX.utils.book_append_sheet(wb, notesWs, 'Notes')

  XLSX.writeFile(wb, filename)
}
