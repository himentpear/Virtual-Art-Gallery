import { ColorMatrixFilter, Container, Graphics, Sprite, Texture } from 'pixi.js'
import {
  Character,
  createCharacter,
  PixiCharacterView,
  readRuntimePack,
} from '@pixelsyn/runtime-pixi'
import type { CompiledPack, Appearance } from '@pixelsyn/schema'
import {
  BENCH_OBSTACLES,
  ENTRANCE_GATE_OBSTACLE,
  ENTRANCE_PILLAR_OBSTACLES,
  STANCHION_OBSTACLES,
  WALK_MAX_X,
  WALK_MAX_Y,
  WALK_MIN_X,
  WALK_MIN_Y,
} from '../scene/GalleryScene'
import type {
  BackgearId,
  BadgePropId,
  CharacterLightSample,
  HeadwearId,
  HeroTelemetry,
  WardrobeSelection,
} from '../types'

const STORAGE_KEY = 'hall.wardrobe.v2'

export type VisualAccessoryId = HeadwearId | BackgearId | BadgePropId

interface AccessorySpec {
  width: number
  height: number
  anchorY: number
  offsetX: number
  offsetY: number
  floating?: boolean
  flutter?: boolean
  additiveTint?: boolean
  draw: (ctx: CanvasRenderingContext2D) => void
}

