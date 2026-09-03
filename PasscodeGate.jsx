import React, { useState } from 'react'
import { PASSCODE_KEY, api } from '../lib/api.js'

export default function PasscodeGate({ onUnlocked, message = '' }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(message)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    sessionStorage.setItem(PASSCODE_KEY, code.trim())
    try { await api.version('00000000-0000-0000-0000-000000000000'); onUnlocked() }
    catch (err) { sessionStorage.removeItem(PASSCODE_KEY); setError(err.status === 401 ? 'That passcode was not accepted.' : err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="name-picker-screen">
      <form className="name-picker-card" onSubmit={submit}>
        <h1>Arcadia Account Queue</h1>
        <p className="muted" style={{ marginTop: 0 }}>Enter the team passcode to open the shared queue.</p>
        <input type="password" autoFocus placeholder="Team passcode" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" />
        <button type="submit" className="btn block" style={{ marginTop: 12 }} disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Continue'}</button>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{error}</div>}
        <p className="faint" style={{ marginTop: 14 }}>Kept only for this browser session.</p>
      </form>
    </div>
  )
}
