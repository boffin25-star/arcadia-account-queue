import { CORE_FIELDS } from '../constants.js'

const CORE_KEYS = new Set(CORE_FIELDS.map((f) => f.key))
// assigned_to is stored directly on the item, same as core fields, but isn't
// part of CORE_FIELDS since it's not an upload-mapping target — it's set by
// the app (claim/assign) or by the workflow-field mapping on import.
const DIRECT_KEYS = new Set([...CORE_KEYS, 'assigned_to'])

export function isCoreField(key) {
  return CORE_KEYS.has(key)
}

export function getFieldValue(item, key) {
  if (DIRECT_KEYS.has(key)) return item[key]
  return item.extra_fields ? item.extra_fields[key] : undefined
}

export function getFieldLabel(key) {
  if (key === 'assigned_to') return 'Assigned To'
  const core = CORE_FIELDS.find((f) => f.key === key)
  return core ? core.label : key
}

// Every column an admin could choose to show: the fixed core fields
// (minus the always-shown identity fields), assigned_to, plus whatever
// custom columns have actually shown up in uploaded data so far.
export function computeAvailableColumns(items) {
  const seen = new Set()
  const extra = []
  for (const it of items) {
    for (const k of Object.keys(it.extra_fields || {})) {
      if (!seen.has(k)) { seen.add(k); extra.push(k) }
    }
  }
  return [
    ...CORE_FIELDS.filter((f) => f.key !== 'account_id' && f.key !== 'account_name' && f.key !== 'description'),
    { key: 'assigned_to', label: 'Assigned To' },
    ...extra.map((k) => ({ key: k, label: k })),
  ]
}
