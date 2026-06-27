import { useRef, useState, useCallback, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import World from './World'
import Wizard from './Wizard'
import Slime from './Slime'
import Tree from './Tree'
import Spell from './Spell'
import { gameState } from '../lib/gameState'
import { getElementalMultiplier, rollElement } from '../lib/elements'

export const TREE_POSITIONS = [
  [-8, 0, -8], [8, 0, -8], [-15, 0, 5], [15, 0, 5],
  [-5, 0, 15], [5, 0, -18], [-20, 0, -15], [20, 0, 15],
  [12, 0, -20], [-12, 0, 20], [25, 0, -5], [-25, 0, 10],
  [0, 0, 25], [0, 0, -25], [18, 0, 0], [-18, 0, 0],
]

const SLIME_COUNT = 6
const MAX_SLIMES = 10  // max non-boss slimes alive at once
const RESPAWN_DELAY = 5000 // ms
const BOSS_KILL_THRESHOLD = 20
const BOSS_ID = 9999

function makeSlime(id, startPos, difficultyLevel) {
  const hpBase = 50 + difficultyLevel * 25
  return {
    id,
    startPos,
    hp: hpBase,
    maxHp: hpBase,
    element: rollElement(0.1),
    isBoss: false,
    speedMult: 1 + difficultyLevel * 0.15,
  }
}

function makeBoss(difficultyLevel) {
  const hpBase = 500 + difficultyLevel * 250
  return {
    id: BOSS_ID,
    startPos: [0, 0, -10],
    hp: hpBase,
    maxHp: hpBase,
    element: rollElement(0.9), // bosses almost always have an element
    isBoss: true,
    speedMult: 1 + difficultyLevel * 0.1,
  }
}

const THIRD_DIST = 10
const THIRD_PITCH_INIT = 0.45

export default function Game({ onHpChange, onModeChange, onPause, paused, castRef, onKill, wizardDamageMultRef, wizardStatsRef, healWizardRef }) {
  const { gl } = useThree()

  const wizardPosRef = useRef([0, 0, 0])
  const slimePosRef = useRef({})
  const yaw = useRef(0)
  const pitch = useRef(THIRD_PITCH_INIT)
  const cameraMode = useRef('third')

  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])

  // Slime kill & respawn tracking
  const killCountRef = useRef(0)
  const nextSlimeIdRef = useRef(SLIME_COUNT)
  const pendingRespawnsRef = useRef([]) // { id, spawnAt, origPos }
  const bossSpawnedRef = useRef(false)
  const difficultyLevelRef = useRef(0)
  const activeNormalSlimesRef = useRef(SLIME_COUNT) // tracks non-boss count for cap

  const initialSlimes = () =>
    Array.from({ length: SLIME_COUNT }, (_, i) => {
      const angle = (i / SLIME_COUNT) * Math.PI * 2
      const r = 12 + (i % 3) * 5
      return makeSlime(i, [Math.cos(angle) * r, 0, Math.sin(angle) * r], 0)
    })

  const [slimes, setSlimes] = useState(initialSlimes)
  const [spells, setSpells] = useState([])
  const [burnMarks, setBurnMarks] = useState([])
  const [burnedTrees, setBurnedTrees] = useState(() => new Set())
  const wizardHealRef = useRef(null)

  // Expose heal to parent (for stat upgrades)
  useEffect(() => {
    if (healWizardRef) healWizardRef.current = (amount) => wizardHealRef.current?.(amount)
  }, [healWizardRef])

  // Keep a ref to the onKill callback so handleSpellHit (useCallback) sees fresh value
  const onKillRef = useRef(onKill)
  useEffect(() => { onKillRef.current = onKill }, [onKill])

  const handleCast = useCallback((def) => {
    const isSelf = def.targeting?.type === 'self'
    const y = yaw.current
    const dir = new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y))
    const wp = wizardPosRef.current
    const origin = isSelf
      ? new THREE.Vector3(wp[0], 1.5, wp[2])
      : new THREE.Vector3(wp[0] + dir.x * 0.9, 1.3, wp[2] + dir.z * 0.9)
    const spellId = performance.now() + Math.random()
    setSpells(prev => [...prev, { id: spellId, def, origin, direction: dir }])
  }, [])

  useEffect(() => {
    if (castRef) castRef.current = handleCast
  }, [castRef, handleCast])

  useEffect(() => {
    const canvas = gl.domElement

    const requestLock = () => {
      if (document.pointerLockElement !== canvas && !pausedRef.current && !gameState.spellInputOpen) {
        canvas.requestPointerLock().catch(() => {})
      }
    }

    const onMouseMove = (e) => {
      if (document.pointerLockElement !== canvas) return
      yaw.current -= e.movementX * 0.002
      pitch.current += e.movementY * 0.002
      if (cameraMode.current === 'third') {
        pitch.current = Math.max(0.1, Math.min(1.3, pitch.current))
      } else {
        pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current))
      }
    }

    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'KeyV') {
        cameraMode.current = cameraMode.current === 'third' ? 'first' : 'third'
        pitch.current = cameraMode.current === 'third' ? THIRD_PITCH_INIT : 0
        onModeChange?.(cameraMode.current)
      }
    }

    const onLockChange = () => {
      if (document.pointerLockElement !== canvas && !gameState.spellInputOpen) {
        onPause?.()
      }
    }

    canvas.addEventListener('click', requestLock)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerlockchange', onLockChange)

    return () => {
      canvas.removeEventListener('click', requestLock)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [gl, onModeChange, onPause])

  useFrame((state) => {
    if (pausedRef.current) return

    const [wx, wy, wz] = wizardPosRef.current
    const p = pitch.current
    const y = yaw.current

    if (cameraMode.current === 'third') {
      const cosP = Math.cos(p), sinP = Math.sin(p)
      state.camera.position.set(
        wx + Math.sin(y) * THIRD_DIST * cosP,
        wy + sinP * THIRD_DIST + 1,
        wz + Math.cos(y) * THIRD_DIST * cosP,
      )
      state.camera.lookAt(wx, wy + 1, wz)
    } else {
      const headY = wy + 1.6
      state.camera.position.set(wx, headY, wz)
      state.camera.lookAt(
        wx - Math.sin(y) * Math.cos(p),
        headY + Math.sin(p),
        wz - Math.cos(y) * Math.cos(p),
      )
    }

    // Check pending slime respawns (respects MAX_SLIMES cap)
    const now = performance.now()
    const ready = pendingRespawnsRef.current.filter(r => r.spawnAt <= now)
    if (ready.length > 0) {
      const slots = MAX_SLIMES - activeNormalSlimesRef.current
      const toSpawn = ready.slice(0, Math.max(0, slots))
      const deferred = ready.slice(Math.max(0, slots))
      // Put deferred back with a pushed-out timer so they don't spam next frame
      deferred.forEach(r => { r.spawnAt = now + 2000 })
      pendingRespawnsRef.current = [
        ...pendingRespawnsRef.current.filter(r => r.spawnAt > now),
        ...deferred,
      ]
      if (toSpawn.length > 0) {
        activeNormalSlimesRef.current += toSpawn.length
        setSlimes(prev => [
          ...prev,
          ...toSpawn.map(r => makeSlime(r.id, r.origPos, difficultyLevelRef.current)),
        ])
      }
    }
  })

  const handleWizardMove = useCallback((pos) => { wizardPosRef.current = pos }, [])
  const handleSlimePos = useCallback((id, pos) => { slimePosRef.current[id] = pos }, [])

  const handleSpellHit = useCallback((spellId, hitPos, { slimeIds, treeIndices, isSelf, healAmount, spellElement, baseDamage }) => {
    if (isSelf) {
      if (healAmount > 0) wizardHealRef.current?.(healAmount)
      return
    }
    setBurnMarks(prev => [...prev, { id: spellId, pos: hitPos }])

    if (slimeIds.length > 0) {
      setSlimes(prev => {
        const damageMult = wizardStatsRef?.current?.damageMult ?? wizardDamageMultRef?.current ?? 1

        let normalKillCount = 0

        const updated = prev.map(s => {
          if (!slimeIds.includes(s.id)) return s
          const elemMult = getElementalMultiplier(spellElement, s.element)
          const dmg = Math.round((baseDamage ?? 100) * elemMult * damageMult)
          return { ...s, hp: s.hp - dmg }
        })

        const dying = updated.filter(s => slimeIds.includes(s.id) && s.hp <= 0)

        dying.forEach(s => {
          delete slimePosRef.current[s.id]
          if (s.isBoss) {
            bossSpawnedRef.current = false
            difficultyLevelRef.current += 1
            onKillRef.current?.(100)
          } else {
            normalKillCount++
            activeNormalSlimesRef.current = Math.max(0, activeNormalSlimesRef.current - 1)
            pendingRespawnsRef.current.push({
              id: nextSlimeIdRef.current++,
              spawnAt: performance.now() + RESPAWN_DELAY,
              origPos: s.startPos,
            })
            onKillRef.current?.(10)
          }
        })

        killCountRef.current += normalKillCount

        let nextSlimes = updated.filter(s => s.hp > 0)

        // Spawn boss after threshold kills, once per wave
        if (!bossSpawnedRef.current && killCountRef.current >= BOSS_KILL_THRESHOLD) {
          bossSpawnedRef.current = true
          nextSlimes = [...nextSlimes, makeBoss(difficultyLevelRef.current)]
        }

        return nextSlimes
      })
    }

    if (treeIndices.length > 0) {
      setBurnedTrees(prev => new Set([...prev, ...treeIndices]))
    }
  }, [wizardDamageMultRef])

  const handleSpellExpire = useCallback((spellId) => {
    setSpells(prev => prev.filter(s => s.id !== spellId))
  }, [])

  return (
    <>
      <World />

      {TREE_POSITIONS.map((pos, i) => (
        <Tree key={i} position={pos} burned={burnedTrees.has(i)} />
      ))}

      {burnMarks.map(bm => (
        <mesh key={bm.id} position={[bm.pos.x, 0.015, bm.pos.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[2.2, 28]} />
          <meshStandardMaterial color="#110500" roughness={1} transparent opacity={0.92} />
        </mesh>
      ))}

      <Wizard
        onMove={handleWizardMove}
        onHpChange={onHpChange}
        slimePosRef={slimePosRef}
        treePositions={TREE_POSITIONS}
        yawRef={yaw}
        wizardStatsRef={wizardStatsRef}
        cameraModeRef={cameraMode}
        pausedRef={pausedRef}
        healRef={wizardHealRef}
      />

      {slimes.map(s => (
        <Slime
          key={s.id}
          id={s.id}
          startPos={s.startPos}
          wizardPosRef={wizardPosRef}
          onPositionUpdate={handleSlimePos}
          treePositions={TREE_POSITIONS}
          pausedRef={pausedRef}
          element={s.element}
          isBoss={s.isBoss}
          speedMult={s.speedMult}
        />
      ))}

      {spells.map(s => (
        <Spell
          key={s.id}
          id={s.id}
          def={s.def}
          origin={s.origin}
          direction={s.direction}
          slimePosRef={slimePosRef}
          wizardPosRef={wizardPosRef}
          treePositions={TREE_POSITIONS}
          onHit={handleSpellHit}
          onExpire={handleSpellExpire}
          pausedRef={pausedRef}
        />
      ))}
    </>
  )
}
