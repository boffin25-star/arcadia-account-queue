import React, { useState } from 'react'

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function NamePicker({ teamMembers, onPick, onAddMember }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) return
    await onAddMember(trimmed)
    setNewName('')
    setAdding(false)
    onPick(trimmed)
  }

  return (
    <div className="name-picker-screen">
      <div className="name-picker-card">
        <h1>Arcadia Account Queue</h1>
        <p className="muted" style={{ marginTop: 0 }}>Who's working the queue?</p>

        <div className="name-grid">
          {teamMembers.map((m) => (
            <button key={m.id} onClick={() => onPick(m.name)}>
              <span className="avatar">{initials(m.name)}</span>
              {m.name}
            </button>
          ))}
        </div>

        {adding ? (
          <form onSubmit={handleAdd} style={{ marginTop: 14 }}>
            <input
              type="text"
              autoFocus
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="submit" className="btn sm">Add</button>
              <button type="button" className="btn secondary sm" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setAdding(true)}>
            + Add my name
          </button>
        )}
      </div>
    </div>
  )
}
