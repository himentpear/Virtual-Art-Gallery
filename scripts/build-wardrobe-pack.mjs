import fs from 'node:fs'
import path from 'node:path'
import { compileProject, readRuntimePack, writeRuntimePack } from '@pixelsyn/compiler'
import { Character, validateAppearance, validateProject } from '@pixelsyn/core'

const TETO_PATH = path.resolve('public/characters/teto.pxpack')
const COPPER_PATH = path.resolve('public/characters/copper-ranger.pxpack')
const OUT_PATH = path.resolve('public/characters/hall-wardrobe.pxpack')

const tetoPack = readRuntimePack(new Uint8Array(fs.readFileSync(TETO_PATH)))
const copperPack = readRuntimePack(new Uint8Array(fs.readFileSync(COPPER_PATH)))

const project = structuredClone(tetoPack.project)
project.manifest.id = 'hall.wardrobe'
project.manifest.name = '苍穹回廊 · 换装角色集'

// 1. Prune unused reference pack sprites (`outfit.source-scarf-hair`) to stay well under 8192px atlas height,
// and merge sprites from copper-ranger.
project.sprites = project.sprites.filter(
  (s) => !s.id.startsWith('outfit.source-scarf-hair.') && !s.id.startsWith('scarf-hair.'),
)
for (const clip of project.clips) {
  clip.partTracks = clip.partTracks.filter(
    (track) => track.slotId !== 'hair.reference.back' && track.slotId !== 'hair.reference.front',
  )
}

const existingSpriteIds = new Set(project.sprites.map((s) => s.id))
for (const sprite of copperPack.project.sprites) {
  if (!existingSpriteIds.has(sprite.id)) {
    project.sprites.push(structuredClone(sprite))
    existingSpriteIds.add(sprite.id)
  }
}

// 2. Force-hide weapons and slash FX across ALL clips and partTracks (不进行武器展示)
for (const clip of project.clips) {
  for (const track of clip.partTracks) {
    if (track.slotId === 'source.layer.11' || track.slotId === 'source.layer.12') {
      for (const key of track.keys) {
        key.visible = false
      }
    }
  }
}

// 3. Helper: Color parsing & HSL recoloring
function parseHexRgba(hex) {
  const n = hex.slice(1)
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
    n.length === 8 ? parseInt(n.slice(6, 8), 16) : 255,
  ]
}

function toHexRgba(r, g, b, a) {
  const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)))
  const hex = (v) => clampByte(v).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h *= 60
  }
  return [h, s, l]
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360
  s = Math.max(0, Math.min(1, s))
  l = Math.max(0, Math.min(1, l))
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hNorm = h / 360
  return [
    Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hNorm) * 255),
    Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  ]
}

function isSkinTone(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b)
  return (
    (r >= 210 && g >= 165 && b >= 155 && r > b + 12 && r - g <= 65) ||
    (r >= 185 &&
      g >= 130 &&
      b >= 115 &&
      r > g &&
      g >= b &&
      r - b >= 18 &&
      r - g <= 75 &&
      h <= 34 &&
      l >= 0.56 &&
      s <= 0.78)
  )
}

function collectSlotSpriteSet(item, slotPredicate) {
  const ids = new Set()
  for (const part of item.parts) {
    if (!slotPredicate(part.slotId)) continue
    if (part.spriteId) ids.add(part.spriteId)
    for (const v of part.variants || []) {
      if (v.spriteId) ids.add(v.spriteId)
    }
  }
  return ids
}

// Lookup source items before rewriting project.items
const ttSourceItem = tetoPack.project.items.find((i) => i.id === 'outfit.teal-twintail')
const tetoSourceItem = tetoPack.project.items.find((i) => i.id === 'outfit.teto')
const doubaoSourceItem = tetoPack.project.items.find((i) => i.id === 'outfit.doubao')
const naiSourceItem = tetoPack.project.items.find((i) => i.id === 'outfit.naiwa')
const hoodieSourceItem = tetoPack.project.items.find((i) => i.id === 'wardrobe.outfit.hoodie')
const uniformSourceItem = tetoPack.project.items.find((i) => i.id === 'wardrobe.outfit.uniform')
const travelerSourceItem = tetoPack.project.items.find((i) => i.id === 'wardrobe.outfit.traveler')
const hairShortItem = tetoPack.project.items.find((i) => i.id === 'wardrobe.hair.short')
const hairBobItem = tetoPack.project.items.find((i) => i.id === 'wardrobe.hair.bob')
const hairPonytailItem = tetoPack.project.items.find((i) => i.id === 'wardrobe.hair.ponytail')
const hairLongItem = tetoPack.project.items.find((i) => i.id === 'wardrobe.hair.long')
const copSourceItem = copperPack.project.items.find((i) => i.id === 'outfit.copper-ranger')
const origSourceItem = tetoPack.project.items.find((i) => i.id === 'aseprite.5395cd0a.outfit')

// 4. Unify sprite color tables per palette channel (100% lossless!)
function unifyChannelSprites(channelName, predicate) {
  const sprites = project.sprites.filter(predicate)
  const colorToIndex = new Map()
  const masterColors = ['#00000000']
  colorToIndex.set('#00000000', 0)

  for (const sprite of sprites) {
    const localToMaster = sprite.colors.map((rawHex) => {
      const normalized = rawHex.length === 7 ? `${rawHex.toLowerCase()}ff` : rawHex.toLowerCase()
      if (normalized.endsWith('00')) return 0
      let idx = colorToIndex.get(normalized)
      if (idx === undefined) {
        idx = masterColors.length
        masterColors.push(normalized)
        colorToIndex.set(normalized, idx)
      }
      return idx
    })
    sprite.pixels = sprite.pixels.map((pIdx) => localToMaster[pIdx] ?? 0)
    sprite.colors = [...masterColors]
  }
  if (masterColors.length > 256) {
    throw new Error(`Channel ${channelName} exceeded 256 colors: ${masterColors.length}`)
  }
  console.log(`Channel ${channelName}: ${sprites.length} sprites, ${masterColors.length} colors`)
  return masterColors
}

