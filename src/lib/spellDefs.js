export const FIREBALL = {
  name: 'Fireball',
  element: 'fire',

  layers: [
    {
      type: 'sphere', size: 0.32,
      scaleX: 1, scaleY: 1, scaleZ: 1,
      color: '#ff4400',
      opacity: 1, emissiveIntensity: 5,
      rotX: 0, rotY: 0, rotZ: 0,
    },
  ],

  flightParticles: {
    enabled: true,
    countPerSec: 14,
    size: 0.1,
    opacity: 0.5,
    spread: 25,
    speed: 2.5,
    lifetime: 0.4,
    color: '#ff8800',
  },

  projectile: {
    radius: 0.5,
    color: '#ff4400',
    emissive: '#ff2200',
    emissiveIntensity: 5,
  },

  light: {
    color: '#ffcc44',
    intensity: 5,
    distance: 9,
  },

  trail: {
    color: '#ff8800',
    length: 18,
  },

  physics: {
    speed: 22,
    maxRange: 42,
  },

  collision: {
    radius: 0.5,
    slimeRadius: 0.7,
    treeRadius: 1.2,
  },

  damage: {
    direct: 100,
    burnsTrees: true,
  },

  targeting: {
    type: 'nearest-enemy',
    turnRate: 3.5,
  },

  impact: {
    particles: {
      count: 36,
      color: '#ff6600',
      size: 0.2,
      speed: 6,
      lifetime: 1.1,
      gravity: -7,
    },
    burn:  { radius: 2.0, color: '#110500' },
    flash: { color: '#ffaa00', intensity: 18, duration: 0.45 },
  },
}

/**
 * Fetch a spell definition from the Netlify serverless function (LangChain + Gemini).
 * Falls back to FIREBALL when the API is unavailable (local dev without netlify dev).
 */
export async function castSpell(text) {
  try {
    const res = await fetch('/.netlify/functions/castSpell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('[spell] API error:', res.status, err)
      return FIREBALL
    }
    return await res.json()
  } catch (e) {
    console.warn('[spell] API unreachable, using FIREBALL fallback:', e.message)
    return FIREBALL
  }
}