const pxAcc = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) => {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

const ACCESSORY_SPECS: Record<Exclude<VisualAccessoryId, 'none'>, AccessorySpec> = {
  halo_star: {
    width: 22,
    height: 10,
    anchorY: -57,
    offsetX: 0,
    offsetY: 0,
    floating: true,
    draw: (ctx) => {
      // Elliptical radiant gold-and-cyan astral halo with corner star sparkles
      pxAcc(ctx, 5, 2, 12, 1, '#ffd984')
      pxAcc(ctx, 3, 3, 2, 1, '#fff3bf')
      pxAcc(ctx, 17, 3, 2, 1, '#fff3bf')
      pxAcc(ctx, 2, 4, 2, 2, '#eab85a')
      pxAcc(ctx, 18, 4, 2, 2, '#eab85a')
      pxAcc(ctx, 3, 6, 2, 1, '#ffd984')
      pxAcc(ctx, 17, 6, 2, 1, '#ffd984')
      pxAcc(ctx, 5, 7, 12, 1, '#fff1b8')
      pxAcc(ctx, 7, 7, 8, 1, '#a6f4ff')
      // Center top & side starlight glints
      pxAcc(ctx, 10, 0, 2, 2, '#fff9dc')
      pxAcc(ctx, 9, 1, 4, 1, '#84e8ff')
      pxAcc(ctx, 0, 4, 2, 1, '#a6f4ff')
      pxAcc(ctx, 20, 4, 2, 1, '#a6f4ff')
    },
  },
  crown_laurel: {
    width: 18,
    height: 8,
    anchorY: -50,
    offsetX: 0,
    offsetY: 0,
    draw: (ctx) => {
      // Golden museum laurel wreath
      pxAcc(ctx, 2, 3, 2, 3, '#c8963e')
      pxAcc(ctx, 3, 1, 2, 3, '#f2ca6b')
      pxAcc(ctx, 5, 0, 2, 2, '#fff0b2')
      pxAcc(ctx, 4, 5, 3, 2, '#e3b352')
      pxAcc(ctx, 7, 5, 4, 1, '#8f692a')
      pxAcc(ctx, 8, 4, 2, 2, '#9ceeff')
      pxAcc(ctx, 11, 5, 3, 2, '#e3b352')
      pxAcc(ctx, 11, 0, 2, 2, '#fff0b2')
      pxAcc(ctx, 13, 1, 2, 3, '#f2ca6b')
      pxAcc(ctx, 14, 3, 2, 3, '#c8963e')
    },
  },
  beret_artist: {
    width: 18,
    height: 9,
    anchorY: -52,
    offsetX: 1,
    offsetY: 0,
    draw: (ctx) => {
      // Painter's burgundy-velvet beret + brass emblem pin
      pxAcc(ctx, 4, 0, 9, 1, '#c94c68')
      pxAcc(ctx, 2, 1, 13, 2, '#b03954')
      pxAcc(ctx, 1, 3, 15, 3, '#8f2840')
      pxAcc(ctx, 4, 2, 6, 1, '#e66c86')
      pxAcc(ctx, 3, 6, 12, 2, '#241a24')
      pxAcc(ctx, 11, 3, 2, 2, '#f5d27a')
      pxAcc(ctx, 7, 0, 2, 1, '#681c2e')
    },
  },
  visor_holo: {
    width: 14,
    height: 6,
    anchorY: -42,
    offsetX: 2,
    offsetY: 0,
    draw: (ctx) => {
      // Translucent neon-cyan holographic eyewear
      pxAcc(ctx, 1, 1, 2, 3, '#2d374a')
      pxAcc(ctx, 3, 1, 9, 3, 'rgba(72, 224, 255, 0.78)')
      pxAcc(ctx, 4, 1, 7, 1, '#e0fcff')
      pxAcc(ctx, 5, 2, 4, 1, '#9cf4ff')
      pxAcc(ctx, 12, 1, 1, 3, '#5ae8ff')
    },
  },
  wings_astral: {
    width: 34,
    height: 20,
    anchorY: -34,
    offsetX: -3,
    offsetY: 0,
    draw: (ctx) => {
      // Symmetrical luminous pixel wings rendered behind character
      // Left wing
      pxAcc(ctx, 1, 2, 6, 3, 'rgba(130, 232, 255, 0.85)')
      pxAcc(ctx, 3, 1, 4, 2, '#f7d686')
      pxAcc(ctx, 2, 5, 8, 4, 'rgba(92, 198, 250, 0.78)')
      pxAcc(ctx, 4, 9, 8, 4, 'rgba(74, 168, 236, 0.7)')
      pxAcc(ctx, 6, 13, 7, 3, 'rgba(154, 238, 255, 0.55)')
      pxAcc(ctx, 10, 6, 4, 8, '#dff9ff')
      // Right wing
      pxAcc(ctx, 27, 2, 6, 3, 'rgba(130, 232, 255, 0.85)')
      pxAcc(ctx, 27, 1, 4, 2, '#f7d686')
      pxAcc(ctx, 24, 5, 8, 4, 'rgba(92, 198, 250, 0.78)')
      pxAcc(ctx, 22, 9, 8, 4, 'rgba(74, 168, 236, 0.7)')
      pxAcc(ctx, 21, 13, 7, 3, 'rgba(154, 238, 255, 0.55)')
      pxAcc(ctx, 20, 6, 4, 8, '#dff9ff')
      // Center bridge rune
      pxAcc(ctx, 14, 7, 6, 4, 'rgba(255, 220, 140, 0.85)')
    },
  },
  cape_royal: {
    width: 22,
    height: 24,
    anchorY: -22,
    offsetX: -4,
    offsetY: 0,
    draw: (ctx) => {
      // Draped navy velvet cloak with crimson lining & gold trim
      pxAcc(ctx, 5, 0, 12, 3, '#b88e46')
      pxAcc(ctx, 4, 2, 14, 6, '#23355c')
      pxAcc(ctx, 3, 8, 16, 8, '#1b2b4d')
      pxAcc(ctx, 2, 16, 18, 6, '#15223e')
      // Crimson inner folds & gold hem
      pxAcc(ctx, 5, 5, 2, 16, '#8f2d47')
      pxAcc(ctx, 15, 5, 2, 16, '#8f2d47')
      pxAcc(ctx, 3, 21, 16, 2, '#d8ae5e')
      pxAcc(ctx, 7, 9, 8, 11, '#2a3f6e')
    },
  },
  lantern_float: {
    width: 11,
    height: 15,
    anchorY: -42,
    offsetX: -16,
    offsetY: 0,
    floating: true,
    draw: (ctx) => {
      // Floating antique brass & amber sanctuary lantern
      pxAcc(ctx, 4, 0, 3, 2, '#a88040')
      pxAcc(ctx, 2, 2, 7, 2, '#3a2d24')
      pxAcc(ctx, 3, 2, 5, 1, '#d8ac5e')
      pxAcc(ctx, 2, 4, 7, 7, 'rgba(255, 188, 92, 0.42)')
      pxAcc(ctx, 3, 4, 5, 7, '#ffcf74')
      pxAcc(ctx, 4, 5, 3, 5, '#fff6cc')
      pxAcc(ctx, 2, 11, 7, 2, '#3a2d24')
      pxAcc(ctx, 4, 13, 3, 2, '#b88c48')
    },
  },
  butterfly_star: {
    width: 14,
    height: 12,
    anchorY: -47,
    offsetX: -15,
    offsetY: 0,
    floating: true,
    flutter: true,
    draw: (ctx) => {
      // Glowing cyan-and-gold astral companion butterfly
      pxAcc(ctx, 6, 3, 2, 6, '#ffe6a3')
      // Left wings
      pxAcc(ctx, 1, 1, 5, 5, '#7de6ff')
      pxAcc(ctx, 2, 2, 3, 3, '#dffaff')
      pxAcc(ctx, 0, 2, 2, 2, '#ffd87e')
      pxAcc(ctx, 2, 6, 4, 4, '#49b8e8')
      pxAcc(ctx, 3, 7, 2, 2, '#ffe092')
      // Right wings
      pxAcc(ctx, 8, 1, 5, 5, '#7de6ff')
      pxAcc(ctx, 9, 2, 3, 3, '#dffaff')
      pxAcc(ctx, 12, 2, 2, 2, '#ffd87e')
      pxAcc(ctx, 8, 6, 4, 4, '#49b8e8')
      pxAcc(ctx, 9, 7, 2, 2, '#ffe092')
    },
  },
  badge_vip: {
    width: 10,
    height: 11,
    anchorY: -29,
    offsetX: 4,
    offsetY: 0,
    draw: (ctx) => {
      // Illuminated golden gallery VIP crest pinned on chest
      pxAcc(ctx, 2, 0, 6, 2, '#4cc4f0')
      pxAcc(ctx, 3, 1, 4, 1, '#a6f0ff')
      pxAcc(ctx, 1, 2, 8, 7, '#d9a446')
      pxAcc(ctx, 2, 3, 6, 5, '#ffe594')
      pxAcc(ctx, 4, 4, 2, 3, '#ffffff')
      pxAcc(ctx, 3, 9, 4, 2, '#8a5c22')
    },
  },
  scroll_guide: {
    width: 11,
    height: 9,
    anchorY: -19,
    offsetX: -6,
    offsetY: 0,
    draw: (ctx) => {
      // Rolled museum curatorial parchment tied at waist
      pxAcc(ctx, 0, 2, 2, 5, '#b8a88a')
      pxAcc(ctx, 2, 1, 7, 6, '#efe4cb')
      pxAcc(ctx, 3, 2, 5, 2, '#fff9ec')
      pxAcc(ctx, 9, 2, 2, 5, '#9f8f72')
      pxAcc(ctx, 5, 1, 2, 6, '#c93c58')
      pxAcc(ctx, 5, 7, 3, 2, '#f2c86c')
    },
  },
  rose_brooch: {
    width: 10,
    height: 9,
    anchorY: -31,
    offsetX: 3,
    offsetY: 0,
    draw: (ctx) => {
      // Crimson rose lapel brooch with emerald leaf & gold drop
      pxAcc(ctx, 1, 4, 3, 3, '#3b8c52')
      pxAcc(ctx, 6, 4, 3, 3, '#2d7041')
      pxAcc(ctx, 2, 1, 6, 5, '#d63e5a')
      pxAcc(ctx, 3, 2, 4, 3, '#ff7d96')
      pxAcc(ctx, 4, 3, 2, 1, '#ffd4de')
      pxAcc(ctx, 4, 6, 2, 3, '#ecd08b')
    },
  },
}

const accessoryTextureCache = new Map<Exclude<VisualAccessoryId, 'none'>, Texture>()
const accessoryDataUrlCache = new Map<VisualAccessoryId, string>()

function renderAccessoryCanvas(id: Exclude<VisualAccessoryId, 'none'>): HTMLCanvasElement {
  const spec = ACCESSORY_SPECS[id]
  const canvas = document.createElement('canvas')
  canvas.width = spec.width
  canvas.height = spec.height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  spec.draw(ctx)
  return canvas
}

function getAccessoryTexture(id: VisualAccessoryId): Texture {
  if (id === 'none') return Texture.EMPTY
  let tex = accessoryTextureCache.get(id)
  if (!tex) {
    const canvas = renderAccessoryCanvas(id)
    tex = Texture.from(canvas)
    tex.source.style.scaleMode = 'nearest'
    accessoryTextureCache.set(id, tex)
  }
  return tex
}

export function getAccessoryIconDataUrl(id: VisualAccessoryId): string {
  const cached = accessoryDataUrlCache.get(id)
  if (cached) return cached
  if (id === 'none') {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 16
    const ctx = c.getContext('2d')!
    ctx.strokeStyle = 'rgba(180, 194, 220, 0.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(8, 8, 5, 0, Math.PI * 2)
    ctx.moveTo(4.5, 11.5)
    ctx.lineTo(11.5, 4.5)
    ctx.stroke()
    const url = c.toDataURL()
    accessoryDataUrlCache.set(id, url)
    return url
  }
  const src = renderAccessoryCanvas(id)
  const padded = document.createElement('canvas')
  const size = Math.max(src.width, src.height) + 4
  padded.width = size
  padded.height = size
  const ctx = padded.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, Math.floor((size - src.width) / 2), Math.floor((size - src.height) / 2))
  const url = padded.toDataURL()
  accessoryDataUrlCache.set(id, url)
  return url
}