const tetoHairSet = collectSlotSpriteSet(
  tetoSourceItem,
  (sl) => sl === 'source.layer.10' || sl.startsWith('teto.drill.'),
)
const tetoGarmentSet = collectSlotSpriteSet(
  tetoSourceItem,
  (sl) => sl !== 'source.layer.10' && !sl.startsWith('teto.drill.'),
)
const doubaoHairSet = collectSlotSpriteSet(doubaoSourceItem, (sl) => sl === 'source.layer.10')
const doubaoScarfSet = collectSlotSpriteSet(doubaoSourceItem, (sl) => sl.startsWith('doubao.scarf.'))
const doubaoGarmentSet = collectSlotSpriteSet(
  doubaoSourceItem,
  (sl) => sl !== 'source.layer.10' && !sl.startsWith('doubao.scarf.'),
)
const hoodieGarmentSet = collectSlotSpriteSet(hoodieSourceItem, (sl) => sl !== 'source.layer.10')
const uniformGarmentSet = collectSlotSpriteSet(uniformSourceItem, (sl) => sl !== 'source.layer.10')
const travelerGarmentSet = collectSlotSpriteSet(travelerSourceItem, (sl) => sl !== 'source.layer.10')

const hairHeadColors = unifyChannelSprites('hair_head', (s) => s.id.startsWith('teal-twintail.layer.5.'))
const hairBackColors = unifyChannelSprites('hair_back', (s) => s.id.startsWith('teal.tail.back.'))
const hairFrontColors = unifyChannelSprites('hair_front', (s) => s.id.startsWith('teal.tail.front.'))
const hairCopperColors = unifyChannelSprites('hair_copper', (s) => s.id.startsWith('copper-ranger.layer.5.'))
const hairNaiwaColors = unifyChannelSprites('hair_naiwa', (s) => s.id.startsWith('naiwa.artwork.Head.'))
const hairOrigColors = unifyChannelSprites('hair_original', (s) => s.id.startsWith('aseprite.5395cd0a.layer.10.'))
const hairTetoColors = unifyChannelSprites(
  'hair_teto',
  (s) => tetoHairSet.has(s.id) || s.id.startsWith('teto.head.') || s.id.startsWith('teto.drill.'),
)
const hairDoubaoColors = unifyChannelSprites(
  'hair_doubao',
  (s) => doubaoHairSet.has(s.id) || s.id.startsWith('doubao.head.'),
)
const wardrobeHairColors = unifyChannelSprites('hair', (s) => s.id.startsWith('wardrobe.hair.'))

const garmentTealColors = unifyChannelSprites(
  'garment_teal',
  (s) =>
    (s.id.startsWith('teal-twintail.layer.') && !s.id.startsWith('teal-twintail.layer.5.')) ||
    s.id === 'teal.skirt.0',
)
const garmentCopperColors = unifyChannelSprites(
  'garment_copper',
  (s) => s.id.startsWith('copper-ranger.layer.') && !s.id.startsWith('copper-ranger.layer.5.'),
)
const garmentNaiwaColors = unifyChannelSprites(
  'garment_naiwa',
  (s) => s.id.startsWith('naiwa.artwork.Body.') || s.id.startsWith('naiwa.layer.'),
)
const garmentOrigColors = unifyChannelSprites(
  'garment_original',
  (s) =>
    s.id.startsWith('aseprite.5395cd0a.layer.') &&
    !s.id.startsWith('aseprite.5395cd0a.layer.5.') &&
    !s.id.startsWith('aseprite.5395cd0a.layer.6.') &&
    !s.id.startsWith('aseprite.5395cd0a.layer.10.') &&
    !s.id.startsWith('aseprite.5395cd0a.layer.11.') &&
    !s.id.startsWith('aseprite.5395cd0a.layer.12.'),
)
const garmentTetoColors = unifyChannelSprites(
  'garment_teto',
  (s) => tetoGarmentSet.has(s.id) || s.id.startsWith('teto.skirt.'),
)
const garmentDoubaoColors = unifyChannelSprites('garment_doubao', (s) => doubaoGarmentSet.has(s.id))
const garmentHoodieColors = unifyChannelSprites('garment_hoodie', (s) => hoodieGarmentSet.has(s.id))
const garmentUniformColors = unifyChannelSprites('garment_uniform', (s) => uniformGarmentSet.has(s.id))
const garmentTravelerColors = unifyChannelSprites('garment_traveler', (s) => travelerGarmentSet.has(s.id))

const scarfColors = unifyChannelSprites(
  'scarf',
  (s) => s.id.startsWith('aseprite.5395cd0a.layer.5.') || s.id.startsWith('aseprite.5395cd0a.layer.6.'),
)
const scarfDoubaoColors = unifyChannelSprites('scarf_doubao', (s) => doubaoScarfSet.has(s.id))

// 5. Generate dye palettes
const HAIR_THEMES = [
  { id: 'original', name: '角色原色', hue: null, satMul: 1, lightShift: 0, accentHue: null },
  { id: 'teal', name: '青葱薄荷', hue: 178, satMul: 1.0, lightShift: 0.02, accentHue: 342 },
  { id: 'brown', name: '栗棕', hue: 26, satMul: 0.9, lightShift: -0.02, accentHue: 350 },
  { id: 'black', name: '自然黑', hue: 215, satMul: 0.2, lightShift: -0.22, accentHue: 210 },
  { id: 'sakura', name: '落樱绯粉', hue: 342, satMul: 1.08, lightShift: 0.08, accentHue: 45 },
  { id: 'violet', name: '星夜幽紫', hue: 268, satMul: 1.0, lightShift: 0.03, accentHue: 185 },
  { id: 'amber', name: '亚麻流金', hue: 38, satMul: 1.15, lightShift: 0.06, accentHue: 350 },
  { id: 'silver', name: '霜月银灰', hue: 215, satMul: 0.16, lightShift: 0.22, accentHue: 205 },
  { id: 'crimson', name: '赤焰绯红', hue: 355, satMul: 1.18, lightShift: -0.02, accentHue: 40 },
]

const GARMENT_THEMES = [
  { id: 'classic', name: '经典原色', hue: null, satMul: 1, lightShift: 0, trimHue: null },
  { id: 'navy', name: '深海绀青', hue: 222, satMul: 1.25, lightShift: -0.02, trimHue: 195 },
  { id: 'obsidian', name: '暗夜黑金', hue: 240, satMul: 0.25, lightShift: -0.08, trimHue: 42 },
  { id: 'emerald', name: '森之翠绿', hue: 148, satMul: 1.15, lightShift: 0.0, trimHue: 88 },
  { id: 'wine', name: '蔷薇酒红', hue: 344, satMul: 1.25, lightShift: 0.02, trimHue: 35 },
]

const SCARF_THEMES = [
  { id: 'crimson', name: '绯红赤焰', hue: null, satMul: 1, lightShift: 0 },
  { id: 'ivory', name: '月华纯白', hue: 210, satMul: 0.08, lightShift: 0.42 },
  { id: 'azure', name: '星海苍蓝', hue: 208, satMul: 1.05, lightShift: 0.05 },
  { id: 'gold', name: '流金琥珀', hue: 40, satMul: 1.1, lightShift: 0.08 },
  { id: 'shadow', name: '暗影玄黑', hue: 230, satMul: 0.18, lightShift: -0.22 },
]

