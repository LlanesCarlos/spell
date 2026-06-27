import { useState, useEffect, useRef } from 'react'
import { castSpell } from '../lib/spellDefs'
import { gameState } from '../lib/gameState'
import { ELEMENTS } from '../lib/elements'

const COOLDOWN_MS = 10000 // 10 seconds

export default function SpellInput({ onCast }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [knownSpells, setKnownSpells] = useState([]) // { def, lastUsedAt }
  const [, forceUpdate] = useState(0)
  const inputRef = useRef()
  const tickRef = useRef()

  // Tick every 250ms to refresh cooldown display
  useEffect(() => {
    tickRef.current = setInterval(() => forceUpdate(n => n + 1), 250)
    return () => clearInterval(tickRef.current)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'KeyQ' && !open && !busy) {
        e.preventDefault()
        gameState.spellInputOpen = true
        document.exitPointerLock()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const fire = (def) => {
    onCast(def)
    setKnownSpells(prev => {
      const existing = prev.findIndex(s => s.def.name === def.name)
      const entry = { def, lastUsedAt: Date.now() }
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = entry
        return next
      }
      return [...prev, entry]
    })
  }

  const submit = async (e) => {
    e?.preventDefault()
    const spell = text.trim()
    if (!spell) return
    setBusy(true)
    try {
      const def = await castSpell(spell)
      fire(def)
    } finally {
      gameState.spellInputOpen = false
      setBusy(false)
      setOpen(false)
      setText('')
    }
  }

  const castKnown = (entry) => {
    const elapsed = Date.now() - entry.lastUsedAt
    if (elapsed < COOLDOWN_MS) return
    fire(entry.def)
    // Close menu after using a known spell
    gameState.spellInputOpen = false
    setOpen(false)
  }

  const close = () => {
    gameState.spellInputOpen = false
    setOpen(false)
    setText('')
  }

  const onKeyDown = (e) => {
    if (e.code === 'Escape') close()
    e.stopPropagation()
  }

  const now = Date.now()

  // Show the panel if open, or if we have known spells (buttons stay visible as HUD)
  const showPanel = open || busy || knownSpells.length > 0

  if (!showPanel) return null

  return (
    <div style={{
      position: 'absolute', bottom: 64,
      left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      pointerEvents: 'all',
    }}>
      {/* Known spell buttons */}
      {knownSpells.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
          maxWidth: 520,
        }}>
          {knownSpells.map((entry) => {
            const elapsed = now - entry.lastUsedAt
            const remaining = Math.max(0, COOLDOWN_MS - elapsed)
            const ready = remaining === 0
            const pct = ready ? 100 : (elapsed / COOLDOWN_MS) * 100
            const elColor = ELEMENTS[entry.def.element ?? 'none']?.color ?? '#999'

            return (
              <button
                key={entry.def.name}
                onClick={() => castKnown(entry)}
                title={ready ? `Cast ${entry.def.name}` : `${(remaining / 1000).toFixed(1)}s`}
                style={{
                  position: 'relative', overflow: 'hidden',
                  background: ready ? 'rgba(20,10,0,0.88)' : 'rgba(10,5,0,0.88)',
                  border: `1px solid ${ready ? elColor : 'rgba(80,40,0,0.4)'}`,
                  borderRadius: 7, padding: '6px 12px',
                  color: ready ? '#fff' : '#555',
                  cursor: ready ? 'pointer' : 'default',
                  fontFamily: 'monospace', fontSize: 12,
                  minWidth: 90, textAlign: 'center',
                  boxShadow: ready ? `0 0 8px ${elColor}44` : 'none',
                  transition: 'color 0.2s, border-color 0.2s',
                }}
              >
                {/* Cooldown fill overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `${elColor}22`,
                  width: `${pct}%`,
                  transition: 'width 0.25s linear',
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative', fontWeight: 'bold', color: elColor }}>{entry.def.name}</div>
                <div style={{ position: 'relative', fontSize: 10, color: '#666', marginTop: 2 }}>
                  {entry.def.element ?? 'none'}
                </div>
                {!ready && (
                  <div style={{ position: 'relative', fontSize: 11, color: '#888', marginTop: 2 }}>
                    {(remaining / 1000).toFixed(1)}s
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Input panel */}
      {(open || busy) && (
        <div style={{
          background: 'rgba(5,2,0,0.88)',
          border: '1px solid rgba(255,140,30,0.45)',
          borderRadius: 10, padding: '14px 18px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          color: '#fff', fontFamily: 'monospace', minWidth: 300,
          boxShadow: '0 0 24px rgba(255,100,0,0.25)',
        }}>
          <div style={{ fontSize: 11, color: '#ff9900', letterSpacing: 3, textTransform: 'uppercase' }}>
            ✦ Incantation ✦
          </div>

          {busy ? (
            <div style={{ color: '#ff8800', fontSize: 14, padding: '4px 0' }}>Channeling…</div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', gap: 8, width: '100%' }}>
              <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="describe your spell…"
                style={{
                  flex: 1, background: 'rgba(255,90,0,0.08)',
                  border: '1px solid rgba(255,120,30,0.35)', borderRadius: 5,
                  padding: '7px 11px', color: '#fff', fontFamily: 'monospace', fontSize: 14, outline: 'none',
                }}
                autoComplete="off" spellCheck="false"
              />
              <button type="submit" style={{
                background: 'rgba(255,90,0,0.22)',
                border: '1px solid rgba(255,150,50,0.55)',
                borderRadius: 5, padding: '7px 14px',
                color: '#ffc040', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13,
              }}>
                Cast
              </button>
            </form>
          )}

          <div style={{ fontSize: 10, color: '#555' }}>Enter to cast · Esc to cancel</div>
        </div>
      )}
    </div>
  )
}
