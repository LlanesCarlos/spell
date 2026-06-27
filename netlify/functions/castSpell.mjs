import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { z } from 'zod'

// ─── Element color palettes ───────────────────────────────────────────────────
// 'primary' = main color, 'bright' = lighter, 'dark' = deeper, 'contrast' = opposing hue
const PALETTES = {
  none:      { primary: '#999999', bright: '#cccccc', dark: '#444444', contrast: '#6688aa' },
  fire:      { primary: '#ff4400', bright: '#ffcc44', dark: '#990000', contrast: '#0088ff' },
  water:     { primary: '#2288ff', bright: '#aaddff', dark: '#003388', contrast: '#ff8833' },
  ice:       { primary: '#aaddff', bright: '#eeffff', dark: '#4488aa', contrast: '#ff8844' },
  electric:  { primary: '#ffee00', bright: '#ffffaa', dark: '#887700', contrast: '#aa00ff' },
  darkness:  { primary: '#9933cc', bright: '#cc66ff', dark: '#220044', contrast: '#ffffaa' },
  holy:      { primary: '#ffffaa', bright: '#ffffff', dark: '#aaaa44', contrast: '#220044' },
  poison:    { primary: '#44cc00', bright: '#88ff44', dark: '#114400', contrast: '#cc00aa' },
  nature:    { primary: '#228800', bright: '#55cc22', dark: '#063300', contrast: '#880022' },
  earth:     { primary: '#cc8844', bright: '#ddaa66', dark: '#442200', contrast: '#4488cc' },
  wind:      { primary: '#aaffee', bright: '#eeffff', dark: '#448866', contrast: '#ffaa44' },
}