function remapHairColor(hex, theme, mode) {
  if (hex === '#00000000' || theme.hue === null) return hex
  if (mode === 'teal' && theme.id === 'teal') return hex
  const [r, g, b, a] = parseHexRgba(hex)
  if (a === 0) return hex
  if (isSkinTone(r, g, b)) return hex
  const [h, s, l] = rgbToHsl(r, g, b)

  // Keep very dark ink / outlines mostly untouched, only softly tinted
  if (l < 0.13) {
    const [nr, ng, nb] = hslToRgb(theme.hue, Math.min(0.35, s), l)
    return toHexRgba(nr, ng, nb, a)
  }

  // miku: pink hair ties + neutral white clip/highlights
  if (mode === 'teal') {
    if ((h >= 305 || h <= 15) && s > 0.35) {
      const [nr, ng, nb] = hslToRgb(theme.accentHue ?? h, Math.min(0.9, s), l)
      return toHexRgba(nr, ng, nb, a)
    }
    if (s < 0.12 && l > 0.5) return hex
  }

  // copper ranger: copper hair/scarf accents
  if (mode === 'copper') {
    if (h >= 15 && h <= 50 && s > 0.25) {
      const [nr, ng, nb] = hslToRgb(
        theme.hue,
        Math.min(0.85, s * theme.satMul),
        Math.min(0.88, Math.max(0.14, l + theme.lightShift)),
      )
      return toHexRgba(nr, ng, nb, a)
    }
    return hex
  }

  // teto: preserve white wing clip (low sat) and ruby eyes / blush highlights (high lightness)
  if (mode === 'teto') {
    if (s < 0.15 && l > 0.22) return hex
    if (l > 0.65 && (h >= 335 || h <= 15)) return hex
    if ((h >= 330 || h <= 14) && s >= 0.24 && l >= 0.13 && l <= 0.64) {
      const newS = Math.min(0.95, Math.max(0.05, s * theme.satMul))
      const newL = Math.min(0.88, Math.max(0.14, l + theme.lightShift))
      const [nr, ng, nb] = hslToRgb(theme.hue, newS, newL)
      return toHexRgba(nr, ng, nb, a)
    }
    return hex
  }

  // doubao: preserve face, eyes, and white sclera; dye only dark-brown bob tones
  if (mode === 'doubao') {
    if (l > 0.53 || s < 0.15) return hex
    const newS = Math.min(0.92, Math.max(0.05, s * theme.satMul * 1.15))
    const newL = Math.min(0.85, Math.max(0.14, l + theme.lightShift * 0.8 + (theme.id === 'silver' ? 0.12 : 0)))
    const [nr, ng, nb] = hslToRgb(theme.hue, newS, newL)
    return toHexRgba(nr, ng, nb, a)
  }

  const newS = Math.min(0.95, Math.max(0.05, s * theme.satMul))
  const newL = Math.min(0.93, Math.max(0.14, l + theme.lightShift))
  const [nr, ng, nb] = hslToRgb(theme.hue, newS, newL)
  return toHexRgba(nr, ng, nb, a)
}

function remapGarmentColor(hex, theme, mode) {
  if (hex === '#00000000' || theme.hue === null) return hex
  const [r, g, b, a] = parseHexRgba(hex)
  if (a === 0) return hex
  if (isSkinTone(r, g, b)) return hex
  const [h, s, l] = rgbToHsl(r, g, b)
  if (l < 0.08) return hex

  if (mode === 'teal') {
    if ((h >= 120 && h <= 200 && s > 0.25) || (h >= 315 && s > 0.35)) {
      const targetH = h >= 315 ? (theme.trimHue ?? h) : theme.hue
      const [nr, ng, nb] = hslToRgb(
        targetH,
        Math.min(0.9, s * theme.satMul),
        Math.min(0.85, Math.max(0.15, l + theme.lightShift)),
      )
      return toHexRgba(nr, ng, nb, a)
    }
    if (l >= 0.1 && l <= 0.45) {
      const [nr, ng, nb] = hslToRgb(
        theme.hue,
        Math.min(0.55, Math.max(0.15, theme.satMul * 0.35)),
        Math.max(0.08, l + theme.lightShift * 0.5),
      )
      return toHexRgba(nr, ng, nb, a)
    }
    return hex
  }

  if (mode === 'copper') {
    if (h >= 15 && h <= 50 && s > 0.2) {
      const [nr, ng, nb] = hslToRgb(theme.trimHue ?? theme.hue, Math.min(0.85, s), l)
      return toHexRgba(nr, ng, nb, a)
    }
    if (l >= 0.12 && l <= 0.8) {
      const [nr, ng, nb] = hslToRgb(
        theme.hue,
        Math.min(0.6, Math.max(0.15, s * theme.satMul)),
        Math.max(0.1, Math.min(0.85, l + theme.lightShift)),
      )
      return toHexRgba(nr, ng, nb, a)
    }
    return hex
  }

  // Keep crisp whites (shirts, sneakers, socks, trims)
  if (l < 0.12 || l > 0.85) return hex
  const [nr, ng, nb] = hslToRgb(
    h > 280 || h < 30 ? (theme.trimHue ?? theme.hue) : theme.hue,
    Math.min(0.85, Math.max(0.15, s * theme.satMul)),
    Math.max(0.12, Math.min(0.84, l + theme.lightShift)),
  )
  return toHexRgba(nr, ng, nb, a)
}

function remapScarfColor(hex, theme) {
  if (hex === '#00000000' || theme.hue === null) return hex
  const [r, g, b, a] = parseHexRgba(hex)
  if (a === 0) return hex
  const [h, s, l] = rgbToHsl(r, g, b)
  if (l < 0.08 || s < 0.1) return hex
  const [nr, ng, nb] = hslToRgb(
    theme.hue,
    Math.min(0.95, Math.max(0.05, s * theme.satMul)),
    Math.min(0.94, Math.max(0.12, l + theme.lightShift)),
  )
  return toHexRgba(nr, ng, nb, a)
}

