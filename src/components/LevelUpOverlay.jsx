const STATS = [
  { key: 'maxHp',    label: 'Max HP',       desc: '+25 maximum health',       icon: '❤️' },
  { key: 'speed',    label: 'Speed',        desc: '+20% movement speed',       icon: '💨' },
  { key: 'damage',   label: 'Spell Power',  desc: '+25% spell damage',         icon: '✨' },
  { key: 'defense',  label: 'Defense',      desc: 'Take 20% less damage',      icon: '🛡️' },
]

export default function LevelUpOverlay({ level, onChoose }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: '#fff',
      pointerEvents: 'all', zIndex: 20,
    }}>
      <div style={{ fontSize: 13, letterSpacing: 4, color: '#ffdd55', textTransform: 'uppercase', marginBottom: 6 }}>
        Level Up!
      </div>
      <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 6 }}>
        Level {level}
      </div>
      <div style={{ fontSize: 13, color: '#aaa', marginBottom: 28 }}>
        Choose a stat to increase
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        {STATS.map(s => (
          <button
            key={s.key}
            onClick={() => onChoose(s.key)}
            style={{
              background: 'rgba(255,200,0,0.1)',
              border: '1px solid rgba(255,200,0,0.5)',
              borderRadius: 10,
              padding: '20px 22px',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: 'monospace',
              minWidth: 130,
              textAlign: 'center',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,200,0,0.25)'
              e.currentTarget.style.borderColor = 'rgba(255,220,0,0.9)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,200,0,0.1)'
              e.currentTarget.style.borderColor = 'rgba(255,200,0,0.5)'
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: '#ccaa44', lineHeight: 1.4 }}>{s.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
