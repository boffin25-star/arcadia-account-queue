// Everything lives in the browser. This is the localStorage key that holds
// the whole queue (team + items + notes + admin-configured lists). Excel
// import/export is the only way data moves between people or devices —
// see src/lib/store.js.
export const STORAGE_KEY = 'arcadia_edi_queue_state_v1'

export const CURRENT_USER_KEY = 'arcadia_edi_queue_current_user'

// Arcadia brand palette.
export const BRAND = {
  eveningSea: '#104336',
  arcadiaGreen: '#0FFF87',
  pampas: '#F3F1EC',
  electricViolet: '#8F00FF',
  blueMarguerite: '#6A5BB1',
  viking: '#64CCDB',
  aurora: '#B2F3AC',
}

// Seeded once, on first load. After that, an admin manages these lists
// from the Admin tab (see AdminPanel.jsx) and they live in state, not here.
export const DEFAULT_TEAM_MEMBERS = [
  { name: 'Brandon', isAdmin: true },
  { name: 'Laura', isAdmin: false },
  { name: 'Rich', isAdmin: false },
  { name: 'Anna', isAdmin: false },
  { name: 'Marie', isAdmin: false },
]

// Matches the tracker's Status column exactly. isTerminal marks a status as
// "done" (out of the active queue) for stats; requiresReason marks it as
// needing an Excluded Reason + note before it can be applied; requiresChecklist
// marks it as needing the completion checklist answered first — see
// ItemDetail.jsx. All three flags on a status are independent.
export const DEFAULT_STATUSES = [
  { name: 'Not Started', color: BRAND.viking, isTerminal: false, requiresReason: false, requiresChecklist: false },
  { name: 'In-Progress: Contacted Vendor', color: BRAND.blueMarguerite, isTerminal: false, requiresReason: false, requiresChecklist: false },
  { name: 'In-Progress: Contacted CR', color: BRAND.blueMarguerite, isTerminal: false, requiresReason: false, requiresChecklist: false },
  { name: 'In-Progress: Waiting for Response', color: BRAND.blueMarguerite, isTerminal: false, requiresReason: false, requiresChecklist: false },
  { name: 'In-Progress', color: BRAND.blueMarguerite, isTerminal: false, requiresReason: false, requiresChecklist: false },
  { name: 'On-Hold', color: BRAND.electricViolet, isTerminal: false, requiresReason: false, requiresChecklist: false },
  { name: 'Successfully Registered', color: BRAND.arcadiaGreen, isTerminal: true, requiresReason: false, requiresChecklist: true },
  { name: 'Unable to Register: Excluded', color: '#D64545', isTerminal: true, requiresReason: true, requiresChecklist: false },
]

// Completion checklist — answered when moving an item into a status flagged
// requiresChecklist (Successfully Registered, by default).
export const DEFAULT_CHECKLIST_ITEMS = [
  'Did they update the BRM in AVI?',
  'Did they add an Excluded or Registered note in AVI?',
  'Did they add the login credentials to the Dashboard?',
  'Did they turn off Paper on the website?',
]

// Matches the tracker's Excluded Reason column exactly.
export const DEFAULT_RESOLUTION_TYPES = [
  'Incorrect Tax Id',
  'Already Registered',
  'Account ineligible',
  'Other info incorrect',
]

// Preset swatches an admin can assign to a status — Arcadia brand colors
// first, plus a couple of neutral/warning tones the brand palette doesn't cover.
export const STATUS_COLOR_PRESETS = [
  BRAND.eveningSea,
  BRAND.arcadiaGreen,
  BRAND.electricViolet,
  BRAND.blueMarguerite,
  BRAND.viking,
  BRAND.aurora,
  '#D64545',
  '#64748B',
]

// Core fields every account row can map to on upload. This set is fixed —
// it's what the import wizard offers as mapping targets. Which of these
// (plus any custom/extra columns) actually show in the queue list is a
// separate, admin-configurable concern — see visibleColumns in state.
export const CORE_FIELDS = [
  { key: 'account_id', label: 'Account Number' },
  { key: 'account_name', label: 'Customer' },
  { key: 'client', label: 'Client' },
  { key: 'vendor', label: 'Utility Name' },
  { key: 'amount', label: 'Avg Current Charges' },
  { key: 'follow_up_date', label: 'Follow Up Date' },
  { key: 'description', label: 'Description' },
]

export const DEFAULT_VISIBLE_COLUMNS = ['vendor', 'amount', 'assigned_to', 'follow_up_date']
