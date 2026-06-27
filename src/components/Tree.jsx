import { useGLTF } from '@react-three/drei'
import { useMemo, useEffect } from 'react'
import * as THREE from 'three'

export default function Tree({ position, burned }) {
  const { scene } = useGLTF('/models/tree.glb')
  const cloned = useMemo(() => scene.clone(true), [scene])

  useEffect(() => {
    if (!burned) return
    cloned.traverse((obj) => {
      if (!obj.isMesh) return
      const m = obj.material.clone()
      m.color.set('#1a0e00')
      m.emissive = new THREE.Color('#0a0500')
      m.emissiveIntensity = 0.3
      obj.material = m
    })
  }, [burned, cloned])

  return (
    <primitive
      object={cloned}
      position={position}
      scale={3}
      castShadow
      receiveShadow
    />
  )
}

useGLTF.preload('/models/tree.glb')