export const DEFAULT_WARDROBE: WardrobeSelection = {
  head: 'head.teal',
  ponytail: 'tail.both',
  torso: 'torso.teal',
  waist: 'waist.skirt',
  arms: 'arms.teal',
  legs: 'legs.teal',
  scarfMode: 'none',
  hairDye: 'teal',
  garmentDye: 'classic',
  scarfDye: 'crimson',
  headwear: 'none',
  backgear: 'none',
  badge: 'none',
}

const VALID_HEADS = new Set([
  'head.teal',
  'head.teto',
  'head.doubao',
  'head.naiwa',
  'head.copper',
  'head.hoodie',
  'head.uniform',
  'head.traveler',
  'head.original',
])
const VALID_PONYTAILS = new Set([
  'none',
  'tail.both',
  'tail.back',
  'tail.teto',
  'wardrobe.hair.short',
  'wardrobe.hair.bob',
  'wardrobe.hair.ponytail',
  'wardrobe.hair.long',
])
const VALID_TORSOS = new Set([
  'torso.teal',
  'torso.teto',
  'torso.doubao',
  'torso.naiwa',
  'torso.copper',
  'torso.hoodie',
  'torso.uniform',
  'torso.traveler',
  'torso.original',
])
const VALID_WAISTS = new Set(['none', 'waist.skirt', 'waist.teto'])
const VALID_ARMS = new Set([
  'arms.teal',
  'arms.teto',
  'arms.doubao',
  'arms.naiwa',
  'arms.copper',
  'arms.hoodie',
  'arms.uniform',
  'arms.traveler',
  'arms.original',
])
const VALID_LEGS = new Set([
  'legs.teal',
  'legs.teto',
  'legs.doubao',
  'legs.naiwa',
  'legs.copper',
  'legs.hoodie',
  'legs.uniform',
  'legs.traveler',
  'legs.original',
])
const VALID_SCARVES = new Set(['none', 'doubao', 'both', 'front', 'back'])
const VALID_HAIR_DYES = new Set([
  'original',
  'teal',
  'brown',
  'black',
  'sakura',
  'violet',
  'amber',
  'silver',
  'crimson',
])
const VALID_GARMENT_DYES = new Set(['classic', 'navy', 'obsidian', 'emerald', 'wine'])
const VALID_SCARF_DYES = new Set(['crimson', 'ivory', 'azure', 'gold', 'shadow'])

export function buildAppearanceFromSelection(
  sel: WardrobeSelection,
  bodyId: string,
): Appearance {
  const equippedItemIds: string[] = [sel.head, sel.torso, sel.arms, sel.legs]
  if (sel.ponytail !== 'none') equippedItemIds.push(sel.ponytail)
  if (sel.waist !== 'none') equippedItemIds.push(sel.waist)
  if (sel.scarfMode === 'doubao') equippedItemIds.push('scarf.doubao')

  const hiddenSlotIds = ['source.layer.11', 'source.layer.12'] // Force-hide sword & slash FX
  if (sel.scarfMode === 'none' || sel.scarfMode === 'doubao') {
    hiddenSlotIds.push('source.layer.5', 'source.layer.6')
  } else if (sel.scarfMode === 'front') {
    hiddenSlotIds.push('source.layer.5')
  } else if (sel.scarfMode === 'back') {
    hiddenSlotIds.push('source.layer.6')
  }

  return {
    bodyId,
    equippedItemIds,
    palettes: {
      hair_head: `hair_head.${sel.hairDye}`,
      hair_back: `hair_back.${sel.hairDye}`,
      hair_front: `hair_front.${sel.hairDye}`,
      hair_copper: `hair_copper.${sel.hairDye}`,
      hair_naiwa: `hair_naiwa.${sel.hairDye}`,
      hair_original: `hair_original.${sel.hairDye}`,
      hair_teto: `hair_teto.${sel.hairDye}`,
      hair_doubao: `hair_doubao.${sel.hairDye}`,
      hair: `hair.${sel.hairDye}`,
      garment_teal: `garment_teal.${sel.garmentDye}`,
      garment_copper: `garment_copper.${sel.garmentDye}`,
      garment_naiwa: `garment_naiwa.${sel.garmentDye}`,
      garment_original: `garment_original.${sel.garmentDye}`,
      garment_teto: `garment_teto.${sel.garmentDye}`,
      garment_doubao: `garment_doubao.${sel.garmentDye}`,
      garment_hoodie: `garment_hoodie.${sel.garmentDye}`,
      garment_uniform: `garment_uniform.${sel.garmentDye}`,
      garment_traveler: `garment_traveler.${sel.garmentDye}`,
      scarf: `scarf.${sel.scarfDye}`,
      scarf_doubao: `scarf_doubao.${sel.scarfDye}`,
    },
    faceOptions: {},
    hiddenSlotIds,
  }
}

