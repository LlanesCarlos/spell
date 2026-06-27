import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useKeyboard } from '../hooks/useKeyboard'
import { WORLD } from './World'

const SPEED = 6
const W_RADIUS = 0.5
const S_RADIUS = 0.7  // slime collision radius
const T_RADIUS = 1.0  // tree trunk collision radius

export default function Wizard({ onMove, onHpChange, slimePosRef, treePositions, yawRef, cameraModeRef, pausedRef, healRef, wizardStatsRef }) {
  const { scene, animations } = useGLTF('/models/wizard.glb')
  const ref = useRef()
  const mixerRef = useRef()
  const actionsRef = useRef({})
  const currentAction = useRef(null)
  const keys = useKeyboard()
  const velocity = useRef(new THREE.Vector3())
  const hp = useRef(100)
  const damageCooldown = useRef(0)

  useEffect(() => {
    if (!healRef) return
    healRef.current = (amount) => {
      const maxHp = wizardStatsRef?.current?.maxHp ?? 100
      hp.current = Math.min(maxHp, hp.current + amount)
      onHpChange?.(hp.current)
    }
  }, [healRef, onHpChange, wizardStatsRef])

  // Fix common GLB import issues (TripoAI / AI-generated models)
  useEffect(() => {
    scene.traverse(obj => {
      obj.visible = true
      if (obj.isMesh) {
        obj.frustumCulled = false
        // Force double-sided rendering — AI-generated models often have inverted normals
        if (obj.material) {
          obj.material = Array.isArray(obj.material)
            ? obj.material.map(m => { const c = m.clone(); c.side = THREE.DoubleSide; c.needsUpdate = true; return c })
            : (() => { const c = obj.material.clone(); c.side = THREE.DoubleSide; c.needsUpdate = true; return c })()
        }
        // Compute bounding sphere manually for skinned meshes (Box3 returns NaN without this)
        if (obj.isSkinnedMesh) {
          obj.geometry.computeBoundingSphere()
        }
      }
    })
  }, [scene])

  useEffect(() => {
    if (!animations.length) return
    const mixer = new THREE.AnimationMixer(scene)
    mixerRef.current = mixer
    animations.forEach((clip) => {
      actionsRef.current[clip.name] = mixer.clipAction(clip)
    })
    const idle = actionsRef.current['Idle'] ?? actionsRef.current[animations[0].name]
    if (idle) { idle.play(); currentAction.current = idle }
  }, [animations, scene])

  const playAnim = (name) => {
    const next = actionsRef.current[name] ?? actionsRef.current[Object.keys(actionsRef.current)[0]]
    if (!next || next === currentAction.current) return
    currentAction.current?.fadeOut(0.2)
    next.reset().fadeIn(0.2).play()
    currentAction.current = next
  }

  useFrame((_, delta) => {
    if (!ref.current) return
    if (pausedRef?.current) return
    mixerRef.current?.update(delta)
    damageCooldown.current = Math.max(0, damageCooldown.current - delta)

    const y = yawRef.current
    const fwd   = new THREE.Vector3(-Math.sin(y), 0, -Math.cos(y))
    const right  = new THREE.Vector3( Math.cos(y), 0, -Math.sin(y))

    const dir = new THREE.Vector3()
    if (keys.current['KeyW'] || keys.current['ArrowUp'])    dir.add(fwd)
    if (keys.current['KeyS'] || keys.current['ArrowDown'])  dir.sub(fwd)
    if (keys.current['KeyD'] || keys.current['ArrowRight']) dir.add(right)
    if (keys.current['KeyA'] || keys.current['ArrowLeft'])  dir.sub(right)

    const speedMult = wizardStatsRef?.current?.speedMult ?? 1
    const moving = dir.lengthSq() > 0
    if (moving) {
      dir.normalize()
      velocity.current.lerp(dir.multiplyScalar(SPEED * speedMult), 0.2)
      ref.current.rotation.y = Math.atan2(velocity.current.x, velocity.current.z)
      playAnim('Walk')
    } else {
      velocity.current.lerp(new THREE.Vector3(), 0.15)
      if (velocity.current.lengthSq() < 0.01) playAnim('Idle')
    }

    let nx = THREE.MathUtils.clamp(
      ref.current.position.x + velocity.current.x * delta,
      -(WORLD - 1), WORLD - 1
    )
    let nz = THREE.MathUtils.clamp(
      ref.current.position.z + velocity.current.z * delta,
      -(WORLD - 1), WORLD - 1
    )

    // Tree solid collision
    for (const tp of treePositions) {
      const dx = nx - tp[0], dz = nz - tp[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      const min = W_RADIUS + T_RADIUS
      if (dist < min && dist > 0.001) {
        const overlap = min - dist
        nx += (dx / dist) * overlap
        nz += (dz / dist) * overlap
      }
    }

    // Slime solid collision + damage
    const spMap = slimePosRef.current
    for (const sp of Object.values(spMap)) {
      if (!sp) continue
      const dx = nx - sp[0], dz = nz - sp[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      const min = W_RADIUS + S_RADIUS
      if (dist < min && dist > 0.001) {
        const overlap = min - dist
        nx += (dx / dist) * overlap
        nz += (dz / dist) * overlap
        if (damageCooldown.current === 0) {
          const defense = wizardStatsRef?.current?.defense ?? 0
          const dmg = Math.max(1, Math.round(10 * (1 - defense)))
          hp.current = Math.max(0, hp.current - dmg)
          damageCooldown.current = 1
          onHpChange?.(hp.current)
        }
      }
    }

    ref.current.position.x = nx
    ref.current.position.z = nz

    // Hide model in first person
    ref.current.visible = cameraModeRef.current !== 'first'

    onMove?.([nx, ref.current.position.y, nz])
  })

  return (
    <primitive ref={ref} object={scene} position={[0, 0, 0]} castShadow />
  )
}

useGLTF.preload('/models/wizard.glb')
