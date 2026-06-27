import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const TRAIL_MAX = 20
const FP_POOL = 200 // max simultaneous flight particles

// ─── Geometry selector ────────────────────────────────────────────────────────
function LayerGeometry({ type, size }) {
  switch (type) {
    case 'torus':    return <torusGeometry args={[size, size * 0.3, 8, 24]} />
    case 'box':      return <boxGeometry args={[size * 1.8, size * 1.8, size * 1.8]} />
    case 'cone':     return <coneGeometry args={[size * 0.55, size * 2.4, 8]} />
    case 'cylinder': return <cylinderGeometry args={[size * 0.4, size * 0.4, size * 2.6, 8]} />
    case 'tetra':    return <tetrahedronGeometry args={[size * 1.2]} />
    case 'sphere':
    default:         return <sphereGeometry args={[size, 10, 10]} />
  }
}

// ─── Backward-compat: accept old def.shape or new def.layers ─────────────────
function normalizeLayers(def) {
  if (def.layers) return def.layers
  if (def.shape) {
    return [{
      type: def.shape.type ?? 'sphere',
      size: def.shape.size ?? def.projectile.radius,
      scaleX: def.shape.scaleX ?? 1, scaleY: def.shape.scaleY ?? 1, scaleZ: def.shape.scaleZ ?? 1,
      color: def.projectile.color,
      opacity: 1,
      emissiveIntensity: def.projectile.emissiveIntensity ?? 5,
      rotX: 0, rotY: 0, rotZ: 0,
    }]
  }
  return [{
    type: 'sphere', size: def.projectile.radius,
    scaleX: 1, scaleY: 1, scaleZ: 1,
    color: def.projectile.color,
    opacity: 1, emissiveIntensity: def.projectile.emissiveIntensity ?? 5,
    rotX: 0, rotY: 0, rotZ: 0,
  }]
}

