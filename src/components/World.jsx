const WORLD = 40

export { WORLD }

export default function World() {
  return (
    <>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WORLD * 2, WORLD * 2]} />
        <meshLambertMaterial color="#4a7c35" />
      </mesh>

      {/* Invisible walls: north, south, east, west */}
      <Wall position={[0, 2, -WORLD]} rotation={[0, 0, 0]} size={[WORLD * 2, 4]} />
      <Wall position={[0, 2,  WORLD]} rotation={[0, Math.PI, 0]} size={[WORLD * 2, 4]} />
      <Wall position={[ WORLD, 2, 0]} rotation={[0, -Math.PI / 2, 0]} size={[WORLD * 2, 4]} />
      <Wall position={[-WORLD, 2, 0]} rotation={[0,  Math.PI / 2, 0]} size={[WORLD * 2, 4]} />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-WORLD}
        shadow-camera-right={WORLD}
        shadow-camera-top={WORLD}
        shadow-camera-bottom={-WORLD}
      />
    </>
  )
}

function Wall({ position, rotation, size }) {
  return (
    <mesh position={position} rotation={rotation} visible={false}>
      <planeGeometry args={size} />
      <meshBasicMaterial />
    </mesh>
  )
}
