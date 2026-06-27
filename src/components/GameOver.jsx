export default function GameOver({ onRestart }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: '#fff',
      pointerEvents: 'all', zIndex: 30,
    }}>
      <div style={{
        fontSize: 11, letterSpacing: 6, color: '#cc2222',
        textTransform: 'uppercase', marginBottom: 10,
      }}>
        You have fallen
      </div>

      <div style={{
        fontSize: 56, fontWeight: 'bold',
        color: '#ff2222',
        textShadow: '0 0 30px #ff000088, 0 0 60px #ff000044',
        marginBottom: 40,
        letterSpacing: 2,
      }}>
        GAME OVER
      </div>

      <button
        onClick={onRestart}
        style={{
          background: 'rgba(180,30,30,0.2)',
          border: '1px solid rgba(220,60,60,0.6)',
          borderRadius: 8,
          padding: '12px 36px',
          color: '#ff9999',
          fontSize: 16,
          fontFamily: 'monospace',
          cursor: 'pointer',
          letterSpacing: 2,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(220,50,50,0.35)'
          e.currentTarget.style.borderColor = 'rgba(255,100,100,0.9)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(180,30,30,0.2)'
          e.currentTarget.style.borderColor = 'rgba(220,60,60,0.6)'
        }}
      >
        Try Again
      </button>
    </div>
  )
}