export function loadSavedWardrobe(): WardrobeSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULT_WARDROBE)
    const parsed = JSON.parse(raw) as Partial<WardrobeSelection>
    return {
      head: parsed.head && VALID_HEADS.has(parsed.head) ? parsed.head : DEFAULT_WARDROBE.head,
      ponytail:
        parsed.ponytail && VALID_PONYTAILS.has(parsed.ponytail)
          ? parsed.ponytail
          : DEFAULT_WARDROBE.ponytail,
      torso: parsed.torso && VALID_TORSOS.has(parsed.torso) ? parsed.torso : DEFAULT_WARDROBE.torso,
      waist: parsed.waist && VALID_WAISTS.has(parsed.waist) ? parsed.waist : DEFAULT_WARDROBE.waist,
      arms: parsed.arms && VALID_ARMS.has(parsed.arms) ? parsed.arms : DEFAULT_WARDROBE.arms,
      legs: parsed.legs && VALID_LEGS.has(parsed.legs) ? parsed.legs : DEFAULT_WARDROBE.legs,
      scarfMode:
        parsed.scarfMode && VALID_SCARVES.has(parsed.scarfMode)
          ? parsed.scarfMode
          : DEFAULT_WARDROBE.scarfMode,
      hairDye:
        parsed.hairDye && VALID_HAIR_DYES.has(parsed.hairDye)
          ? parsed.hairDye
          : DEFAULT_WARDROBE.hairDye,
      garmentDye:
        parsed.garmentDye && VALID_GARMENT_DYES.has(parsed.garmentDye)
          ? parsed.garmentDye
          : DEFAULT_WARDROBE.garmentDye,
      scarfDye:
        parsed.scarfDye && VALID_SCARF_DYES.has(parsed.scarfDye)
          ? parsed.scarfDye
          : DEFAULT_WARDROBE.scarfDye,
      headwear: parsed.headwear ?? DEFAULT_WARDROBE.headwear,
      backgear: parsed.backgear ?? DEFAULT_WARDROBE.backgear,
      badge: parsed.badge ?? DEFAULT_WARDROBE.badge,
    }
  } catch {
    return structuredClone(DEFAULT_WARDROBE)
  }
}

export function saveWardrobe(sel: WardrobeSelection): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sel))
  } catch {
    // ignore storage quota errors
  }
}

interface PuffParticle {
  gfx: Graphics
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
}

function createScatterGradientTexture(): Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const g = ctx.createRadialGradient(c, c, 0, c, c, c)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  g.addColorStop(0.18, 'rgba(255, 255, 255, 0.62)')
  g.addColorStop(0.42, 'rgba(255, 255, 255, 0.28)')
  g.addColorStop(0.7, 'rgba(255, 255, 255, 0.08)')
  g.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = Texture.from(canvas)
  tex.source.style.scaleMode = 'linear'
  return tex
}

export class HeroController {
  readonly pack: CompiledPack
  readonly actor: Character
  readonly mainView: PixiCharacterView
  readonly reflectionView: PixiCharacterView
  readonly primaryShadowView: PixiCharacterView
  readonly secondaryShadowView: PixiCharacterView
  readonly primaryBenchShadowView: PixiCharacterView
  readonly secondaryBenchShadowView: PixiCharacterView
  readonly characterRoot = new Container()
  readonly shadowRoot = new Container()
  readonly benchShadowRoot = new Container()
  readonly shadowGfx = new Graphics()
  readonly puffLayer = new Container()
  private readonly scatterTex: Texture
  private readonly rearScatterSprite: Sprite
  private readonly rearCoreSprite: Sprite
  private readonly groundScatterSprite: Sprite
  private readonly frontScatterSprite: Sprite
  private readonly backAccessorySprite: Sprite
  private readonly headAccessorySprite: Sprite
  private readonly badgeAccessorySprite: Sprite
  private readonly primaryShadowFilter = new ColorMatrixFilter()
  private readonly secondaryShadowFilter = new ColorMatrixFilter()
  private readonly primaryBenchShadowFilter = new ColorMatrixFilter()
  private readonly secondaryBenchShadowFilter = new ColorMatrixFilter()
  private lastBackLightIntensity = 0

  x = 1600
  floorY = 306
  jumpZ = 0
  jumpVz = 0
  facing: 'left' | 'right' = 'right'
  isGrounded = true
  isRunning = false
  alwaysRun = false
  controlsLocked = false

  private currentClip = 'idle'
  private transientTimerMs = 0
  private transientClip: string | null = null
  private fallElapsedMs = 0
  private wasRunning = false
  private dashDir: -1 | 1 = 1
  private puffs: PuffParticle[] = []
  private wardrobe: WardrobeSelection

  private keys = new Set<string>()
  private pendingJump = false
  private pendingDash = false
  private pendingSlide = false

