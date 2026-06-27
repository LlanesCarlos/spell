export const ELEMENTS = {
  none:      { color: '#999999', emissive: '#333333', lightColor: '#aaaaaa' },
  fire:      { color: '#ff4400', emissive: '#ff2200', lightColor: '#ff6600' },
  water:     { color: '#2288ff', emissive: '#0055cc', lightColor: '#44aaff' },
  ice:       { color: '#aaddff', emissive: '#88bbee', lightColor: '#cceeff' },
  electric:  { color: '#ffee00', emissive: '#ddcc00', lightColor: '#ffff44' },
  darkness:  { color: '#9933cc', emissive: '#550099', lightColor: '#aa44ff' },
  holy:      { color: '#ffffaa', emissive: '#ffee66', lightColor: '#ffffff' },
  poison:    { color: '#44cc00', emissive: '#229900', lightColor: '#66ff22' },
  nature:    { color: '#228800', emissive: '#114400', lightColor: '#44bb00' },
  earth:     { color: '#cc8844', emissive: '#885522', lightColor: '#ddaa66' },
  wind:      { color: '#aaffee', emissive: '#66ddcc', lightColor: '#ccffee' },
}

export const ELEMENT_NAMES = Object.keys(ELEMENTS)
export const NON_NONE_ELEMENTS = ELEMENT_NAMES.filter(e => e !== 'none')

// spell element → slime element(s) it deals 2× damage to
export const STRONG_AGAINST = {
  none:      [],
  fire:      ['ice', 'nature'],
  water:     ['fire', 'earth'],
  ice:       ['nature', 'wind'],
  electric:  ['water', 'wind'],
  darkness:  ['holy'],
  holy:      ['darkness', 'poison'],
  poison:    ['nature', 'earth'],
  nature:    ['water', 'earth'],
  earth:     ['electric', 'fire'],
  wind:      ['ice', 'poison'],
}

export function getElementalMultiplier(spellElement, slimeElement) {
  if (!spellElement || spellElement === 'none') return 1
  if (!slimeElement || slimeElement === 'none') return 1
  return STRONG_AGAINST[spellElement]?.includes(slimeElement) ? 2 : 1
}

export function rollElement(chance = 0.1) {
  if (Math.random() > chance) return 'none'
  return NON_NONE_ELEMENTS[Math.floor(Math.random() * NON_NONE_ELEMENTS.length)]
}
