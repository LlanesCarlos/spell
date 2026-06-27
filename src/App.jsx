import { Canvas } from '@react-three/fiber'
import { Suspense, useState, useRef, useCallback } from 'react'
import Game from './components/Game'
import HUD from './components/HUD'
import SpellInput from './components/SpellInput'
import PauseMenu from './components/PauseMenu'
import LevelUpOverlay from './components/LevelUpOverlay'
import GameOver from './components/GameOver'

function xpToNextLevel(level) {
  return level * 50
}

function freshState() {
  return {
    hp: 100, mode: 'third', paused: false,
    level: 1, xp: 0, levelUpPending: false, killCount: 0, gameOver: false,
  }
}

export default function App() {
  const [gameKey, setGameKey] = useState(0) // increment to reset all 3D state
  const [state, setState] = useState(freshState)

  // Stable setters
  const setHp   = useCallback((v) => setState(s => {
    const hp = typeof v === 'function' ? v(s.hp) : v
    return { ...s, hp, gameOver: hp <= 0 }
  }), [])
  const setMode  = useCallback((v) => setState(s => ({ ...s, mode: v })), [])
  const setPaused = useCallback((v) => setState(s => ({ ...s, paused: v })), [])

  const castRef      = useRef(null)
  const xpRef        = useRef(0)
  const levelRef     = useRef(1)
  const healWizardRef    = useRef(null)
  const wizardDamageMultRef = useRef(1)
  const wizardStats  = useRef({ damageMult: 1, speedMult: 1, maxHp: 100, defense: 0 })

  const handleKill = useCallback((xpGain) => {
    setState(s => {
      const newKills = s.killCount + 1
      xpRef.current += xpGain
      const needed = xpToNextLevel(levelRef.current)
      if (xpRef.current >= needed) {
        xpRef.current -= needed
        levelRef.current += 1
        return { ...s, killCount: newKills, level: levelRef.current, xp: xpRef.current, levelUpPending: true }
      }
      return { ...s, killCount: newKills, xp: xpRef.current }
    })
  }, [])

  const handleStatChoice = useCallback((statKey) => {
    const s = wizardStats.current
    switch (statKey) {
      case 'maxHp':
        s.maxHp += 25
        healWizardRef.current?.(25)
        break
      case 'speed':
        s.speedMult += 0.2
        break
      case 'damage':
        s.damageMult = (s.damageMult ?? 1) + 0.25
        wizardDamageMultRef.current = s.damageMult
        break
      case 'defense':
        s.defense += 0.2
        break
    }
    setState(s => ({ ...s, levelUpPending: false }))
  }, [])

  const handleRestart = useCallback(() => {
    // Reset all refs
    xpRef.current = 0
    levelRef.current = 1
    wizardDamageMultRef.current = 1
    wizardStats.current = { damageMult: 1, speedMult: 1, maxHp: 100, defense: 0 }
    healWizardRef.current = null
    setState(freshState())
    setGameKey(k => k + 1) // remounts Game + 3D scene entirely
  }, [])

  const { hp, mode, paused, level, xp, levelUpPending, killCount, gameOver } = state

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000' }}>
      <Canvas
        shadows
        camera={{ position: [0, 8, 12], fov: 60, near: 0.1, far: 500 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          <Game
            key={gameKey}
            onHpChange={setHp}
            onModeChange={setMode}
            onPause={() => setPaused(true)}
            paused={paused || gameOver}
            castRef={castRef}
            onKill={handleKill}
            wizardDamageMultRef={wizardDamageMultRef}
            wizardStatsRef={wizardStats}
            healWizardRef={healWizardRef}
          />
        </Suspense>
      </Canvas>

      {!paused && !gameOver && (
        <HUD hp={hp} mode={mode} level={level} xp={xp} xpToNext={xpToNextLevel(level)} killCount={killCount} />
      )}
      {!paused && !gameOver && <SpellInput key={gameKey} onCast={(def) => castRef.current?.(def)} />}
      {paused && !gameOver && <PauseMenu onResume={() => setPaused(false)} />}
      {levelUpPending && !paused && !gameOver && (
        <LevelUpOverlay level={level} onChoose={handleStatChoice} />
      )}
      {gameOver && <GameOver onRestart={handleRestart} />}
    </div>
  )
}