  private constructor(pack: CompiledPack, actor: Character, wardrobe: WardrobeSelection) {
    this.pack = pack
    this.actor = actor
    this.wardrobe = wardrobe

    this.mainView = new PixiCharacterView(actor)
    this.mainView.scale.set(2)

    this.reflectionView = new PixiCharacterView(actor)
    this.reflectionView.scale.set(2, -2)
    this.reflectionView.tint = 0x99add9
    this.reflectionView.alpha = 0.34

    this.primaryShadowView = new PixiCharacterView(actor)
    this.primaryShadowView.filters = [this.primaryShadowFilter]

    this.secondaryShadowView = new PixiCharacterView(actor)
    this.secondaryShadowView.filters = [this.secondaryShadowFilter]

    this.shadowRoot.addChild(this.shadowGfx, this.secondaryShadowView, this.primaryShadowView)

    this.primaryBenchShadowView = new PixiCharacterView(actor)
    this.primaryBenchShadowView.filters = [this.primaryBenchShadowFilter]
    this.secondaryBenchShadowView = new PixiCharacterView(actor)
    this.secondaryBenchShadowView.filters = [this.secondaryBenchShadowFilter]
    this.benchShadowRoot.addChild(this.secondaryBenchShadowView, this.primaryBenchShadowView)
    this.benchShadowRoot.visible = false

    this.scatterTex = createScatterGradientTexture()
    this.rearScatterSprite = new Sprite(this.scatterTex)
    this.rearScatterSprite.anchor.set(0.5)
    this.rearScatterSprite.blendMode = 'add'

    this.rearCoreSprite = new Sprite(this.scatterTex)
    this.rearCoreSprite.anchor.set(0.5)
    this.rearCoreSprite.blendMode = 'add'

    this.groundScatterSprite = new Sprite(this.scatterTex)
    this.groundScatterSprite.anchor.set(0.5)
    this.groundScatterSprite.blendMode = 'add'

    this.frontScatterSprite = new Sprite(this.scatterTex)
    this.frontScatterSprite.anchor.set(0.5)
    this.frontScatterSprite.blendMode = 'add'

    this.backAccessorySprite = new Sprite(Texture.EMPTY)
    this.backAccessorySprite.anchor.set(0.5)
    this.headAccessorySprite = new Sprite(Texture.EMPTY)
    this.headAccessorySprite.anchor.set(0.5)
    this.badgeAccessorySprite = new Sprite(Texture.EMPTY)
    this.badgeAccessorySprite.anchor.set(0.5)

    this.characterRoot.addChild(
      this.groundScatterSprite,
      this.rearScatterSprite,
      this.rearCoreSprite,
      this.backAccessorySprite,
      this.mainView,
      this.badgeAccessorySprite,
      this.headAccessorySprite,
      this.frontScatterSprite,
    )
    this.refreshAccessoryTextures()
    this.actor.playBase('idle')
    this.actor.setFacing('right')
    this.syncViews({
      bodyTint: 0xd8e2f5,
      reflectionTint: 0x99add9,
      rimColor: 0x76c4ff,
      rimAlpha: 0.42,
      backLightIntensity: 0.52,
      backLightDirX: 0,
      shadowOffsetX: 0,
      shadowStretchY: 1.49,
      shadowSkewX: 0.05,
      shadowScaleY: 0.58,
      shadowAlpha: 0.41,
      secondaryShadowSkewX: -0.05,
      secondaryShadowScaleY: 0.63,
      secondaryShadowAlpha: 0.25,
    })
  }

