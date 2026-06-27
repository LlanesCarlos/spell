import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import * as THREE from 'three'
import { ELEMENTS } from '../lib/elements'

const BASE_SPEED = 2.2
const WANDER_TIME = 2.5
const AGGRO_RANGE = 12
const NORMAL_SCALE = 2
const BOSS_SCALE = 4.5

export default function Slime({ id, startPos, wizardPosRef, onPositionUpdate, treePositions, pausedRef, element = 'none', isBoss = false, speedMult = 1 }) {
  const { scene: src, animations } = useGLTF('/models/slime.glb')

  const cloned = useMemo(() => skeletonClone(src), [src])
  const ref = useRef()
  const mixerRef = useRef()
  const wanderDir = useRef(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize())
  const wanderTimer = useRef(Math.random() * WANDER_TIME)
  const lightRef = useRef()

  // Apply element color tint + boss emissive glow to all mesh materials
  useEffect(() => {
    const elData = ELEMENTS[element] ?? ELEMENTS.none
    cloned.traverse(obj => {
      if (!obj.isMesh) return
      const applyTint = (mat) => {
        const m = mat.clone()
        if (element !== 'none') {
          m.color = new THREE.Color(elData.color)
          m.emissive = new THREE.Color(elData.emissive)
          m.emissiveIntensity = isBoss ? 0.6 : 0.3
        }
        if (isBoss && element === 'none') {
          m.emissive = new THREE.Color('#550000')
          m.emissiveIntensity = 0.4
        }
        m.needsUpdate = true
        return m
      }
      obj.material = Array.isArray(obj.material)
        ? obj.material.map(applyTint)
        : applyTint(obj.material)
    })
  }, [cloned, element, isBoss])

  useEffect(() => {
    if (!animations.length) return
    const mixer = new THREE.AnimationMixer(cloned)
    mixerRef.current = mixer
    const clip = animations.find(a => /walk|move/i.test(a.name)) ?? animations[0]
    mixer.clipAction(clip, cloned).play()
  }, [animations, cloned])

  const SPEED = BASE_SPEED * speedMult * (isBoss ? 0.75 : 1)

  useFrame((_, delta) => {
    if (!ref.current) return
    if (pausedRef?.current) return
    mixerRef.current?.update(delta)

    const pos = ref.current.position
    const wp = wizardPosRef.current
    const toWizard = new THREE.Vector3(wp[0] - pos.x, 0, wp[2] - pos.z)
    let dir = new THREE.Vector3()

    const aggroRange = isBoss ? AGGRO_RANGE * 2 : AGGRO_RANGE
    if (toWizard.length() < aggroRange) {
      dir.copy(toWizard).normalize()
    } else {
      wanderTimer.current -= delta
      if (wanderTimer.current <= 0) {
        wanderDir.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
        wanderTimer.current = WANDER_TIME + Math.random() * WANDER_TIME
      }
      dir.copy(wanderDir.current)
    }

    let nx = THREE.MathUtils.clamp(pos.x + dir.x * SPEED * delta, -39, 39)
    let nz = THREE.MathUtils.clamp(pos.z + dir.z * SPEED * delta, -39, 39)

    for (const tp of treePositions) {
      const dx = nx - tp[0], dz = nz - tp[2]
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < 1.5 && dist > 0.001) {
        nx += (dx / dist) * (1.5 - dist)
        nz += (dz / dist) * (1.5 - dist)
        wanderDir.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize()
      }
    }

    pos.x = nx
    pos.z = nz

    if (dir.lengthSq() > 0.001) {
      ref.current.rotation.y = Math.atan2(dir.x, dir.z)
    }

    if (lightRef.current) {
      lightRef.current.position.set(pos.x, pos.y + 1.5, pos.z)
    }

    onPositionUpdate?.(id, [pos.x, pos.y, pos.z])
  })

  const scale = isBoss ? BOSS_SCALE : NORMAL_SCALE

  return (
    <>
      <primitive
        ref={ref}
        object={cloned}
        position={startPos}
        scale={scale}
        castShadow
      />
      {(element !== 'none' || isBoss) && (
        <pointLight
          ref={lightRef}
          color={element !== 'none' ? (ELEMENTS[element]?.lightColor ?? '#ffffff') : '#ff3300'}
          intensity={isBoss ? 3 : 1}
          distance={isBoss ? 8 : 4}
        />
      )}
    </>
  )
}

useGLTF.preload('/models/slime.glb')