// Resolve a color variant for a given element
function col(element, variant) {
  return PALETTES[element]?.[variant] ?? PALETTES.none.primary
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

// One visual "layer" — a geometric solid that makes up part of the projectile.
// Spells can stack 0-3 layers. Zero layers = particle-only spell (gas, mist, etc.)
const LayerSpec = z.object({
  type: z.enum(['sphere', 'torus', 'box', 'cone', 'cylinder', 'tetra'])
    .describe(
      'sphere=orb/ball, torus=ring/halo, box=cube/shard, cone=spike/arrow, ' +
      'cylinder=pillar/beam/bolt, tetra=crystal/gem'
    ),
  size: z.number().min(0.12).max(1.4)
    .describe('Base radius / half-extent of the shape (0.2=small, 0.5=medium, 1.0=large)'),
  scaleX: z.number().min(0.1).max(4.0)
    .describe('Width multiplier. >1 = wider, <1 = narrower'),
  scaleY: z.number().min(0.1).max(4.0)
    .describe('Height multiplier. For cylinder: makes it taller. For torus: flattens it'),
  scaleZ: z.number().min(0.1).max(4.0)
    .describe('Depth multiplier'),
  colorVariant: z.enum(['primary', 'bright', 'dark', 'contrast'])
    .describe(
      'primary=main element color, bright=glowing lighter version, ' +
      'dark=deep shadowed version, contrast=opposing hue for dramatic combos'
    ),
  opacity: z.number().min(0.08).max(1.0)
    .describe('1.0=solid, 0.5=translucent, 0.1=ghostly'),
  emissiveIntensity: z.number().min(0.5).max(10.0)
    .describe('Glow brightness. 2=subtle, 5=normal, 10=blinding'),
  rotX: z.number().min(-4.0).max(4.0)
    .describe('Continuous spin speed on X axis (rad/s). 0=static'),
  rotY: z.number().min(-4.0).max(4.0)
    .describe('Continuous spin speed on Y axis (rad/s). Positive=counterclockwise'),
  rotZ: z.number().min(-4.0).max(4.0)
    .describe('Continuous spin speed on Z axis (rad/s)'),
})

// Continuous particles emitted during flight.
// Use this for: gas clouds, mist, sparkling trails, smoke, etc.
// Set enabled=false for clean solid projectiles.
const FlightParticlesSpec = z.object({
  enabled: z.boolean()
    .describe('True to emit particles while the spell is in flight'),
  countPerSec: z.number().int().min(1).max(60)
    .describe('Particles emitted per second during flight'),
  size: z.number().min(0.04).max(1.2)
    .describe('Visual size of each particle'),
  opacity: z.number().min(0.05).max(1.0)
    .describe('Particle transparency'),
  spread: z.number().min(0).max(360)
    .describe(
      'Angular spread in degrees around the backward flight direction. ' +
      '0=tight backward trail, 90=hemisphere trail, 180=full sphere cloud, ' +
      '360=omnidirectional (use for gas/mist that surrounds the projectile)'
    ),
  speed: z.number().min(0.2).max(8.0)
    .describe('Speed particles drift away from emission point'),
  lifetime: z.number().min(0.2).max(4.0)
    .describe('Seconds each particle lives'),
  colorVariant: z.enum(['primary', 'bright', 'dark', 'contrast'])
    .describe('Color of the flight particles (same palette as layers)'),
})

const SpellSpec = z.object({
  name: z.string()
    .describe('Evocative spell name, 2-4 words, matching the player description'),

  element: z.enum([
    'none', 'fire', 'water', 'ice', 'electric',
    'darkness', 'holy', 'poison', 'nature', 'earth', 'wind',
  ]).describe('Element that best represents the concept'),

  // ── Visual composition ──────────────────────────────────────────────────────
  // IMPORTANT: 0 layers is valid! Use 0 layers for purely particle-based spells
  // (gas, mist, smoke, spiritual auras, etc.). Combine layers for complex visuals.
  layers: z.array(LayerSpec).min(0).max(3)
    .describe(
      'Geometric solid layers. Stack 0-3 shapes. ' +
      '0 = particle-only (gas, mist, invisible burst). ' +
      '1 = single shape (fireball, ice spike). ' +
      '2 = compound (ring+orb, crystal+aura). ' +
      '3 = complex (judgment: torus+sphere+tetra). ' +
      'Be creative — combine shapes to match the concept.'
    ),

  flightParticles: FlightParticlesSpec
    .describe(
      'Particles continuously emitted while the spell flies. ' +
      'Use for: gas (enabled, high spread, slow, high opacity), ' +
      'trails (enabled, low spread, fast, low opacity), ' +
      'clean solid spells (enabled=false).'
    ),

  // ── Gameplay stats ──────────────────────────────────────────────────────────
  targetingType: z.enum(['nearest-enemy', 'none', 'self'])
    .describe(
      'nearest-enemy=homes to closest slime, ' +
      'none=straight shot in aimed direction, ' +
      'self=detonates on wizard (healing only)'
    ),

  speed: z.number().min(4).max(38)
    .describe(
      'Projectile speed in units/s. ' +
      'Tiny fast bolts: 28-38. Normal spells: 16-26. ' +
      'Slow massive spells / gas clouds: 4-14.'
    ),

  collisionRadius: z.number().min(0.3).max(3.0)
    .describe(
      'Collision detection radius. Match to visual size of the spell. ' +
      'Small bolt: 0.3-0.5. Normal: 0.6-1.0. Wide AOE / gas cloud: 1.5-3.0.'
    ),

  damage: z.number().min(0).max(250)
    .describe('Damage on hit. 0 for healing spells.'),

  healAmount: z.number().min(0).max(80)
    .describe('HP restored when targetingType is "self". 0 for attack spells.'),

  impactParticleCount: z.number().int().min(6).max(80)
    .describe('Number of particles in the explosion on impact'),

  impactParticleSpeed: z.number().min(2).max(16)
    .describe('How violently particles burst outward on impact'),

  burnsTrees: z.boolean()
    .describe('True only for fire, lava, or explosive spells'),
})

// ─── Build full spell definition from compact LLM spec ────────────────────────
function buildSpellDef(spec) {
  const palette = PALETTES[spec.element] ?? PALETTES.none

  return {
    name: spec.name,
    element: spec.element,

    layers: spec.layers.map(l => ({
      type:              l.type,
      size:              l.size,
      scaleX:            l.scaleX,
      scaleY:            l.scaleY,
      scaleZ:            l.scaleZ,
      color:             col(spec.element, l.colorVariant),
      opacity:           l.opacity,
      emissiveIntensity: l.emissiveIntensity,
      rotX:              l.rotX,
      rotY:              l.rotY,
      rotZ:              l.rotZ,
    })),

    flightParticles: {
      enabled:     spec.flightParticles.enabled,
      countPerSec: spec.flightParticles.countPerSec,
      size:        spec.flightParticles.size,
      opacity:     spec.flightParticles.opacity,
      spread:      spec.flightParticles.spread,
      speed:       spec.flightParticles.speed,
      lifetime:    spec.flightParticles.lifetime,
      color:       col(spec.element, spec.flightParticles.colorVariant),
    },

    // projectile.* retained for backward-compat (collision radius, light color)
    projectile: {
      radius:             spec.collisionRadius,
      color:              palette.primary,
      emissive:           palette.dark,
      emissiveIntensity:  5,
    },

    light: {
      color:     palette.bright,
      intensity: spec.layers.length > 0 ? 5 : 2,
      distance:  9,
    },

    trail: {
      color:  palette.primary,
      length: 18,
    },

    physics: {
      speed:    spec.speed,
      maxRange: 42,
    },

    collision: {
      radius:      spec.collisionRadius,
      slimeRadius: 0.7,
      treeRadius:  1.2,
    },

    damage: {
      direct:     spec.damage,
      burnsTrees: spec.burnsTrees,
    },

    targeting: {
      type:     spec.targetingType,
      turnRate: 3.5,
    },

    impact: {
      particles: {
        count:    spec.impactParticleCount,
        color:    palette.bright,
        size:     0.2,
        speed:    spec.impactParticleSpeed,
        lifetime: 1.0,
        gravity:  -7,
      },
      burn:  { radius: 2.0, color: '#110500' },
      flash: { color: palette.bright, intensity: 18, duration: 0.45 },
    },

    ...(spec.targetingType === 'self' && spec.healAmount > 0
      ? { heal: { amount: spec.healAmount } }
      : {}),
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a spell-crafting AI for a 3D wizard game. Given any natural language description, you return a structured spell definition. Be creative — interpret descriptions poetically.

═══ VISUAL COMPOSITION ═══

Spells are made of two parts: geometric LAYERS (solid shapes) and FLIGHT PARTICLES (cloud/trail during flight).

LAYERS — stack 0 to 3 solid geometric shapes:
  sphere    → energy orb, fireball, planet, eye, seed
  torus     → ring, halo, portal, vortex, saturn-ring, crown
  box       → cube, crystal block, rock, crate, shard, tablet
  cone      → spike, thorn, arrow, drill, stalactite, fang
  cylinder  → pillar, bolt, beam, column, staff, tower
  tetra     → gem crystal, dark shard, rune, star, pyramid

Use scaleX/Y/Z to stretch shapes:
  cylinder with scaleY=3.5, scaleX=0.25 → a thin lightning bolt
  torus with scaleY=0.06, scaleX=1.8    → a flat wide orbital ring
  box with scaleX=2.0, scaleY=0.3       → a flat earth slab

ZERO LAYERS is valid and important — use it for:
  poison gas, toxic cloud, healing mist, invisibility, smoke, spiritual aura, etc.
  These are expressed entirely through flightParticles.

Multiple layers create compound visuals:
  holy judgment: torus(bright, flat, spinning) + sphere(contrast=dark void, small)
  dark crystal: tetra(dark, large) + sphere(contrast=bright, tiny, inside)
  storm vortex: torus(primary, tilted rotX) + cylinder(bright, thin, vertical)

LAYER TIPS:
  - Use 'contrast' colorVariant for a dramatic second element inside the same spell
  - High opacity (0.9-1.0) for solid core shapes, lower (0.2-0.5) for aura/glow layers
  - rotY on a torus makes it spin like a halo; rotX tilts it like a wheel

FLIGHT PARTICLES — particles continuously emitted while spell flies:
  enabled=false  → clean projectile, no trail cloud
  spread=0-30    → tight backward trail (comet tail, sparkle)
  spread=60-120  → loose backward cloud (fire smoke, steam)
  spread=180-360 → surrounding cloud / aura (gas, poison mist, healing glow)

  Gas / mist spells: spread=300-360, high countPerSec (20-50), slow speed (0.5-2), high opacity (0.3-0.7), large size (0.4-1.0), long lifetime (2-4s)
  Sparkle trail: spread=15-40, countPerSec=8-20, fast speed (3-6), low opacity (0.2-0.4), small size (0.05-0.15), short lifetime (0.3-0.8s)
  Smoke plume: spread=60-120, countPerSec=15-30, slow speed (1-3), medium opacity (0.15-0.35), medium size (0.3-0.6), medium lifetime (1-2s)

═══ ELEMENT SELECTION ═══
fire=combustion/rage, water=flow/pressure, ice=cold/stillness, electric=speed/shock,
darkness=void/decay/shadow, holy=light/divine/healing, poison=corruption/toxin,
nature=growth/life, earth=weight/permanence, wind=air/freedom, none=raw arcane

═══ STAT CALIBRATION ═══
Normal:    speed=18-26, damage=80-130, collisionRadius=0.6-0.8
Fast weak: speed=28-38, damage=40-80,  collisionRadius=0.3-0.5
Slow huge: speed=6-14,  damage=150-250, collisionRadius=1.2-3.0
Healing:   targetingType="self", healAmount=25-60, damage=0, speed=any
Gas/cloud: speed=8-14,  damage=60-110, collisionRadius=1.5-2.5 (wide hit)

═══ CREATIVE EXAMPLES ═══
"poison gas"     → element:poison, layers:[], flightParticles:{enabled:true, spread:320, countPerSec:30, size:0.6, opacity:0.4, speed:1.0, lifetime:2.5, colorVariant:primary}
"wave crash"     → element:water, layers:[{type:torus,size:0.7,scaleX:2.2,scaleY:0.1,scaleZ:1,colorVariant:primary,opacity:0.9,emissiveIntensity:5,rotX:0,rotY:1.2,rotZ:0}], flightParticles:{enabled:true,spread:60,countPerSec:12,size:0.2,opacity:0.4,speed:2,lifetime:0.8,colorVariant:bright}
"judgment day"   → element:holy, layers:[{type:torus,size:1.0,scaleX:1,scaleY:0.07,scaleZ:1,colorVariant:bright,opacity:1,emissiveIntensity:8,rotX:0,rotY:2,rotZ:0},{type:sphere,size:0.45,scaleX:1,scaleY:1,scaleZ:1,colorVariant:contrast,opacity:1,emissiveIntensity:6,rotX:0,rotY:0,rotZ:0}], flightParticles:{enabled:true,spread:45,countPerSec:10,size:0.1,opacity:0.7,speed:2.5,lifetime:1.5,colorVariant:bright}, damage:200, speed:11, collisionRadius:1.8
"healing mist"   → element:holy, layers:[], targetingType:self, flightParticles:{enabled:true,spread:360,countPerSec:25,size:0.4,opacity:0.25,speed:1.0,lifetime:2.0,colorVariant:bright}
"shadow spear"   → element:darkness, layers:[{type:cylinder,size:0.2,scaleX:0.2,scaleY:4,scaleZ:0.2,colorVariant:dark,opacity:1,emissiveIntensity:3,rotX:0,rotY:0,rotZ:0},{type:tetra,size:0.3,scaleX:1,scaleY:1.5,scaleZ:1,colorVariant:primary,opacity:0.8,emissiveIntensity:7,rotX:0,rotY:3,rotZ:0}]

Always interpret descriptions liberally and express the concept visually. "Wrath of gods" should feel catastrophic. "Whisper" should feel subtle and ethereal. Match the visual drama to the implied power.`

// ─── Handler ──────────────────────────────────────────────────────────────────
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let prompt
  try {
    ;({ prompt } = JSON.parse(event.body ?? '{}'))
    if (!prompt || typeof prompt !== 'string') throw new Error('missing prompt')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body must be { prompt: string }' }) }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY not set' }) }
  }

  try {
    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-1.5-flash',
      apiKey,
      temperature: 0.8,
    })

    const structured = model.withStructuredOutput(SpellSpec, { name: 'SpellSpec' })

    const spec = await structured.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: `Spell description: "${prompt}"` },
    ])

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSpellDef(spec)),
    }
  } catch (err) {
    console.error('[castSpell] error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Spell generation failed', detail: err.message }),
    }
  }
}
