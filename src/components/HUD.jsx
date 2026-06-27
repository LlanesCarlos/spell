export default function HUD({ hp, mode, level, xp, xpToNext, killCount }) {
  const barColor = hp > 50 ? '#4ade80' : hp > 25 ? '#facc15' : '#f87171'
  const xpPct = xpToNext > 0 ? Math.min(100, (xp / xpToNext) * 100) : 100

  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      fontFamily: 'monospace', userSelect: 'none'
    }}>
      {/* HP + XP panel */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '8px 12px', color: '#fff',
        minWidth: 180,
      }}>
        <div style={{ fontSize: 12, marginBottom: 4, color: '#aaa' }}>HP</div>
        <div style={{ width: 160, height: 12, background: '#222', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${hp}%`, height: '100%', background: barColor,
            transition: 'width 0.15s, background 0.3s', borderRadius: 6
          }} />
        </div>
        <div style={{ fontSize: 11, marginTop: 4, marginBottom: 10, color: '#888' }}>{hp} / 100</div>

        {/* XP bar */}
        <div style={{ fontSize: 12, marginBottom: 4, color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
          <span>LVL {level}</span>
          <span style={{ color: '#ffdd55' }}>{xp} / {xpToNext} XP</span>
        </div>
        <div style={{ width: 160, height: 7, background: '#222', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${xpPct}%`, height: '100%',
            background: 'linear-gradient(90deg, #ffaa00, #ffee44)',
            transition: 'width 0.3s', borderRadius: 6
          }} />
        </div>

        {/* Kill counter */}
        <div style={{ fontSize: 11, marginTop: 8, color: '#888' }}>
          Kills: <span style={{ color: '#ff9944' }}>{killCount}</span>
          {killCount < 20 && (
            <span style={{ color: '#666' }}> / 20 for boss</span>
          )}
        </div>
      </div>

      {/* Mode badge */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(0,0,0,0.6)', borderRadius: 6, padding: '4px 10px',
        color: '#fff', fontSize: 13
      }}>
        {mode === 'first' ? '1st Person' : '3rd Person'}
      </div>

      {/* Controls hint */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '5px 12px',
        color: '#aaa', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'center'
      }}>
        Click to capture mouse · WASD move · mouse look · V — toggle view · Q — cast spell
      </div>
    </div>
  )
}
