export default function PauseMenu({ onResume }) {
  const resume = () => {
    onResume()
    document.querySelector('canvas')?.requestPointerLock()
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: '#fff',
      pointerEvents: 'all',
    }}>
      <div style={{ fontSize: 32, letterSpacing: 6, marginBottom: 8, color: '#e0c060' }}>PAUSED</div>
      <div style={{ width: 120, height: 1, background: 'rgba(255,200,80,0.3)', marginBottom: 32 }} />

      <button onClick={resume} style={btnStyle('#ff9900')}>Resume</button>

      <div style={{ marginTop: 40, fontSize: 11, color: '#444', letterSpacing: 1 }}>
        ESC · PAUSE / RESUME
      </div>
    </div>
  )
}

const btnStyle = (accent) => ({
  background: 'rgba(0,0,0,0.5)',
  border: `1px solid ${accent}55`,
  borderRadius: 6,
  padding: '10px 36px',
  color: accent,
  fontFamily: 'monospace',
  fontSize: 15,
  cursor: 'pointer',
  letterSpacing: 2,
  marginBottom: 10,
  transition: 'background 0.15s',
})
