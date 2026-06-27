// ─── Element color palettes ───────────────────────────────────────────────────
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

function col(element, variant) {
  return PALETTES[element]?.[variant] ?? PALETTES.none.primary
}

// ─── JSON schema for structured output ───────────────────────────────────────
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    name:    { type: 'string' },
    element: { type: 'string', enum: ['none','fire','water','ice','electric','darkness','holy','poison','nature','earth','wind'] },
    layers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type:              { type: 'string', enum: ['sphere','torus','box','cone','cylinder','tetra'] },
          size:              { type: 'number' },
          scaleX:            { type: 'number' },
          scaleY:            { type: 'number' },
          scaleZ:            { type: 'number' },
          colorVariant:      { type: 'string', enum: ['primary','bright','dark','contrast'] },
          opacity:           { type: 'number' },
          emissiveIntensity: { type: 'number' },
          rotX:              { type: 'number' },
          rotY:              { type: 'number' },
          rotZ:              { type: 'number' },
        },
        required: ['type','size','scaleX','scaleY','scaleZ','colorVariant','opacity','emissiveIntensity','rotX','rotY','rotZ'],
        additionalProperties: false,
      },
      minItems: 0,
      maxItems: 3,
    },
    flightParticles: {
      type: 'object',
      properties: {
        enabled:      { type: 'boolean' },
        countPerSec:  { type: 'integer' },
        size:         { type: 'number' },
        opacity:      { type: 'number' },
        spread:       { type: 'number' },
        speed:        { type: 'number' },
        lifetime:     { type: 'number' },
        colorVariant: { type: 'string', enum: ['primary','bright','dark','contrast'] },
      },
      required: ['enabled','countPerSec','size','opacity','spread','speed','lifetime','colorVariant'],
      additionalProperties: false,
    },
    targetingType:       { type: 'string', enum: ['nearest-enemy','none','self'] },
    speed:               { type: 'number' },
    collisionRadius:     { type: 'number' },
    damage:              { type: 'number' },
    healAmount:          { type: 'number' },
    impactParticleCount: { type: 'integer' },
    impactParticleSpeed: { type: 'number' },
    burnsTrees:          { type: 'boolean' },
  },
  required: [
    'name','element','layers','flightParticles',
    'targetingType','speed','collisionRadius','damage','healAmount',
    'impactParticleCount','impactParticleSpeed','burnsTrees',
  ],
  additionalProperties: false,
}

// ─── Build full spell definition from LLM spec ───────────────────────────────
function buildSpellDef(spec) {
  const palette = PALETTES[spec.element] ?? PALETTES.none
  return {
    name:    spec.name,
    element: spec.element,
    layers: spec.layers.map(l => ({
      type: l.type, size: l.size,
      scaleX: l.scaleX, scaleY: l.scaleY, scaleZ: l.scaleZ,
      color: col(spec.element, l.colorVariant),
      opacity: l.opacity, emissiveIntensity: l.emissiveIntensity,
      rotX: l.rotX, rotY: l.rotY, rotZ: l.rotZ,
    })),
    flightParticles: {
      enabled: spec.flightParticles.enabled,
      countPerSec: spec.flightParticles.countPerSec,
      size: spec.flightParticles.size,
      opacity: spec.flightParticles.opacity,
      spread: spec.flightParticles.spread,
      speed: spec.flightParticles.speed,
      lifetime: spec.flightParticles.lifetime,
      color: col(spec.element, spec.flightParticles.colorVariant),
    },
    projectile: { radius: spec.collisionRadius, color: palette.primary, emissive: palette.dark, emissiveIntensity: 5 },
    light:      { color: palette.bright, intensity: spec.layers.length > 0 ? 5 : 2, distance: 9 },
    trail:      { color: palette.primary, length: 18 },
    physics:    { speed: spec.speed, maxRange: 42 },
    collision:  { radius: spec.collisionRadius, slimeRadius: 0.7, treeRadius: 1.2 },
    damage:     { direct: spec.damage, burnsTrees: spec.burnsTrees },
    targeting:  { type: spec.targetingType, turnRate: 3.5 },
    impact: {
      particles: { count: spec.impactParticleCount, color: palette.bright, size: 0.2, speed: spec.impactParticleSpeed, lifetime: 1.0, gravity: -7 },
      burn:  { radius: 2.0, color: '#110500' },
      flash: { color: palette.bright, intensity: 18, duration: 0.45 },
    },
    ...(spec.targetingType === 'self' && spec.healAmount > 0 ? { heal: { amount: spec.healAmount } } : {}),
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a spell-crafting AI for a 3D wizard game. Given any natural language description, return a structured spell definition. Be creative — interpret descriptions poetically.

VISUAL COMPOSITION
Spells are made of LAYERS (solid shapes, 0-3) and FLIGHT PARTICLES (continuous cloud/trail during flight).

LAYER TYPES: sphere=orb/fireball, torus=ring/halo, box=cube/shard, cone=spike/arrow, cylinder=pillar/bolt, tetra=crystal/gem
Use scaleX/Y/Z to stretch: cylinder scaleY=3.5 scaleX=0.25 = thin lightning bolt; torus scaleY=0.06 scaleX=1.8 = flat wide ring
Zero layers = particle-only spell (gas, mist, aura). Valid and encouraged for those concepts.
colorVariant: primary=main element color, bright=lighter glow, dark=deep shadow, contrast=opposing hue for drama

FLIGHT PARTICLES
spread=0-30: tight backward trail | spread=60-120: loose smoke/steam | spread=180-360: surrounding cloud/aura
Gas/mist: enabled=true, spread=300-360, countPerSec=20-50, speed=0.5-2, opacity=0.3-0.7, size=0.4-1.0, lifetime=2-4
Sparkle trail: spread=15-40, countPerSec=8-20, speed=3-6, opacity=0.2-0.4, size=0.05-0.15, lifetime=0.3-0.8
Clean solid projectile: enabled=false

ELEMENTS
fire=combustion/rage, water=flow/pressure, ice=cold/stillness, electric=speed/shock,
darkness=void/decay/shadow, holy=light/divine/healing, poison=corruption/toxin,
nature=growth/life, earth=weight/permanence, wind=air/freedom, none=raw arcane

STATS
Normal: speed=18-26, damage=80-130, collisionRadius=0.6-0.8
Fast/weak: speed=28-38, damage=40-80, collisionRadius=0.3-0.5
Slow/huge: speed=6-14, damage=150-250, collisionRadius=1.2-3.0
Healing: targetingType=self, healAmount=25-60, damage=0
Gas/cloud: speed=8-14, damage=60-110, collisionRadius=1.5-2.5
burnsTrees=true ONLY for fire or explosive spells.

Match visual drama to implied power. "Wrath of gods" = catastrophic. "Whisper" = subtle/ethereal.`

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

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'OPENROUTER_API_KEY not set' }) }
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT + '\n\nYou MUST respond with valid JSON only. No markdown, no explanation — just the raw JSON object.' },
    { role: 'user',   content: `Spell description: "${prompt}"` },
  ]

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://spell.netlify.app',
        'X-Title': 'Spell',
      },
      body: JSON.stringify({
        models: [
          'meta-llama/llama-3.3-70b-instruct:free',
          'google/gemini-2.0-flash-exp:free',
          'google/gemma-3-27b-it:free',
        ],
        route: 'fallback',
        messages,
        temperature: 0.8,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenRouter API ${res.status}: ${errText}`)
    }

    const json = await res.json()
    const text = json.choices?.[0]?.message?.content
    if (!text) throw new Error('Empty response from OpenRouter')

    const raw = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const spec = JSON.parse(raw)
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
