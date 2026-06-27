import { GoogleGenAI, Type } from '@google/genai'

// Netlify automatically injects GEMINI_API_KEY and GOOGLE_GEMINI_BASE_URL
const genAI = new GoogleGenAI({})

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

// ─── Response schema (Gemini native structured output) ────────────────────────
const LAYER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type:              { type: Type.STRING, enum: ['sphere','torus','box','cone','cylinder','tetra'] },
    size:              { type: Type.NUMBER },
    scaleX:            { type: Type.NUMBER },
    scaleY:            { type: Type.NUMBER },
    scaleZ:            { type: Type.NUMBER },
    colorVariant:      { type: Type.STRING, enum: ['primary','bright','dark','contrast'] },
    opacity:           { type: Type.NUMBER },
    emissiveIntensity: { type: Type.NUMBER },
    rotX:              { type: Type.NUMBER },
    rotY:              { type: Type.NUMBER },
    rotZ:              { type: Type.NUMBER },
  },
  required: ['type','size','scaleX','scaleY','scaleZ','colorVariant','opacity','emissiveIntensity','rotX','rotY','rotZ'],
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name:    { type: Type.STRING },
    element: { type: Type.STRING, enum: ['none','fire','water','ice','electric','darkness','holy','poison','nature','earth','wind'] },
    layers:  { type: Type.ARRAY, items: LAYER_SCHEMA, minItems: 0, maxItems: 3 },
    flightParticles: {
      type: Type.OBJECT,
      properties: {
        enabled:     { type: Type.BOOLEAN },
        countPerSec: { type: Type.INTEGER },
        size:        { type: Type.NUMBER },
        opacity:     { type: Type.NUMBER },
        spread:      { type: Type.NUMBER },
        speed:       { type: Type.NUMBER },
        lifetime:    { type: Type.NUMBER },
        colorVariant:{ type: Type.STRING, enum: ['primary','bright','dark','contrast'] },
      },
      required: ['enabled','countPerSec','size','opacity','spread','speed','lifetime','colorVariant'],
    },
    targetingType:       { type: Type.STRING, enum: ['nearest-enemy','none','self'] },
    speed:               { type: Type.NUMBER },
    collisionRadius:     { type: Type.NUMBER },
    damage:              { type: Type.NUMBER },
    healAmount:          { type: Type.NUMBER },
    impactParticleCount: { type: Type.INTEGER },
    impactParticleSpeed: { type: Type.NUMBER },
    burnsTrees:          { type: Type.BOOLEAN },
  },
  required: [
    'name','element','layers','flightParticles',
    'targetingType','speed','collisionRadius','damage','healAmount',
    'impactParticleCount','impactParticleSpeed','burnsTrees',
  ],
}

// ─── Build full spell definition from LLM spec ───────────────────────────────
function buildSpellDef(spec) {
  const palette = PALETTES[spec.element] ?? PALETTES.none

  return {
    name:    spec.name,
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

    projectile: {
      radius:            spec.collisionRadius,
      color:             palette.primary,
      emissive:          palette.dark,
      emissiveIntensity: 5,
    },

    light: {
      color:     palette.bright,
      intensity: spec.layers.length > 0 ? 5 : 2,
      distance:  9,
    },

    trail:   { color: palette.primary, length: 18 },
    physics: { speed: spec.speed, maxRange: 42 },

    collision: {
      radius:      spec.collisionRadius,
      slimeRadius: 0.7,
      treeRadius:  1.2,
    },

    damage:   { direct: spec.damage, burnsTrees: spec.burnsTrees },
    targeting: { type: spec.targetingType, turnRate: 3.5 },

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
const SYSTEM_PROMPT = `You are a spell-crafting AI for a 3D wizard game. Given any natural language description, return a structured spell definition. Be creative — interpret descriptions poetically.

═══ VISUAL COMPOSITION ═══

Spells are made of LAYERS (solid shapes) and FLIGHT PARTICLES (cloud/trail during flight).

LAYERS — stack 0 to 3 solid shapes:
  sphere    → energy orb, fireball, planet, eye, seed
  torus     → ring, halo, portal, vortex, crown
  box       → cube, crystal block, rock, shard
  cone      → spike, thorn, arrow, drill, fang
  cylinder  → pillar, bolt, beam, column
  tetra     → gem crystal, dark shard, rune, pyramid

Use scaleX/Y/Z to stretch:
  cylinder scaleY=3.5 scaleX=0.25 → thin lightning bolt
  torus scaleY=0.06 scaleX=1.8    → flat wide orbital ring
  box scaleX=2.0 scaleY=0.3       → flat earth slab

ZERO LAYERS = particle-only spell (gas, mist, aura, smoke). Valid and encouraged.

Multiple layers = compound visuals:
  holy judgment: torus(bright,flat,spinning) + sphere(contrast=dark void)
  dark crystal:  tetra(dark,large) + sphere(contrast=bright,tiny)
  storm vortex:  torus(primary,tilted) + cylinder(bright,thin,vertical)

colorVariant: primary=main element color, bright=glowing lighter, dark=deep shadowed, contrast=opposing hue

FLIGHT PARTICLES:
  spread=0-30   → tight backward trail (comet tail)
  spread=60-120 → loose backward cloud (smoke, steam)
  spread=180-360→ surrounding cloud/aura (gas, mist, poison)

  Gas/mist: enabled=true, spread=300-360, countPerSec=20-50, speed=0.5-2, opacity=0.3-0.7, size=0.4-1.0, lifetime=2-4
  Sparkle trail: spread=15-40, countPerSec=8-20, speed=3-6, opacity=0.2-0.4, size=0.05-0.15, lifetime=0.3-0.8
  Clean solid projectile: enabled=false

═══ ELEMENT SELECTION ═══
fire=combustion/rage, water=flow/pressure, ice=cold/stillness, electric=speed/shock,
darkness=void/decay/shadow, holy=light/divine/healing, poison=corruption/toxin,
nature=growth/life, earth=weight/permanence, wind=air/freedom, none=raw arcane

═══ STAT CALIBRATION ═══
Normal:    speed=18-26, damage=80-130, collisionRadius=0.6-0.8
Fast weak: speed=28-38, damage=40-80,  collisionRadius=0.3-0.5
Slow huge: speed=6-14,  damage=150-250, collisionRadius=1.2-3.0
Healing:   targetingType="self", healAmount=25-60, damage=0
Gas/cloud: speed=8-14,  damage=60-110, collisionRadius=1.5-2.5
burnsTrees=true ONLY for fire or explosive spells.

═══ EXAMPLES ═══
"poison gas"   → element:poison, layers:[], flightParticles:{enabled:true,spread:320,countPerSec:30,size:0.6,opacity:0.4,speed:1.0,lifetime:2.5,colorVariant:primary}
"judgment day" → element:holy, layers:[torus(bright,flat,rotY=2)+sphere(contrast,small)], damage:200, speed:11
"shadow spear" → element:darkness, layers:[cylinder(dark,thin,tall)+tetra(primary,spinning)]
"healing mist" → element:holy, layers:[], targetingType:self, flightParticles:{enabled:true,spread:360,...}

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

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Spell description: "${prompt}"`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.8,
      },
    })

    const spec = JSON.parse(result.text)

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
