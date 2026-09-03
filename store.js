import {
  STORAGE_KEY,
  DEFAULT_TEAM_MEMBERS,
  DEFAULT_STATUSES,
  DEFAULT_RESOLUTION_TYPES,
  DEFAULT_VISIBLE_COLUMNS,
  DEFAULT_CHECKLIST_ITEMS,
} from '../constants.js'

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function defaultState() {
  return {
    teamMembers: DEFAULT_TEAM_MEMBERS.map((m) => ({ id: uid(), name: m.name, active: true, isAdmin: m.isAdmin })),
    items: [],
    statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
    resolutionTypes: [...DEFAULT_RESOLUTION_TYPES],
    checklistItems: [...DEFAULT_CHECKLIST_ITEMS],
    visibleColumns: [...DEFAULT_VISIBLE_COLUMNS],
  }
}

// Fills in anything missing from a state object saved by an older version
// of the app, so existing local data never breaks when the schema grows.
function migrate(state) {
  const s = { ...state }
  if (!Array.isArray(s.teamMembers)) s.teamMembers = defaultState().teamMembers
  s.teamMembers = s.teamMembers.map((m) => ({ isAdmin: false, ...m }))
  // Guarantee at least one admin exists, or nobody could ever reach the Admin tab.
  if (!s.teamMembers.some((m) => m.isAdmin) && s.teamMembers.length) {
    s.teamMembers = s.teamMembers.map((m, i) => (i === 0 ? { ...m, isAdmin: true } : m))
  }
  if (!Array.isArray(s.items)) s.items = []
  if (!Array.isArray(s.statuses) || !s.statuses.length) {
    s.statuses = DEFAULT_STATUSES.map((x) => ({ ...x }))
  } else {
    s.statuses = s.statuses.map((st) => ({
      ...st,
      requiresReason: st.requiresReason !== undefined ? st.requiresReason : !!st.isResolved,
      isTerminal: st.isTerminal !== undefined ? st.isTerminal : !!st.isResolved,
      requiresChecklist: st.requiresChecklist !== undefined ? st.requiresChecklist : false,
    }))
  }
  if (!Array.isArray(s.resolutionTypes) || !s.resolutionTypes.length) s.resolutionTypes = [...DEFAULT_RESOLUTION_TYPES]
  if (!Array.isArray(s.checklistItems)) s.checklistItems = [...DEFAULT_CHECKLIST_ITEMS]
  if (!Array.isArray(s.visibleColumns)) s.visibleColumns = [...DEFAULT_VISIBLE_COLUMNS]
  return s
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return migrate(JSON.parse(raw))
  } catch {
    return defaultState()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function newId() {
  return uid()
}