// Lookup PixelSyn's authored wardrobe hair palettes by swatch index
const psHairPaletteById = new Map(tetoPack.project.palettes.map((pl) => [pl.id, pl]))
const psBrownSwatches = psHairPaletteById.get('wardrobe.hair-color.brown')?.swatches ?? {}
const psHairBrownIndexByHex = new Map()
for (const [k, hex] of Object.entries(psBrownSwatches)) {
  const norm = hex.length === 7 ? `${hex.toLowerCase()}ff` : hex.toLowerCase()
  if (!psHairBrownIndexByHex.has(norm)) psHairBrownIndexByHex.set(norm, k)
}
const psHairThemeTargetId = {
  original: 'wardrobe.hair-color.brown',
  brown: 'wardrobe.hair-color.brown',
  black: 'wardrobe.hair-color.black',
  amber: 'wardrobe.hair-color.blond',
  silver: 'wardrobe.hair-color.silver',
}

function remapWardrobeHairColor(hex, theme) {
  if (hex === '#00000000') return hex
  const targetPaletteId = psHairThemeTargetId[theme.id]
  if (targetPaletteId) {
    const idxKey = psHairBrownIndexByHex.get(hex)
    const targetHex = idxKey !== undefined ? psHairPaletteById.get(targetPaletteId)?.swatches?.[idxKey] : undefined
    if (targetHex) {
      return targetHex.length === 7 ? `${targetHex.toLowerCase()}ff` : targetHex.toLowerCase()
    }
    if (theme.id === 'original' || theme.id === 'brown') return hex
  }
  return remapHairColor(hex, theme, 'orig')
}

project.palettes = []
function addPalettes(channel, masterColors, themes, mapper) {
  for (const theme of themes) {
    project.palettes.push({
      id: `${channel}.${theme.id}`,
      name: theme.name,
      channel,
      colors: masterColors.map((c) => mapper(c, theme)),
    })
  }
}

addPalettes('hair_head', hairHeadColors, HAIR_THEMES, (c, t) => remapHairColor(c, t, 'teal'))
addPalettes('hair_back', hairBackColors, HAIR_THEMES, (c, t) => remapHairColor(c, t, 'teal'))
addPalettes('hair_front', hairFrontColors, HAIR_THEMES, (c, t) => remapHairColor(c, t, 'teal'))
addPalettes('hair_copper', hairCopperColors, HAIR_THEMES, (c, t) => remapHairColor(c, t, 'copper'))
addPalettes('hair_naiwa', hairNaiwaColors, HAIR_THEMES, (c, t) => remapHairColor(c, t, 'orig'))
addPalettes('hair_original', hairOrigColors, HAIR_THEMES, (c, t) => remapHairColor(c, t, 'orig'))
addPalettes('hair_teto', hairTetoColors, HAIR_THEMES, (c, t) => remapHairColor(c, t, 'teto'))
addPalettes('hair_doubao', hairDoubaoColors, HAIR_THEMES, (c, t) => remapHairColor(c, t, 'doubao'))
addPalettes('hair', wardrobeHairColors, HAIR_THEMES, (c, t) => remapWardrobeHairColor(c, t))

addPalettes('garment_teal', garmentTealColors, GARMENT_THEMES, (c, t) => remapGarmentColor(c, t, 'teal'))
addPalettes('garment_copper', garmentCopperColors, GARMENT_THEMES, (c, t) => remapGarmentColor(c, t, 'copper'))
addPalettes('garment_naiwa', garmentNaiwaColors, GARMENT_THEMES, (c, t) => remapGarmentColor(c, t, 'orig'))
addPalettes('garment_original', garmentOrigColors, GARMENT_THEMES, (c, t) => remapGarmentColor(c, t, 'orig'))
addPalettes('garment_teto', garmentTetoColors, GARMENT_THEMES, (c, t) => remapGarmentColor(c, t, 'orig'))
addPalettes('garment_doubao', garmentDoubaoColors, GARMENT_THEMES, (c, t) => remapGarmentColor(c, t, 'orig'))
addPalettes('garment_hoodie', garmentHoodieColors, GARMENT_THEMES, (c, t) => remapGarmentColor(c, t, 'orig'))
addPalettes('garment_uniform', garmentUniformColors, GARMENT_THEMES, (c, t) => remapGarmentColor(c, t, 'orig'))
addPalettes('garment_traveler', garmentTravelerColors, GARMENT_THEMES, (c, t) => remapGarmentColor(c, t, 'orig'))

addPalettes('scarf', scarfColors, SCARF_THEMES, (c, t) => remapScarfColor(c, t))
addPalettes('scarf_doubao', scarfDoubaoColors, SCARF_THEMES, (c, t) => remapScarfColor(c, t))

// 6. Assign paletteChannel to body parts consistently
const body = project.bodies[0]
const fitProfile = body.fitProfileId
for (const part of body.parts) {
  if (part.slotId === 'source.layer.5' || part.slotId === 'source.layer.6') {
    part.paletteChannel = 'scarf'
  } else if (part.slotId === 'source.layer.10') {
    part.paletteChannel = 'hair_original'
  } else if (
    part.slotId === 'source.layer.3' ||
    part.slotId === 'source.layer.4' ||
    part.slotId === 'source.layer.7' ||
    part.slotId === 'source.layer.8' ||
    part.slotId === 'source.layer.9'
  ) {
    part.paletteChannel = 'garment_original'
  }
}

// 7. Build Modular Items for mix-and-match wardrobe
function clonePart(part, id, paletteChannel) {
  const cloned = structuredClone(part)
  cloned.id = id
  if (paletteChannel) cloned.paletteChannel = paletteChannel
  return cloned
}

function partBySlot(item, slotId) {
  const p = item.parts.find((entry) => entry.slotId === slotId)
  if (!p) throw new Error(`Missing slot ${slotId} in ${item.id}`)
  return p
}

function cloneWardrobeHairItem(sourceItem) {
  const item = structuredClone(sourceItem)
  item.occupies = ['slot.ponytail']
  return item
}