// Random direction within a spread cone around a given axis
function randomInCone(axis, spreadDeg) {
  if (spreadDeg >= 360) {
    return new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ).normalize()
  }
  const half = Math.min(spreadDeg, 180) * 0.5 * (Math.PI / 180)
  const cosHalf = Math.cos(half)
  const cosT = cosHalf + Math.random() * (1 - cosHalf)
  const sinT = Math.sqrt(1 - cosT * cosT)
  const phi = Math.random() * Math.PI * 2
  const local = new THREE.Vector3(sinT * Math.cos(phi), sinT * Math.sin(phi), cosT)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize())
  return local.applyQuaternion(q)
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Spell({ id, def, origin, direction, slimePosRef, treePositions, onHit, onExpire, pausedRef }) {
  const layers = useMemo(() => normalizeLayers(def), [def])
  const fp = def.flightParticles
  const hasFP = !!fp?.enabled && (fp.countPerSec ?? 0) > 0

  const phase = useRef('flying')
  const pos   = useRef(origin.clone())
  const dir   = useRef(direction.clone())
  const distTraveled = useRef(0)

  // Layer group (positioned each frame)
  const groupRef = useRef()
  // Per-layer mesh refs for rotation animation
  const layerRefs = useRef([])

  // Trail
  const trailGeoRef = useRef()
  const trailPts = useRef([origin.clone()])

  // Homing
  const targetId   = useRef(null)
  const targetType = useRef(null)

  // Impact
  const [showImpact, setShowImpact] = useState(false)
  const impactVec   = useRef(new THREE.Vector3())
  const pGeoRef     = useRef()
  const flashRef    = useRef()
  const N = def.impact.particles.count
  const pPos  = useRef(new Float32Array(N * 3))
  const pVel  = useRef([])
  const pLife = useRef(new Float32Array(N))
  const pDur  = useRef(new Float32Array(N))
  const flashElapsed = useRef(0)

  const hitSlimes = useRef(new Set())
  const hitTrees  = useRef(new Set())

  // ── Flight particle pool ─────────────────────────────────────────────────────
  const fpGeoRef    = useRef()
  const fpPos       = useRef(new Float32Array(FP_POOL * 3).fill(-9999))
  const fpVel       = useRef(Array.from({ length: FP_POOL }, () => new THREE.Vector3()))
  const fpLife      = useRef(new Float32Array(FP_POOL))
  const fpMaxLife   = useRef(new Float32Array(FP_POOL).fill(1))
  const fpSlot      = useRef(0) // ring buffer head
  const fpTimer     = useRef(0) // emit time accumulator

  // ── Init trail geometry ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!trailGeoRef.current) return
    const buf  = new Float32Array(TRAIL_MAX * 3)
    const attr = new THREE.BufferAttribute(buf, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    trailGeoRef.current.setAttribute('position', attr)
    trailGeoRef.current.setDrawRange(0, 0)
  }, [])

  // ── Init flight particle geometry ────────────────────────────────────────────
  useEffect(() => {
    if (!fpGeoRef.current || !hasFP) return
    const attr = new THREE.BufferAttribute(fpPos.current, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    fpGeoRef.current.setAttribute('position', attr)
    fpGeoRef.current.setDrawRange(0, FP_POOL)
  }, [hasFP])

  // ── Init impact particles ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!showImpact || !pGeoRef.current) return
    const attr = new THREE.BufferAttribute(pPos.current, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    pGeoRef.current.setAttribute('position', attr)
    if (flashRef.current) flashRef.current.intensity = def.impact.flash.intensity
  }, [showImpact, def])

  // ── Homing: find target once on mount ────────────────────────────────────────
  useEffect(() => {
    const type = def.targeting?.type
    if (!type || type === 'none') return
    if (type === 'self') { targetType.current = 'self'; return }

    let best = Infinity
    if (type === 'nearest-enemy' || type === 'nearest') {
      for (const [sid, sp] of Object.entries(slimePosRef.current)) {
        if (!sp) continue
        const d = (origin.x - sp[0]) ** 2 + (origin.z - sp[2]) ** 2
        if (d < best) { best = d; targetId.current = Number(sid); targetType.current = 'slime' }
      }
    }
    if (type === 'nearest-object' || (type === 'nearest' && targetId.current === null)) {
      best = Infinity
      treePositions.forEach((tp, i) => {
        const d = (origin.x - tp[0]) ** 2 + (origin.z - tp[2]) ** 2
        if (d < best) { best = d; targetId.current = i; targetType.current = 'tree' }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── doImpact ──────────────────────────────────────────────────────────────────
  const doImpact = useCallback((hitPos) => {
    if (phase.current !== 'flying') return
    phase.current = 'impacting'
    impactVec.current.copy(hitPos)

    if (groupRef.current) groupRef.current.visible = false

    const sp = def.impact.particles.speed
    pVel.current = Array.from({ length: N }, () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * sp * 2,
        Math.random() * sp * 0.9 + sp * 0.1,
        (Math.random() - 0.5) * sp * 2,
      )
    )
    for (let i = 0; i < N; i++) {
      pPos.current[i * 3    ] = hitPos.x
      pPos.current[i * 3 + 1] = hitPos.y + 0.3
      pPos.current[i * 3 + 2] = hitPos.z
      pLife.current[i] = 1
      pDur.current[i]  = def.impact.particles.lifetime * (0.5 + Math.random() * 0.5)
    }
    flashElapsed.current = 0

    const isSelf = targetType.current === 'self'
    onHit?.(id, hitPos.clone(), {
      slimeIds:     [...hitSlimes.current],
      treeIndices:  [...hitTrees.current],
      isSelf,
      healAmount:   isSelf ? (def.heal?.amount ?? 0) : 0,
      spellElement: def.element ?? 'none',
      baseDamage:   def.damage?.direct ?? 100,
    })
    setShowImpact(true)
  }, [def, id, onHit, N])

  // ── Main loop ─────────────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    if (pausedRef?.current) return

    // ── FLYING ──
    if (phase.current === 'flying') {
      if (targetType.current === 'self') { doImpact(pos.current); return }

      // Homing
      const tt = def.targeting?.type
      if (tt && tt !== 'none' && targetId.current !== null) {
        let tp = null
        if (targetType.current === 'slime') {
          const sp = slimePosRef.current[targetId.current]
          if (sp) tp = new THREE.Vector3(sp[0], pos.current.y, sp[2])
        } else if (targetType.current === 'tree') {
          const t = treePositions[targetId.current]
          if (t) tp = new THREE.Vector3(t[0], pos.current.y, t[2])
        }
        if (tp) {
          const toT = tp.sub(pos.current)
          if (toT.lengthSq() > 0.01) {
            dir.current.lerp(toT.normalize(), (def.targeting.turnRate ?? 3) * delta)
            dir.current.y = 0
            dir.current.normalize()
          }
        }
      }

      // Move
      const spd = def.physics.speed
      pos.current.x += dir.current.x * spd * delta
      pos.current.z += dir.current.z * spd * delta
      distTraveled.current += spd * delta

      // Position the layer group
      if (groupRef.current) groupRef.current.position.copy(pos.current)

      // Animate layer rotations
      layers.forEach((layer, i) => {
        const m = layerRefs.current[i]
        if (!m) return
        m.rotation.x += (layer.rotX ?? 0) * delta
        m.rotation.y += (layer.rotY ?? 0) * delta
        m.rotation.z += (layer.rotZ ?? 0) * delta
      })

      // Trail
      trailPts.current.unshift(pos.current.clone())
      if (trailPts.current.length > TRAIL_MAX) trailPts.current.pop()
      const tGeo = trailGeoRef.current
      if (tGeo) {
        const attr = tGeo.getAttribute('position')
        if (attr) {
          trailPts.current.forEach((p, i) => attr.setXYZ(i, p.x, p.y, p.z))
          attr.needsUpdate = true
          tGeo.setDrawRange(0, trailPts.current.length)
        }
      }

      // Flight particles
      if (hasFP) {
        const interval = 1.0 / fp.countPerSec
        fpTimer.current += delta
        while (fpTimer.current >= interval) {
          fpTimer.current -= interval
          const slot = fpSlot.current % FP_POOL
          fpSlot.current++
          fpPos.current[slot * 3    ] = pos.current.x
          fpPos.current[slot * 3 + 1] = pos.current.y
          fpPos.current[slot * 3 + 2] = pos.current.z
          fpLife.current[slot]    = 1.0
          fpMaxLife.current[slot] = fp.lifetime
          // Velocity: random direction within spread cone around backward-flight axis
          const backward = dir.current.clone().negate()
          const v = randomInCone(backward, fp.spread)
          v.multiplyScalar(fp.speed)
          fpVel.current[slot].copy(v)
        }
        // Update all pool particles
        for (let i = 0; i < FP_POOL; i++) {
          if (fpLife.current[i] <= 0) continue
          fpLife.current[i] -= delta / fpMaxLife.current[i]
          if (fpLife.current[i] <= 0) {
            fpLife.current[i] = 0
            fpPos.current[i * 3 + 1] = -9999 // park hidden
            continue
          }
          fpPos.current[i * 3    ] += fpVel.current[i].x * delta
          fpPos.current[i * 3 + 1] += fpVel.current[i].y * delta
          fpPos.current[i * 3 + 2] += fpVel.current[i].z * delta
        }
        if (fpGeoRef.current) {
          const a = fpGeoRef.current.getAttribute('position')
          if (a) a.needsUpdate = true
        }
      }

      if (distTraveled.current >= def.physics.maxRange) { doImpact(pos.current); return }

      // Slime collision
      for (const [sid, sp] of Object.entries(slimePosRef.current)) {
        if (!sp) continue
        const dx = pos.current.x - sp[0], dz = pos.current.z - sp[2]
        if (Math.sqrt(dx * dx + dz * dz) < def.collision.radius + def.collision.slimeRadius) {
          hitSlimes.current.add(Number(sid))
          doImpact(pos.current)
          return
        }
      }

      // Tree collision
      for (let i = 0; i < treePositions.length; i++) {
        const tp = treePositions[i]
        const dx = pos.current.x - tp[0], dz = pos.current.z - tp[2]
        if (Math.sqrt(dx * dx + dz * dz) < def.collision.radius + def.collision.treeRadius) {
          if (def.damage.burnsTrees) hitTrees.current.add(i)
          doImpact(pos.current)
          return
        }
      }
    }

    // ── IMPACTING ──
    else if (phase.current === 'impacting') {
      let anyAlive = false
      for (let i = 0; i < N; i++) {
        if (pLife.current[i] <= 0) continue
        pLife.current[i] -= delta / pDur.current[i]
        if (pLife.current[i] <= 0) { pLife.current[i] = 0; continue }
        anyAlive = true
        const v = pVel.current[i]
        v.y += def.impact.particles.gravity * delta
        pPos.current[i * 3    ] += v.x * delta
        pPos.current[i * 3 + 1] += v.y * delta
        pPos.current[i * 3 + 2] += v.z * delta
      }
      if (pGeoRef.current) {
        const a = pGeoRef.current.getAttribute('position')
        if (a) a.needsUpdate = true
      }

      flashElapsed.current += delta
      if (flashRef.current) {
        const t = Math.max(0, 1 - flashElapsed.current / def.impact.flash.duration)
        flashRef.current.intensity = def.impact.flash.intensity * t * t
      }

      if (!anyAlive && flashElapsed.current > def.impact.flash.duration) {
        phase.current = 'done'
        onExpire?.(id)
      }
    }
  })

  const ip = impactVec.current

  return (
    <group>
      {/* ── Layer group (moved as one, layers rotate individually) ── */}
      <group ref={groupRef} position={origin.toArray()}>
        {layers.map((layer, i) => (
          <mesh
            key={i}
            ref={el => { layerRefs.current[i] = el }}
            scale={[layer.scaleX ?? 1, layer.scaleY ?? 1, layer.scaleZ ?? 1]}
          >
            <LayerGeometry type={layer.type} size={layer.size} />
            <meshStandardMaterial
              color={layer.color}
              emissive={layer.color}
              emissiveIntensity={layer.emissiveIntensity ?? 5}
              transparent={layer.opacity < 1}
              opacity={layer.opacity ?? 1}
              toneMapped={false}
              side={THREE.DoubleSide}
              depthWrite={layer.opacity >= 0.99}
            />
          </mesh>
        ))}
        {layers.length > 0 && (
          <pointLight
            color={def.light.color}
            intensity={def.light.intensity}
            distance={def.light.distance}
          />
        )}
      </group>

      {/* ── Trail ── */}
      <line>
        <bufferGeometry ref={trailGeoRef} />
        <lineBasicMaterial
          color={def.trail.color}
          transparent opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </line>

      {/* ── Flight particles ── */}
      {hasFP && (
        <points>
          <bufferGeometry ref={fpGeoRef} />
          <pointsMaterial
            color={fp.color ?? def.projectile.color}
            size={fp.size ?? 0.15}
            sizeAttenuation
            transparent
            opacity={fp.opacity ?? 0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      )}

      {/* ── Impact ── */}
      {showImpact && (
        <>
          <points>
            <bufferGeometry ref={pGeoRef} />
            <pointsMaterial
              color={def.impact.particles.color}
              size={def.impact.particles.size}
              sizeAttenuation transparent
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </points>
          <pointLight
            ref={flashRef}
            position={[ip.x, ip.y + 0.5, ip.z]}
            color={def.impact.flash.color}
            intensity={def.impact.flash.intensity}
            distance={14}
          />
        </>
      )}
    </group>
  )
}
