import * as XLSX from 'xlsx'

// Sheets sometimes repeat a column name (e.g. two "Notes" columns). Building
// row objects by relying on the library's own keyed mode would silently
// collide those into one key. Instead we read headers as a raw array,
// dedupe them ourselves, then zip each data row against the deduped keys.
function dedupeHeaders(headers) {
  const seen = new Map()
  return headers.map((raw) => {
    const h = String(raw ?? '').trim()
    if (!h) return h
    const count = seen.get(h) || 0
    seen.set(h, count + 1)
    return count === 0 ? h : `${h} (${count + 1})`
  })
}

// Reads a File object and returns { headers: string[], rows: object[] }
// rows are plain objects keyed by the deduped header names.
export function parseSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[firstSheetName]

        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
        if (!raw.length) {
          resolve({ headers: [], rows: [] })
          return
        }

        const rawHeaders = raw[0]
        const headers = dedupeHeaders(rawHeaders).filter((h) => h !== '')
        const headerIndex = dedupeHeaders(rawHeaders)

        const rows = raw.slice(1)
          .filter((r) => r.some((cell) => String(cell ?? '').trim() !== ''))
          .map((r) => {
            const obj = {}
            headerIndex.forEach((h, i) => {
              if (h) obj[h] = r[i] !== undefined ? r[i] : ''
            })
            return obj
          })

        resolve({ headers, rows })
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// Best-effort auto-suggestion: match spreadsheet headers to core fields by
// name similarity (exact match first, then substring), so the mapping step
// starts pre-filled where possible.
const CORE_FIELD_ALIASES = {
  account_id: ['account id', 'accountid', 'account #', 'account number', 'acct id', 'acct #', 'break_id', 'breakid'],
  account_name: ['account name', 'accountname', 'acct name', 'customer', 'customer name'],
  client: ['client', 'client name'],
  vendor: ['vendor', 'vendor name', 'utility', 'utility_name', 'utility name', 'supplier'],
  amount: ['amount', 'total', 'avg total due', 'balance', 'spend', 'total due', 'avgcurrentcharges', 'avg current charges', 'avgcurrentch'],
  follow_up_date: ['follow up date', 'followup date', 'follow-up date', 'followupdate', 'next follow up', 'next follow-up'],
  description: ['description', 'detail', 'details'],
}

const WORKFLOW_FIELD_ALIASES = {
  assigned_to: ['assigned', 'assigned to', 'owner', 'assignee'],
  status: ['status'],
  resolution_type: ['excluded reason', 'resolution type', 'reason'],
}

function findMatch(headers, used, aliases) {
  const normHeaders = headers.map((h) => String(h).trim().toLowerCase())
  // exact match first
  let idx = normHeaders.findIndex((h, i) => !used.has(headers[i]) && aliases.includes(h))
  // fall back to substring match
  if (idx === -1) {
    idx = normHeaders.findIndex((h, i) => !used.has(headers[i]) && aliases.some((a) => h.includes(a) || a.includes(h)))
  }
  return idx === -1 ? undefined : headers[idx]
}

export function suggestColumnMap(headers, aliasTable = CORE_FIELD_ALIASES) {
  const map = {}
  const used = new Set()
  for (const [key, aliases] of Object.entries(aliasTable)) {
    const match = findMatch(headers, used, aliases)
    if (match) { map[key] = match; used.add(match) }
  }
  return map
}

export function suggestWorkflowMap(headers) {
  return suggestColumnMap(headers, WORKFLOW_FIELD_ALIASES)
}