const modularItems = [
  // HEAD (slot.head)
  {
    id: 'head.teal',
    name: 'miku 少女发式',
    category: 'head',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.head'],
    requiresSlots: ['source.layer.10'],
    parts: [clonePart(partBySlot(ttSourceItem, 'source.layer.10'), 'mod.head.teal', 'hair_head')],
    hides: [{ targetSlotId: 'source.layer.10', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'head.teto',
    name: 'Teto 双翼发夹',
    category: 'head',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.head'],
    requiresSlots: ['source.layer.10'],
    parts: [clonePart(partBySlot(tetoSourceItem, 'source.layer.10'), 'mod.head.teto', 'hair_teto')],
    hides: [{ targetSlotId: 'source.layer.10', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'head.doubao',
    name: '豆包短发',
    category: 'head',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.head'],
    requiresSlots: ['source.layer.10'],
    parts: [clonePart(partBySlot(doubaoSourceItem, 'source.layer.10'), 'mod.head.doubao', 'hair_doubao')],
    hides: [{ targetSlotId: 'source.layer.10', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'head.naiwa',
    name: '奶蛙鸭嘴头',
    category: 'head',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.head'],
    requiresSlots: ['source.layer.10'],
    parts: [clonePart(partBySlot(naiSourceItem, 'source.layer.10'), 'mod.head.naiwa', 'hair_naiwa')],
    hides: [{ targetSlotId: 'source.layer.10', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'head.copper',
    name: '暮铜游侠风帽',
    category: 'head',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.head'],
    requiresSlots: ['source.layer.10'],
    parts: [clonePart(partBySlot(copSourceItem, 'source.layer.10'), 'mod.head.copper', 'hair_copper')],
    hides: [{ targetSlotId: 'source.layer.10', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'head.hoodie',
    name: '卫衣素面头',
    category: 'head',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.head'],
    requiresSlots: ['source.layer.10'],
    parts: [clonePart(partBySlot(hoodieSourceItem, 'source.layer.10'), 'mod.head.hoodie')],
    hides: [{ targetSlotId: 'source.layer.10', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'head.uniform',
    name: '学院素面头',
    category: 'head',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.head'],
    requiresSlots: ['source.layer.10'],
    parts: [clonePart(partBySlot(uniformSourceItem, 'source.layer.10'), 'mod.head.uniform')],
    hides: [{ targetSlotId: 'source.layer.10', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'head.traveler',
    name: '旅行素面头',
    category: 'head',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.head'],
    requiresSlots: ['source.layer.10'],
    parts: [clonePart(partBySlot(travelerSourceItem, 'source.layer.10'), 'mod.head.traveler')],
    hides: [{ targetSlotId: 'source.layer.10', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'head.original',
    name: '原始人物短发',
    category: 'head',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.head'],
    requiresSlots: ['source.layer.10'],
    parts: [clonePart(partBySlot(origSourceItem, 'source.layer.10'), 'mod.head.orig', 'hair_original')],
    hides: [{ targetSlotId: 'source.layer.10', regionIds: ['*'] }],
    extensionIds: [],
  },

  // PONYTAIL & MODULAR HAIR (slot.ponytail)
  {
    id: 'tail.both',
    name: 'miku 双马尾',
    category: 'ponytail',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.ponytail'],
    requiresSlots: [],
    parts: [
      clonePart(partBySlot(ttSourceItem, 'teal.tail.back.0'), 'mod.tail.back.0', 'hair_back'),
      clonePart(partBySlot(ttSourceItem, 'teal.tail.back.1'), 'mod.tail.back.1', 'hair_back'),
      clonePart(partBySlot(ttSourceItem, 'teal.tail.back.2'), 'mod.tail.back.2', 'hair_back'),
      clonePart(partBySlot(ttSourceItem, 'teal.tail.front.0'), 'mod.tail.front.0', 'hair_front'),
      clonePart(partBySlot(ttSourceItem, 'teal.tail.front.1'), 'mod.tail.front.1', 'hair_front'),
      clonePart(partBySlot(ttSourceItem, 'teal.tail.front.2'), 'mod.tail.front.2', 'hair_front'),
    ],
    hides: [],
    extensionIds: [],
  },
  {
    id: 'tail.back',
    name: 'miku 单后马尾',
    category: 'ponytail',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.ponytail'],
    requiresSlots: [],
    parts: [
      clonePart(partBySlot(ttSourceItem, 'teal.tail.back.0'), 'mod.tail.single.0', 'hair_back'),
      clonePart(partBySlot(ttSourceItem, 'teal.tail.back.1'), 'mod.tail.single.1', 'hair_back'),
      clonePart(partBySlot(ttSourceItem, 'teal.tail.back.2'), 'mod.tail.single.2', 'hair_back'),
    ],
    hides: [],
    extensionIds: [],
  },
  {
    id: 'tail.teto',
    name: 'Teto 双螺旋钻',
    category: 'ponytail',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.ponytail'],
    requiresSlots: [],
    parts: [
      clonePart(partBySlot(tetoSourceItem, 'teto.drill.back'), 'mod.tail.teto.back', 'hair_teto'),
      clonePart(partBySlot(tetoSourceItem, 'teto.drill.front'), 'mod.tail.teto.front', 'hair_teto'),
    ],
    hides: [],
    extensionIds: [],
  },
  cloneWardrobeHairItem(hairShortItem),
  cloneWardrobeHairItem(hairBobItem),
  cloneWardrobeHairItem(hairPonytailItem),
  cloneWardrobeHairItem(hairLongItem),

  // TORSO (slot.torso)
  {
    id: 'torso.teal',
    name: 'miku 水手领上装',
    category: 'torso',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.torso'],
    requiresSlots: ['source.layer.8'],
    parts: [clonePart(partBySlot(ttSourceItem, 'source.layer.8'), 'mod.torso.teal', 'garment_teal')],
    hides: [{ targetSlotId: 'source.layer.8', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'torso.teto',
    name: 'Teto 灰红制服上衣',
    category: 'torso',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.torso'],
    requiresSlots: ['source.layer.8'],
    parts: [clonePart(partBySlot(tetoSourceItem, 'source.layer.8'), 'mod.torso.teto', 'garment_teto')],
    hides: [{ targetSlotId: 'source.layer.8', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'torso.doubao',
    name: '豆包炭灰短袖',
    category: 'torso',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.torso'],
    requiresSlots: ['source.layer.8'],
    parts: [clonePart(partBySlot(doubaoSourceItem, 'source.layer.8'), 'mod.torso.doubao', 'garment_doubao')],
    hides: [{ targetSlotId: 'source.layer.8', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'torso.naiwa',
    name: '奶蛙圆肚上装',
    category: 'torso',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.torso'],
    requiresSlots: ['source.layer.8'],
    parts: [clonePart(partBySlot(naiSourceItem, 'source.layer.8'), 'mod.torso.naiwa', 'garment_naiwa')],
    hides: [{ targetSlotId: 'source.layer.8', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'torso.copper',
    name: '暮铜游侠胸甲',
    category: 'torso',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.torso'],
    requiresSlots: ['source.layer.8'],
    parts: [clonePart(partBySlot(copSourceItem, 'source.layer.8'), 'mod.torso.copper', 'garment_copper')],
    hides: [{ targetSlotId: 'source.layer.8', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'torso.hoodie',
    name: '日常卫衣上装',
    category: 'torso',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.torso'],
    requiresSlots: ['source.layer.8'],
    parts: [clonePart(partBySlot(hoodieSourceItem, 'source.layer.8'), 'mod.torso.hoodie', 'garment_hoodie')],
    hides: [{ targetSlotId: 'source.layer.8', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'torso.uniform',
    name: '学院制服上衣',
    category: 'torso',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.torso'],
    requiresSlots: ['source.layer.8'],
    parts: [clonePart(partBySlot(uniformSourceItem, 'source.layer.8'), 'mod.torso.uniform', 'garment_uniform')],
    hides: [{ targetSlotId: 'source.layer.8', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'torso.traveler',
    name: '旅行夹克上衣',
    category: 'torso',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.torso'],
    requiresSlots: ['source.layer.8'],
    parts: [clonePart(partBySlot(travelerSourceItem, 'source.layer.8'), 'mod.torso.traveler', 'garment_traveler')],
    hides: [{ targetSlotId: 'source.layer.8', regionIds: ['*'] }],
    extensionIds: [],
  },
  {
    id: 'torso.original',
    name: '原始人物轻甲',
    category: 'torso',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.torso'],
    requiresSlots: ['source.layer.8'],
    parts: [clonePart(partBySlot(origSourceItem, 'source.layer.8'), 'mod.torso.orig', 'garment_original')],
    hides: [{ targetSlotId: 'source.layer.8', regionIds: ['*'] }],
    extensionIds: [],
  },

  // WAIST (slot.waist)
  {
    id: 'waist.skirt',
    name: 'miku 百褶短裙',
    category: 'waist',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.waist'],
    requiresSlots: [],
    parts: [clonePart(partBySlot(ttSourceItem, 'teal.skirt.0'), 'mod.waist.skirt', 'garment_teal')],
    hides: [],
    extensionIds: [],
  },
  {
    id: 'waist.teto',
    name: 'Teto 灰红百褶裙',
    category: 'waist',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.waist'],
    requiresSlots: [],
    parts: [clonePart(partBySlot(tetoSourceItem, 'teto.skirt'), 'mod.waist.teto', 'garment_teto')],
    hides: [],
    extensionIds: [],
  },

  // ARMS (slot.arms)
  {
    id: 'arms.teal',
    name: 'miku 白袖护腕',
    category: 'arms',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.arms'],
    requiresSlots: ['source.layer.7', 'source.layer.9'],
    parts: [
      clonePart(partBySlot(ttSourceItem, 'source.layer.7'), 'mod.arms.teal.l', 'garment_teal'),
      clonePart(partBySlot(ttSourceItem, 'source.layer.9'), 'mod.arms.teal.r', 'garment_teal'),
    ],
    hides: [
      { targetSlotId: 'source.layer.7', regionIds: ['*'] },
      { targetSlotId: 'source.layer.9', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'arms.teto',
    name: 'Teto 红黑军袖',
    category: 'arms',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.arms'],
    requiresSlots: ['source.layer.7', 'source.layer.9'],
    parts: [
      clonePart(partBySlot(tetoSourceItem, 'source.layer.7'), 'mod.arms.teto.l', 'garment_teto'),
      clonePart(partBySlot(tetoSourceItem, 'source.layer.9'), 'mod.arms.teto.r', 'garment_teto'),
    ],
    hides: [
      { targetSlotId: 'source.layer.7', regionIds: ['*'] },
      { targetSlotId: 'source.layer.9', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'arms.doubao',
    name: '豆包休闲短袖',
    category: 'arms',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.arms'],
    requiresSlots: ['source.layer.7', 'source.layer.9'],
    parts: [
      clonePart(partBySlot(doubaoSourceItem, 'source.layer.7'), 'mod.arms.doubao.l', 'garment_doubao'),
      clonePart(partBySlot(doubaoSourceItem, 'source.layer.9'), 'mod.arms.doubao.r', 'garment_doubao'),
    ],
    hides: [
      { targetSlotId: 'source.layer.7', regionIds: ['*'] },
      { targetSlotId: 'source.layer.9', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'arms.naiwa',
    name: '奶蛙短手',
    category: 'arms',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.arms'],
    requiresSlots: ['source.layer.7', 'source.layer.9'],
    parts: [
      clonePart(partBySlot(naiSourceItem, 'source.layer.7'), 'mod.arms.naiwa.l', 'garment_naiwa'),
      clonePart(partBySlot(naiSourceItem, 'source.layer.9'), 'mod.arms.naiwa.r', 'garment_naiwa'),
    ],
    hides: [
      { targetSlotId: 'source.layer.7', regionIds: ['*'] },
      { targetSlotId: 'source.layer.9', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'arms.copper',
    name: '暮铜合金臂甲',
    category: 'arms',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.arms'],
    requiresSlots: ['source.layer.7', 'source.layer.9'],
    parts: [
      clonePart(partBySlot(copSourceItem, 'source.layer.7'), 'mod.arms.copper.l', 'garment_copper'),
      clonePart(partBySlot(copSourceItem, 'source.layer.9'), 'mod.arms.copper.r', 'garment_copper'),
    ],
    hides: [
      { targetSlotId: 'source.layer.7', regionIds: ['*'] },
      { targetSlotId: 'source.layer.9', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'arms.hoodie',
    name: '日常卫衣袖',
    category: 'arms',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.arms'],
    requiresSlots: ['source.layer.7', 'source.layer.9'],
    parts: [
      clonePart(partBySlot(hoodieSourceItem, 'source.layer.7'), 'mod.arms.hoodie.l', 'garment_hoodie'),
      clonePart(partBySlot(hoodieSourceItem, 'source.layer.9'), 'mod.arms.hoodie.r', 'garment_hoodie'),
    ],
    hides: [
      { targetSlotId: 'source.layer.7', regionIds: ['*'] },
      { targetSlotId: 'source.layer.9', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'arms.uniform',
    name: '学院衬衫袖',
    category: 'arms',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.arms'],
    requiresSlots: ['source.layer.7', 'source.layer.9'],
    parts: [
      clonePart(partBySlot(uniformSourceItem, 'source.layer.7'), 'mod.arms.uniform.l', 'garment_uniform'),
      clonePart(partBySlot(uniformSourceItem, 'source.layer.9'), 'mod.arms.uniform.r', 'garment_uniform'),
    ],
    hides: [
      { targetSlotId: 'source.layer.7', regionIds: ['*'] },
      { targetSlotId: 'source.layer.9', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'arms.traveler',
    name: '旅行夹克袖',
    category: 'arms',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.arms'],
    requiresSlots: ['source.layer.7', 'source.layer.9'],
    parts: [
      clonePart(partBySlot(travelerSourceItem, 'source.layer.7'), 'mod.arms.traveler.l', 'garment_traveler'),
      clonePart(partBySlot(travelerSourceItem, 'source.layer.9'), 'mod.arms.traveler.r', 'garment_traveler'),
    ],
    hides: [
      { targetSlotId: 'source.layer.7', regionIds: ['*'] },
      { targetSlotId: 'source.layer.9', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'arms.original',
    name: '原始皮革护腕',
    category: 'arms',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.arms'],
    requiresSlots: ['source.layer.7', 'source.layer.9'],
    parts: [
      clonePart(partBySlot(origSourceItem, 'source.layer.7'), 'mod.arms.orig.l', 'garment_original'),
      clonePart(partBySlot(origSourceItem, 'source.layer.9'), 'mod.arms.orig.r', 'garment_original'),
    ],
    hides: [
      { targetSlotId: 'source.layer.7', regionIds: ['*'] },
      { targetSlotId: 'source.layer.9', regionIds: ['*'] },
    ],
    extensionIds: [],
  },

  // LEGS (slot.legs)
  {
    id: 'legs.teal',
    name: 'miku 长袜短靴',
    category: 'legs',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.legs'],
    requiresSlots: ['source.layer.3', 'source.layer.4'],
    parts: [
      clonePart(partBySlot(ttSourceItem, 'source.layer.3'), 'mod.legs.teal.l', 'garment_teal'),
      clonePart(partBySlot(ttSourceItem, 'source.layer.4'), 'mod.legs.teal.r', 'garment_teal'),
    ],
    hides: [
      { targetSlotId: 'source.layer.3', regionIds: ['*'] },
      { targetSlotId: 'source.layer.4', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'legs.teto',
    name: 'Teto 绑带战靴',
    category: 'legs',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.legs'],
    requiresSlots: ['source.layer.3', 'source.layer.4'],
    parts: [
      clonePart(partBySlot(tetoSourceItem, 'source.layer.3'), 'mod.legs.teto.l', 'garment_teto'),
      clonePart(partBySlot(tetoSourceItem, 'source.layer.4'), 'mod.legs.teto.r', 'garment_teto'),
    ],
    hides: [
      { targetSlotId: 'source.layer.3', regionIds: ['*'] },
      { targetSlotId: 'source.layer.4', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'legs.doubao',
    name: '豆包阔腿白鞋',
    category: 'legs',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.legs'],
    requiresSlots: ['source.layer.3', 'source.layer.4'],
    parts: [
      clonePart(partBySlot(doubaoSourceItem, 'source.layer.3'), 'mod.legs.doubao.l', 'garment_doubao'),
      clonePart(partBySlot(doubaoSourceItem, 'source.layer.4'), 'mod.legs.doubao.r', 'garment_doubao'),
    ],
    hides: [
      { targetSlotId: 'source.layer.3', regionIds: ['*'] },
      { targetSlotId: 'source.layer.4', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'legs.naiwa',
    name: '奶蛙短足',
    category: 'legs',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.legs'],
    requiresSlots: ['source.layer.3', 'source.layer.4'],
    parts: [
      clonePart(partBySlot(naiSourceItem, 'source.layer.3'), 'mod.legs.naiwa.l', 'garment_naiwa'),
      clonePart(partBySlot(naiSourceItem, 'source.layer.4'), 'mod.legs.naiwa.r', 'garment_naiwa'),
    ],
    hides: [
      { targetSlotId: 'source.layer.3', regionIds: ['*'] },
      { targetSlotId: 'source.layer.4', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'legs.copper',
    name: '暮铜重装战靴',
    category: 'legs',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.legs'],
    requiresSlots: ['source.layer.3', 'source.layer.4'],
    parts: [
      clonePart(partBySlot(copSourceItem, 'source.layer.3'), 'mod.legs.copper.l', 'garment_copper'),
      clonePart(partBySlot(copSourceItem, 'source.layer.4'), 'mod.legs.copper.r', 'garment_copper'),
    ],
    hides: [
      { targetSlotId: 'source.layer.3', regionIds: ['*'] },
      { targetSlotId: 'source.layer.4', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'legs.hoodie',
    name: '卫衣运动裤鞋',
    category: 'legs',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.legs'],
    requiresSlots: ['source.layer.3', 'source.layer.4'],
    parts: [
      clonePart(partBySlot(hoodieSourceItem, 'source.layer.3'), 'mod.legs.hoodie.l', 'garment_hoodie'),
      clonePart(partBySlot(hoodieSourceItem, 'source.layer.4'), 'mod.legs.hoodie.r', 'garment_hoodie'),
    ],
    hides: [
      { targetSlotId: 'source.layer.3', regionIds: ['*'] },
      { targetSlotId: 'source.layer.4', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'legs.uniform',
    name: '学院长裤皮鞋',
    category: 'legs',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.legs'],
    requiresSlots: ['source.layer.3', 'source.layer.4'],
    parts: [
      clonePart(partBySlot(uniformSourceItem, 'source.layer.3'), 'mod.legs.uniform.l', 'garment_uniform'),
      clonePart(partBySlot(uniformSourceItem, 'source.layer.4'), 'mod.legs.uniform.r', 'garment_uniform'),
    ],
    hides: [
      { targetSlotId: 'source.layer.3', regionIds: ['*'] },
      { targetSlotId: 'source.layer.4', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'legs.traveler',
    name: '旅行工装短靴',
    category: 'legs',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.legs'],
    requiresSlots: ['source.layer.3', 'source.layer.4'],
    parts: [
      clonePart(partBySlot(travelerSourceItem, 'source.layer.3'), 'mod.legs.traveler.l', 'garment_traveler'),
      clonePart(partBySlot(travelerSourceItem, 'source.layer.4'), 'mod.legs.traveler.r', 'garment_traveler'),
    ],
    hides: [
      { targetSlotId: 'source.layer.3', regionIds: ['*'] },
      { targetSlotId: 'source.layer.4', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
  {
    id: 'legs.original',
    name: '原始行军皮靴',
    category: 'legs',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.legs'],
    requiresSlots: ['source.layer.3', 'source.layer.4'],
    parts: [
      clonePart(partBySlot(origSourceItem, 'source.layer.3'), 'mod.legs.orig.l', 'garment_original'),
      clonePart(partBySlot(origSourceItem, 'source.layer.4'), 'mod.legs.orig.r', 'garment_original'),
    ],
    hides: [
      { targetSlotId: 'source.layer.3', regionIds: ['*'] },
      { targetSlotId: 'source.layer.4', regionIds: ['*'] },
    ],
    extensionIds: [],
  },

  // SCARF ADD-ON (slot.scarf)
  {
    id: 'scarf.doubao',
    name: '豆包针织红围巾',
    category: 'scarf',
    rigId: project.rig.id,
    supportedFitProfiles: [fitProfile],
    occupies: ['slot.scarf'],
    requiresSlots: [],
    parts: [
      clonePart(partBySlot(doubaoSourceItem, 'doubao.scarf.back'), 'mod.scarf.doubao.back', 'scarf_doubao'),
      clonePart(partBySlot(doubaoSourceItem, 'doubao.scarf.front'), 'mod.scarf.doubao.front', 'scarf_doubao'),
    ],
    hides: [
      { targetSlotId: 'source.layer.5', regionIds: ['*'] },
      { targetSlotId: 'source.layer.6', regionIds: ['*'] },
    ],
    extensionIds: [],
  },
]

project.items = modularItems

const HIDDEN_WEAPONS = ['source.layer.11', 'source.layer.12']
const makePalettes = (hairDye, garmentDye, scarfDye) => ({
  hair_head: `hair_head.${hairDye}`,
  hair_back: `hair_back.${hairDye}`,
  hair_front: `hair_front.${hairDye}`,
  hair_copper: `hair_copper.${hairDye}`,
  hair_naiwa: `hair_naiwa.${hairDye}`,
  hair_original: `hair_original.${hairDye}`,
  hair_teto: `hair_teto.${hairDye}`,
  hair_doubao: `hair_doubao.${hairDye}`,
  hair: `hair.${hairDye}`,
  garment_teal: `garment_teal.${garmentDye}`,
  garment_copper: `garment_copper.${garmentDye}`,
  garment_naiwa: `garment_naiwa.${garmentDye}`,
  garment_original: `garment_original.${garmentDye}`,
  garment_teto: `garment_teto.${garmentDye}`,
  garment_doubao: `garment_doubao.${garmentDye}`,
  garment_hoodie: `garment_hoodie.${garmentDye}`,
  garment_uniform: `garment_uniform.${garmentDye}`,
  garment_traveler: `garment_traveler.${garmentDye}`,
  scarf: `scarf.${scarfDye}`,
  scarf_doubao: `scarf_doubao.${scarfDye}`,
})

const presets = [
  {
    id: 'look.teal',
    name: 'miku',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.teal', 'tail.both', 'torso.teal', 'waist.skirt', 'arms.teal', 'legs.teal'],
      palettes: makePalettes('teal', 'classic', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', 'source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.teto',
    name: 'Teto · 灰红制服',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.teto', 'tail.teto', 'torso.teto', 'waist.teto', 'arms.teto', 'legs.teto'],
      palettes: makePalettes('original', 'classic', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', 'source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.doubao',
    name: '豆包 · 红围巾',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.doubao', 'torso.doubao', 'arms.doubao', 'legs.doubao', 'scarf.doubao'],
      palettes: makePalettes('original', 'classic', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', 'source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.naiwa',
    name: '奶蛙',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.naiwa', 'torso.naiwa', 'arms.naiwa', 'legs.naiwa'],
      palettes: makePalettes('original', 'classic', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', 'source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.hoodie',
    name: '日常卫衣',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.hoodie', 'wardrobe.hair.short', 'torso.hoodie', 'arms.hoodie', 'legs.hoodie'],
      palettes: makePalettes('brown', 'classic', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', 'source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.uniform',
    name: '学院制服',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.uniform', 'wardrobe.hair.bob', 'torso.uniform', 'arms.uniform', 'legs.uniform'],
      palettes: makePalettes('brown', 'classic', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', 'source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.traveler',
    name: '旅行夹克',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.traveler', 'wardrobe.hair.ponytail', 'torso.traveler', 'arms.traveler', 'legs.traveler'],
      palettes: makePalettes('brown', 'classic', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', 'source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.copper',
    name: '暮铜游侠',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.copper', 'torso.copper', 'arms.copper', 'legs.copper'],
      palettes: makePalettes('original', 'classic', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', 'source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.original',
    name: '原始人物',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.original', 'torso.original', 'arms.original', 'legs.original'],
      palettes: makePalettes('original', 'classic', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', 'source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.redscarf',
    name: '流风红巾旅者',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.teal', 'tail.back', 'torso.original', 'arms.original', 'legs.original'],
      palettes: makePalettes('silver', 'obsidian', 'crimson'),
      faceOptions: {},
      hiddenSlotIds: [...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.starlight',
    name: '星夜学徒',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.teal', 'tail.both', 'torso.teal', 'waist.skirt', 'arms.copper', 'legs.teal'],
      palettes: makePalettes('violet', 'navy', 'azure'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.6', ...HIDDEN_WEAPONS],
    },
  },
  {
    id: 'look.aurora',
    name: '极光巡林客',
    appearance: {
      bodyId: body.id,
      equippedItemIds: ['head.copper', 'tail.back', 'torso.copper', 'arms.teal', 'legs.copper'],
      palettes: makePalettes('amber', 'emerald', 'gold'),
      faceOptions: {},
      hiddenSlotIds: ['source.layer.5', ...HIDDEN_WEAPONS],
    },
  },
]

project.presets = presets
project.defaultAppearance = structuredClone(presets[0].appearance)

// 8. Validate and compile!
validateProject(project)
const compiled = compileProject(project)
const packBytes = writeRuntimePack(compiled)
fs.writeFileSync(OUT_PATH, packBytes)

// Verify every preset and weapon suppression
const verifyPack = readRuntimePack(new Uint8Array(fs.readFileSync(OUT_PATH)))
const actor = new Character({ pack: verifyPack })
for (const preset of verifyPack.project.presets) {
  validateAppearance(verifyPack.project, preset.appearance)
  await actor.setAppearance(preset.appearance)
  for (const clipId of ['idle', 'walk', 'run', 'jump', 'fall', 'combo_1']) {
    actor.playBase(clipId)
    const pose = actor.evaluate()
    const weaponDraws = pose.draws.filter(
      (d) => d.slotId === 'source.layer.11' || d.slotId === 'source.layer.12',
    )
    if (weaponDraws.length > 0) {
      throw new Error(`Weapon leaked in ${preset.id}/${clipId}: ${weaponDraws.map((d) => d.slotId)}`)
    }
  }
}

console.log(
  JSON.stringify(
    {
      output: OUT_PATH,
      sizeBytes: packBytes.byteLength,
      atlas: `${verifyPack.atlas.width}x${verifyPack.atlas.height}`,
      sprites: verifyPack.project.sprites.length,
      items: verifyPack.project.items.length,
      palettes: verifyPack.project.palettes.length,
      presets: verifyPack.project.presets.map((p) => p.id),
      weaponSuppressed: true,
    },
    null,
    2,
  ),
)