  static async create(): Promise<HeroController> {
    const base = import.meta.env.BASE_URL || './'
    const url = `${base}characters/hall-wardrobe.pxpack`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`无法加载角色资源包 ${url} (HTTP ${response.status})`)
    }
    const bytes = new Uint8Array(await response.arrayBuffer())
    const pack = readRuntimePack(bytes)
    const wardrobe = loadSavedWardrobe()
    const bodyId = pack.project.bodies[0].id
    let appearance: Appearance
    try {
      appearance = buildAppearanceFromSelection(wardrobe, bodyId)
      const actor = await createCharacter({ pack, appearance })
      return new HeroController(pack, actor, wardrobe)
    } catch {
      const fallback = structuredClone(DEFAULT_WARDROBE)
      const actor = await createCharacter({
        pack,
        appearance: buildAppearanceFromSelection(fallback, bodyId),
      })
      return new HeroController(pack, actor, fallback)
    }
  }

  public getPack(): CompiledPack {
    return this.pack
  }

  public getWardrobe(): WardrobeSelection {
    return structuredClone(this.wardrobe)
  }

  public async setWardrobe(next: WardrobeSelection): Promise<void> {
    const appearance = buildAppearanceFromSelection(next, this.pack.project.bodies[0].id)
    await this.actor.setAppearance(appearance)
    this.wardrobe = structuredClone(next)
    this.refreshAccessoryTextures()
    saveWardrobe(this.wardrobe)
    this.mainView.sync()
    this.reflectionView.sync()
    this.primaryShadowView.sync()
    this.secondaryShadowView.sync()
    this.primaryBenchShadowView.sync()
    this.secondaryBenchShadowView.sync()
  }

  public onKeyDown(code: string): void {
    this.keys.add(code)
    if (this.controlsLocked) return
    if (code === 'Space') this.pendingJump = true
    if (code === 'KeyK') this.pendingDash = true
    if (code === 'KeyL') this.pendingSlide = true
  }

  public onKeyUp(code: string): void {
    this.keys.delete(code)
  }

  public clearInputs(): void {
    this.keys.clear()
    this.pendingJump = false
    this.pendingDash = false
    this.pendingSlide = false
  }

  public getTelemetry(): HeroTelemetry {
    return {
      x: this.x,
      floorY: this.floorY,
      jumpZ: this.jumpZ,
      facing: this.facing,
      clipId: this.currentClip,
      isRunning: this.isRunning,
      isGrounded: this.isGrounded,
      isBacklit: this.lastBackLightIntensity > 0.38,
    }
  }

  public sitAt(targetX: number, targetY: number, facing: 'left' | 'right'): void {
    this.x = targetX
    this.floorY = targetY
    this.jumpZ = 0
    this.jumpVz = 0
    this.isGrounded = true
    this.transientClip = null
    this.transientTimerMs = 0
    this.facing = facing
    this.actor.setFacing(facing)
    this.playClip('idle', true)
  }

  public playPreviewClip(clipId: 'idle' | 'walk' | 'run' | 'jump'): void {
    this.playClip(clipId, true)
  }

  public flipFacing(): void {
    this.facing = this.facing === 'right' ? 'left' : 'right'
    this.actor.setFacing(this.facing)
  }

  private playClip(clipId: string, restart = false): void {
    if (this.currentClip === clipId && !restart) return
    this.currentClip = clipId
    this.actor.playBase(clipId, { restart })
  }

  private spawnDustPuffs(count: number, spreadX = 10): void {
    for (let i = 0; i < count; i++) {
      const gfx = new Graphics()
      gfx.rect(0, 0, 2, 2).fill(0xcbd5ec)
      const px = this.x + (Math.random() - 0.5) * spreadX * 2
      const py = this.floorY - 1 + (Math.random() - 0.5) * 3
      gfx.position.set(px, py)
      this.puffLayer.addChild(gfx)
      this.puffs.push({
        gfx,
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 28,
        vy: -10 - Math.random() * 14,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
      })
    }
  }

  private resolveWalkablePosition(nx: number, ny: number, gatePassable = true): [number, number] {
    const minY = nx >= 260 && nx <= 380 ? 276 : WALK_MIN_Y
    let x = Math.max(WALK_MIN_X, Math.min(WALK_MAX_X, nx))
    let y = Math.max(minY, Math.min(WALK_MAX_Y, ny))

    const obstacles = gatePassable
      ? [...BENCH_OBSTACLES, ...STANCHION_OBSTACLES, ...ENTRANCE_PILLAR_OBSTACLES]
      : [...BENCH_OBSTACLES, ...STANCHION_OBSTACLES, ...ENTRANCE_PILLAR_OBSTACLES, ENTRANCE_GATE_OBSTACLE]

    for (const box of obstacles) {
      if (x > box.minX && x < box.maxX && y > box.minY && y < box.maxY) {
        const dLeft = Math.abs(x - box.minX)
        const dRight = Math.abs(box.maxX - x)
        const dTop = Math.abs(y - box.minY)
        const dBot = Math.abs(box.maxY - y)
        const m = Math.min(dLeft, dRight, dTop, dBot)
        if (m === dTop) y = box.minY
        else if (m === dBot) y = box.maxY
        else if (m === dLeft) x = box.minX
        else x = box.maxX
      }
    }
    return [x, y]
  }

  public update(deltaMs: number, light: CharacterLightSample, gatePassable = true): void {
    const dt = Math.min(0.05, deltaMs / 1000)

    // Update dust puffs
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]
      p.life += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.gfx.position.set(Math.round(p.x), Math.round(p.y))
      p.gfx.alpha = Math.max(0, 0.7 * (1 - p.life / p.maxLife))
      if (p.life >= p.maxLife) {
        p.gfx.destroy()
        this.puffs.splice(i, 1)
      }
    }

    if (this.controlsLocked) {
      this.actor.update(deltaMs)
      this.syncViews(light)
      return
    }

    // 1. Read WASD / Arrow movement input
    let ix = 0
    let iy = 0
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iy -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iy += 1

    const shiftHeld = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    const wantRun = this.alwaysRun ? !shiftHeld : shiftHeld
    const moving = ix !== 0 || iy !== 0
    this.isRunning = moving && wantRun

    // 2. Dash / Slide triggers on ground
    if (this.isGrounded && !this.transientClip) {
      if (this.pendingDash) {
        this.pendingDash = false
        this.dashDir = ix !== 0 ? (ix < 0 ? -1 : 1) : this.facing === 'left' ? -1 : 1
        this.facing = this.dashDir < 0 ? 'left' : 'right'
        this.actor.setFacing(this.facing)
        this.transientClip = 'dash'
        this.transientTimerMs = 310
        this.playClip('dash', true)
        this.spawnDustPuffs(5, 8)
      } else if (this.pendingSlide) {
        this.pendingSlide = false
        this.dashDir = ix !== 0 ? (ix < 0 ? -1 : 1) : this.facing === 'left' ? -1 : 1
        this.facing = this.dashDir < 0 ? 'left' : 'right'
        this.actor.setFacing(this.facing)
        this.transientClip = 'slide'
        this.transientTimerMs = 460
        this.playClip('slide', true)
        this.spawnDustPuffs(4, 10)
      }
    }
    this.pendingDash = false
    this.pendingSlide = false

    // 3. Jump trigger
    if (this.pendingJump && this.isGrounded) {
      this.pendingJump = false
      this.isGrounded = false
      this.jumpVz = 195
      this.fallElapsedMs = 0
      this.transientClip = null
      this.transientTimerMs = 0
      this.playClip('jump', true)
      this.spawnDustPuffs(5, 10)
    }
    this.pendingJump = false

    // 4. Horizontal & depth motion
    if (this.transientClip === 'dash') {
      const [nx, ny] = this.resolveWalkablePosition(
        this.x + this.dashDir * 220 * dt,
        this.floorY,
        gatePassable,
      )
      this.x = nx
      this.floorY = ny
    } else if (this.transientClip === 'slide') {
      const [nx, ny] = this.resolveWalkablePosition(
        this.x + this.dashDir * 145 * dt,
        this.floorY,
        gatePassable,
      )
      this.x = nx
      this.floorY = ny
    } else if (moving) {
      const len = Math.hypot(ix, iy)
      const dirX = ix / len
      const dirY = iy / len
      const speedX = wantRun ? 152 : 76
      const speedY = wantRun ? 72 : 42

      // Handle turning animations when flipping left/right on ground
      if (ix !== 0) {
        const nextFacing: 'left' | 'right' = ix < 0 ? 'left' : 'right'
        if (nextFacing !== this.facing) {
          this.facing = nextFacing
          this.actor.setFacing(nextFacing)
          if (this.isGrounded && !this.transientClip) {
            const turnClip = wantRun ? 'run_turn' : 'walk_turn'
            this.transientClip = turnClip
            this.transientTimerMs = 200
            this.playClip(turnClip, true)
          }
        }
      }

      const [nx, ny] = this.resolveWalkablePosition(
        this.x + dirX * speedX * dt,
        this.floorY + dirY * speedY * dt,
        gatePassable,
      )
      this.x = nx
      this.floorY = ny
    }

    // 5. Vertical Jump Physics
    if (!this.isGrounded) {
      this.jumpZ += this.jumpVz * dt
      this.jumpVz -= 620 * dt
      if (this.jumpZ <= 0) {
        this.jumpZ = 0
        this.jumpVz = 0
        this.isGrounded = true
        this.spawnDustPuffs(5, 11)
        if (!moving) {
          this.playClip('idle', true)
        }
      }
    }

    // 6. State Machine Animation Selection
    if (this.transientClip) {
      this.transientTimerMs -= deltaMs
      if (this.transientTimerMs <= 0) {
        this.transientClip = null
        this.transientTimerMs = 0
      }
    }

    if (!this.isGrounded) {
      if (this.jumpVz > 12) {
        this.playClip('jump')
      } else {
        this.fallElapsedMs += deltaMs
        this.playClip(this.fallElapsedMs < 240 ? 'fall' : 'fall_loop')
      }
    } else if (!this.transientClip) {
      if (moving) {
        this.playClip(wantRun ? 'run' : 'walk')
        this.wasRunning = wantRun
      } else {
        if (this.wasRunning) {
          this.wasRunning = false
          this.transientClip = 'run_to_idle'
          this.transientTimerMs = 360
          this.playClip('run_to_idle', true)
        } else {
          this.playClip('idle')
        }
      }
    }

    this.actor.update(deltaMs)
    this.syncViews(light)
  }

  private refreshAccessoryTextures(): void {
    const syncSlot = (sprite: Sprite, id: VisualAccessoryId) => {
      if (!id || id === 'none') {
        sprite.visible = false
        sprite.texture = Texture.EMPTY
        return
      }
      sprite.texture = getAccessoryTexture(id)
      sprite.visible = true
    }
    syncSlot(this.backAccessorySprite, this.wardrobe.backgear)
    syncSlot(this.headAccessorySprite, this.wardrobe.headwear)
    syncSlot(this.badgeAccessorySprite, this.wardrobe.badge)
  }

  private syncAccessories(liftY: number, bodyTint: number): void {
    const t = performance.now() * 0.001
    const facingSign = this.facing === 'right' ? 1 : -1
    const moveBob =
      this.currentClip === 'walk'
        ? -Math.abs(Math.sin(t * 7.5)) * 1.4
        : this.currentClip === 'run'
          ? -Math.abs(Math.sin(t * 11.5)) * 2.2
          : Math.sin(t * 2.4) * 0.45

    const positionOne = (sprite: Sprite, id: VisualAccessoryId, phaseShift: number) => {
      if (!id || id === 'none') {
        sprite.visible = false
        return
      }
      const spec = ACCESSORY_SPECS[id]
      sprite.visible = true
      const floatDy = spec.floating ? Math.sin(t * 3.1 + phaseShift) * 2.4 : moveBob
      const floatDx = spec.floating ? Math.cos(t * 1.9 + phaseShift) * 1.4 : 0
      const flutterScale = spec.flutter ? 0.78 + Math.abs(Math.sin(t * 9.5)) * 0.28 : 1
      const scaleX = facingSign * 2 * flutterScale
      const scaleY = 2
      sprite.scale.set(scaleX, scaleY)
      sprite.position.set(
        Math.round(spec.offsetX * facingSign + floatDx),
        Math.round(liftY + spec.anchorY + spec.offsetY + floatDy),
      )
      // Keep luminescent / floating accessories glowing brightly; dim cloth items slightly with room lighting
      sprite.tint =
        id === 'halo_star' || id === 'visor_holo' || id === 'wings_astral' || id === 'lantern_float' || id === 'butterfly_star'
          ? 0xffffff
          : bodyTint
    }

    positionOne(this.backAccessorySprite, this.wardrobe.backgear, 0.4)
    positionOne(this.headAccessorySprite, this.wardrobe.headwear, 1.8)
    positionOne(this.badgeAccessorySprite, this.wardrobe.badge, 3.1)
  }

  private syncViews(light: CharacterLightSample): void {
    const rx = Math.round(this.x)
    const ry = Math.round(this.floorY)
    const liftY = -Math.round(this.jumpZ)
    this.lastBackLightIntensity = light.backLightIntensity

    this.characterRoot.position.set(rx, ry)
    this.characterRoot.zIndex = ry

    this.mainView.position.set(0, liftY)
    this.mainView.tint = light.bodyTint
    this.mainView.sync()
    this.syncAccessories(liftY, light.bodyTint)

    // True Multi-Light Cast Silhouette Shadows + Foot-Contact AO on floorShadowLayer
    this.shadowRoot.position.set(rx, ry)
    const jumpScale = Math.max(0.62, 1 - this.jumpZ / 95)
    const jumpAlphaFade = Math.max(0.32, 1 - this.jumpZ / 75)
    const jumpForwardShift = Math.round(this.jumpZ * 0.26 * light.shadowStretchY)
    const jumpSideShift1 = Math.round(this.jumpZ * 0.24 * Math.sin(light.shadowSkewX))
    const jumpSideShift2 = Math.round(this.jumpZ * 0.24 * Math.sin(light.secondaryShadowSkewX))

    this.primaryShadowView.position.set(jumpSideShift1, 1 + jumpForwardShift)
    this.primaryShadowView.scale.set(2 * jumpScale, -2 * light.shadowScaleY * jumpScale)
    this.primaryShadowView.skew.set(light.shadowSkewX, 0)
    this.primaryShadowFilter.matrix = [
      0, 0, 0, 0, 0.008,
      0, 0, 0, 0, 0.012,
      0, 0, 0, 0, 0.028,
      0, 0, 0, light.shadowAlpha * jumpAlphaFade, 0,
    ]
    this.primaryShadowView.sync()

    this.secondaryShadowView.position.set(jumpSideShift2, 1 + jumpForwardShift)
    this.secondaryShadowView.scale.set(
      2.08 * jumpScale,
      -2 * light.secondaryShadowScaleY * jumpScale,
    )
    this.secondaryShadowView.skew.set(light.secondaryShadowSkewX, 0)
    this.secondaryShadowFilter.matrix = [
      0, 0, 0, 0, 0.012,
      0, 0, 0, 0, 0.02,
      0, 0, 0, 0, 0.043,
      0, 0, 0, light.secondaryShadowAlpha * jumpAlphaFade, 0,
    ]
    this.secondaryShadowView.sync()

    const directionalFootAlpha = Math.max(0.18, Math.min(1, light.shadowAlpha / 0.56))
    this.shadowGfx.clear()
    this.shadowGfx
      .ellipse(
        Math.round(light.shadowOffsetX * 0.4),
        Math.round(2 * light.shadowStretchY),
        Math.round(11.5 * jumpScale),
        Math.round(3.4 * jumpScale),
      )
      .fill({ color: 0x05070d, alpha: 0.24 * directionalFootAlpha * jumpAlphaFade })
    this.shadowGfx
      .ellipse(0, 0, Math.round(9.5 * jumpScale), Math.round(2.6 * jumpScale))
      .fill({ color: 0x05070d, alpha: 0.68 * jumpAlphaFade })

    // Cast Hero Shadow onto Front Bench Occluders when standing behind a bench (y < 320)
    const nearBenchBehind =
      this.floorY < 320 &&
      BENCH_OBSTACLES.some((b) => this.x >= b.minX - 64 && this.x <= b.maxX + 64)
    this.benchShadowRoot.visible = nearBenchBehind
    if (nearBenchBehind) {
      // Align the cast shadow's waist region (~15px into the inverted shadow) with the raised bench cushion (y=296..304)
      this.benchShadowRoot.position.set(rx, ry - 33)
      this.primaryBenchShadowView.position.set(jumpSideShift1, 1 + jumpForwardShift)
      this.primaryBenchShadowView.scale.set(2 * jumpScale, -2 * light.shadowScaleY * jumpScale)
      this.primaryBenchShadowView.skew.set(light.shadowSkewX, 0)
      this.primaryBenchShadowFilter.matrix = [
        0, 0, 0, 0, 0.008,
        0, 0, 0, 0, 0.012,
        0, 0, 0, 0, 0.028,
        0, 0, 0, Math.min(0.84, light.shadowAlpha * 0.94) * jumpAlphaFade, 0,
      ]
      this.primaryBenchShadowView.sync()

      this.secondaryBenchShadowView.position.set(jumpSideShift2, 1 + jumpForwardShift)
      this.secondaryBenchShadowView.scale.set(
        2.06 * jumpScale,
        -2 * light.secondaryShadowScaleY * jumpScale,
      )
      this.secondaryBenchShadowView.skew.set(light.secondaryShadowSkewX, 0)
      this.secondaryBenchShadowFilter.matrix = [
        0, 0, 0, 0, 0.012,
        0, 0, 0, 0, 0.02,
        0, 0, 0, 0, 0.043,
        0, 0, 0, Math.min(0.62, light.secondaryShadowAlpha * 0.94) * jumpAlphaFade, 0,
      ]
      this.secondaryBenchShadowView.sync()
    }

    // Octopath-style Multi-Stop Atmospheric Light Scattering (rear bloom + soft front edge light-wrap)
    const bi = light.backLightIntensity
    const scatterVisible = bi > 0.04
    this.rearScatterSprite.visible = scatterVisible
    this.rearCoreSprite.visible = scatterVisible
    this.groundScatterSprite.visible = scatterVisible
    this.frontScatterSprite.visible = scatterVisible
    if (scatterVisible) {
      const shiftX = -light.backLightDirX * 5
      this.rearScatterSprite.position.set(shiftX, liftY - 26)
      this.rearScatterSprite.scale.set(0.68 + bi * 0.24, 0.76 + bi * 0.24)
      this.rearScatterSprite.tint = light.rimColor
      this.rearScatterSprite.alpha = bi * 0.32

      this.rearCoreSprite.position.set(shiftX * 0.8, liftY - 30)
      this.rearCoreSprite.scale.set(0.38 + bi * 0.14, 0.44 + bi * 0.16)
      this.rearCoreSprite.tint = 0xfff5e4
      this.rearCoreSprite.alpha = bi * 0.16

      this.groundScatterSprite.position.set(shiftX * 0.6, 0)
      this.groundScatterSprite.scale.set((0.46 + bi * 0.18) * jumpScale, 0.14 * jumpScale)
      this.groundScatterSprite.tint = light.rimColor
      this.groundScatterSprite.alpha = bi * 0.22 * jumpScale

      this.frontScatterSprite.position.set(-light.backLightDirX * 7, liftY - 24)
      this.frontScatterSprite.scale.set(0.56 + bi * 0.18, 0.64 + bi * 0.18)
      this.frontScatterSprite.tint = light.rimColor
      this.frontScatterSprite.alpha = 0.04 + bi * 0.14
    }

    // Live Floor Reflection tinted dynamically by local light pool (attenuated when strongly backlit)
    this.reflectionView.position.set(rx, ry + Math.round(this.jumpZ * 0.55))
    this.reflectionView.tint = light.reflectionTint
    this.reflectionView.alpha =
      0.22 * (1 - light.backLightIntensity * 0.55) * Math.max(0.16, 1 - this.jumpZ / 42)
    this.reflectionView.sync()
  }

  public destroy(): void {
    this.mainView.destroy()
    this.reflectionView.destroy()
    this.primaryShadowView.destroy()
    this.secondaryShadowView.destroy()
    this.primaryBenchShadowView.destroy()
    this.secondaryBenchShadowView.destroy()
    this.scatterTex.destroy(true)
    this.primaryShadowFilter.destroy()
    this.secondaryShadowFilter.destroy()
    this.primaryBenchShadowFilter.destroy()
    this.secondaryBenchShadowFilter.destroy()
    this.benchShadowRoot.destroy({ children: true })
    this.shadowRoot.destroy({ children: true })
    this.characterRoot.destroy({ children: true })
  }
}
