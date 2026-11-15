import {
  BlurFilter,
  Container,
  Graphics,
  RenderTexture,
  Sprite,
  Texture,
  type Renderer,
} from 'pixi.js'
import type {
  ActiveMode,
  CharacterLightSample,
  CorridorWingId,
  HeroTelemetry,
  Hotspot,
  LightingPreset,
  LightingPresetId,
} from '../types'
import type { GeneratedArtworks } from './Artworks'
import {
  bayer4,
  createLinearTexture,
  createPixelSurface,
  createTreeSwayParts,
  drawPixelTreePotOnly,
  drawPixelTreeTrunkBase,
  hash2d,
  lerpColor,
  mulberry32,
  px,
  surfaceToNearestTexture,
  type TreePalette,
} from './PixelCanvasBuilder'

export const WORLD_WIDTH = 2560
export const SCENE_WIDTH = 640
export const SCENE_HEIGHT = 360
export const FLOOR_HORIZON_Y = 272
export const WALK_MIN_X = 52
export const WALK_MAX_X = 2508
export const WALK_MIN_Y = 280
export const WALK_MAX_Y = 344

const WING_OFFSETS: Record<CorridorWingId, number> = {
  entrance: 0,
  west: 640,
  center: 1280,
  east: 1920,
}

export const WING_CENTERS: Record<CorridorWingId, number> = {
  entrance: 320,
  west: 960,
  center: 1600,
  east: 2240,
}

export const LIGHTING_PRESETS: Record<LightingPresetId, LightingPreset> = {
  night_gallery: {
    id: 'night_gallery',
    name: '夜幕静谧展厅',
    subtitle: '参照原画氛围 · 冷蓝天窗与暖金聚光交织',
    ambientTint: 0x0b0f1d,
    ambientAlpha: 0.16,
    skylightColor: 0x76c4ff,
    skylightAlpha: 0.44,
    spotColor: 0xffb96a,
    spotAlpha: 0.48,
    sconceColor: 0xffa64d,
    sconceAlpha: 0.74,
    plinthColor: 0xffb95c,
    plinthAlpha: 0.7,
    dustColor: 0xffe8ba,
  },
  starlight_dream: {
    id: 'starlight_dream',
    name: '星辉浮空幻境',
    subtitle: '天窗苍蓝圣光倾泻 · 画境星尘满溢',
    ambientTint: 0x0c1638,
    ambientAlpha: 0.22,
    skylightColor: 0x8ce2ff,
    skylightAlpha: 0.72,
    spotColor: 0xaebcff,
    spotAlpha: 0.36,
    sconceColor: 0xe69dff,
    sconceAlpha: 0.58,
    plinthColor: 0x7be0f5,
    plinthAlpha: 0.78,
    dustColor: 0x9ef0ff,
  },
  amber_evening: {
    id: 'amber_evening',
    name: '暮金暖光回廊',
    subtitle: '八方旅人古典烛火感 · 温润木构与琥珀余晖',
    ambientTint: 0x1e110a,
    ambientAlpha: 0.14,
    skylightColor: 0xffc688,
    skylightAlpha: 0.3,
    spotColor: 0xffa756,
    spotAlpha: 0.68,
    sconceColor: 0xff9238,
    sconceAlpha: 0.9,
    plinthColor: 0xffa447,
    plinthAlpha: 0.86,
    dustColor: 0xffcf88,
  },
}

export const GALLERY_HOTSPOTS: Hotspot[] = [
  // Entrance Lobby / Seed Hall (x = 0..640)
  {
    id: 'entrance_reception',
    label: '序章导览台 · 《栽培与剪枝》策展导言',
    promptText: '[E] 阅读展览导言',
    x: 132,
    y: 284,
    radius: 46,
    hintY: 204,
    wing: 'entrance',
  },
  {
    id: 'entrance_kiosk',
    label: '种子大厅终端 · 通行证核验与初始 Credit',
    promptText: '[E] 核验门票开启闸门',
    x: 474,
    y: 284,
    radius: 42,
    hintY: 186,
    wing: 'entrance',
  },
  {
    id: 'entrance_prologue_tree',
    label: '序章主视觉 · 《生长中的算法树》',
    promptText: '[E] 观赏主视觉与导言',
    x: 546,
    y: 284,
    radius: 48,
    hintY: 202,
    wing: 'entrance',
  },

  // West Wing (x = 640..1280)
  {
    id: 'west_bench',
    label: '西翼观展长椅',
    promptText: '[E] 静坐观展',
    x: 960,
    y: 320,
    radius: 38,
    hintY: 284,
    wing: 'west',
  },

  // Central Grand Hall (x = 1280..1920)
  {
    id: 'left_bench',
    label: '中庭西侧长椅',
    promptText: '[E] 静坐观展',
    x: 1438,
    y: 320,
    radius: 38,
    hintY: 284,
    wing: 'center',
  },
  {
    id: 'wardrobe_mirror',
    label: '幻装衣橱镜台',
    promptText: '[E] 更换装扮',
    x: 1718,
    y: 284,
    radius: 28,
    hintY: 162,
    wing: 'center',
  },
  {
    id: 'right_bench',
    label: '中庭东侧长椅',
    promptText: '[E] 静坐观展',
    x: 1762,
    y: 320,
    radius: 38,
    hintY: 284,
    wing: 'center',
  },

  // East Wing (x = 1920..2560)
  {
    id: 'east_bench',
    label: '东翼观展长椅',
    promptText: '[E] 静坐观展',
    x: 2240,
    y: 320,
    radius: 38,
    hintY: 284,
    wing: 'east',
  },
]

interface DustParticle {
  sprite: Graphics
  x: number
  y: number
  vx: number
  vy: number
  baseAlpha: number
  phase: number
  size: number
}

interface BokehParticle {
  sprite: Sprite
  baseX: number
  baseY: number
  driftSpeed: number
  phase: number
  baseAlpha: number
  isWarm: boolean
}

interface BenchObstacle {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const BENCH_OBSTACLES: BenchObstacle[] = [
  { minX: 918, maxX: 1002, minY: 313, maxY: 325 },
  { minX: 1396, maxX: 1480, minY: 313, maxY: 325 },
  { minX: 1720, maxX: 1804, minY: 313, maxY: 325 },
  { minX: 2198, maxX: 2282, minY: 313, maxY: 325 },
]

export const STANCHION_OBSTACLES: BenchObstacle[] = [
  { minX: 88, maxX: 234, minY: 292, maxY: 300 },
  { minX: 406, maxX: 552, minY: 292, maxY: 300 },
]

export const ENTRANCE_GATE_OBSTACLE: BenchObstacle = {
  minX: 236,
  maxX: 404,
  minY: 288,
  maxY: 299,
}

export const ENTRANCE_PILLAR_OBSTACLES: BenchObstacle[] = [
  { minX: 243, maxX: 261, minY: 289, maxY: 297 },
  { minX: 311, maxX: 329, minY: 289, maxY: 297 },
  { minX: 379, maxX: 397, minY: 289, maxY: 297 },
]

interface RearLightSource {
  x: number
  radius: number
  color: number
  strength: number
  isWarm: boolean
}

const COLUMN_BASE_XS = [200, 440, 640, 840, 1080, 1280, 1480, 1720, 1920, 2120, 2360]
const PLINTH_CENTERS: Array<{ x: number; halfW: number }> = [
  { x: 960, halfW: 72 },
  { x: 1600, halfW: 80 },
  { x: 2240, halfW: 72 },
]
const SKYLIGHT_CENTERS = [320, 960, 1600, 2240]
const SIDE_BAY_CENTERS = [132, 508, 772, 1148, 1412, 1788, 2052, 2428]
const PLANTER_BASE_XS = [42, 596, 682, 1236, 1318, 1882, 1964, 2518]
const SCONCE_POSITIONS = [220, 420, 860, 1060, 1500, 1700, 2140, 2340]

function blendWeightedRgb(items: Array<{ color: number; weight: number }>, fallback: number): number {
  let rw = 0
  let gw = 0
  let bw = 0
  let total = 0
  for (const it of items) {
    if (it.weight <= 0) continue
    rw += ((it.color >> 16) & 0xff) * it.weight
    gw += ((it.color >> 8) & 0xff) * it.weight
    bw += (it.color & 0xff) * it.weight
    total += it.weight
  }
  if (total <= 0.001) return fallback
  const r = Math.min(255, Math.round(rw / total))
  const g = Math.min(255, Math.round(gw / total))
  const b = Math.min(255, Math.round(bw / total))
  return (r << 16) | (g << 8) | b
}

interface AnimatedTreeNode {
  trunkSprite: Sprite
  canopySprite: Sprite
  anchorX: number
  phase: number
  isSecondFloor: boolean
}

export class GalleryScene {
  readonly root = new Container()
  readonly worldLayer = new Container()
  readonly skyBackdropLayer = new Container()
  readonly bgArchitectureLayer = new Container()
  readonly backWallLightingLayer = new Container()
  readonly regBackdropLayer = new Container()
  readonly floorLayer = new Container()
  readonly reflectionLayer = new Container()
  readonly heroReflectionSlot = new Container()
  readonly groutOverlayLayer = new Container()
  readonly floorLightingLayer = new Container()
  readonly floorRugLayer = new Container()
  readonly floorShadowLayer = new Container()
  readonly backParticleLayer = new Container()
  readonly depthSortedLayer = new Container()
  readonly benchShadowLayer = new Container()
  readonly midVolumetricLightingLayer = new Container()
  readonly frontParticleLayer = new Container()
  readonly frontColorGradeLayer = new Container()
  readonly foregroundParallaxLayer = new Container()
  readonly prologueLayer = new Container()
  readonly promptLayer = new Container()
  readonly postLayer = new Container()

  // Animated plants, equipment & artwork overlays
  private animatedTrees: AnimatedTreeNode[] = []
  private deviceAnimGfx = new Graphics()
  private prologueAnimGfx = new Graphics()
  private prologueElapsedSec = 0
  private prologueTreeX = 200
  private deskLampGlowSprite!: Sprite
  private kioskGlowSprite!: Sprite
  private signHaloSprite!: Sprite

  // Animated artwork & light sprites
  private waterfallAnimGfx = new Graphics()
  private starAnimGfx = new Graphics()
  private westAnimGfx = new Graphics()
  private eastAnimGfx = new Graphics()

  private backSkylightRays: Sprite[] = []
  private frontSkylightRays: Sprite[] = []
  private skylightFloorPools: Sprite[] = []
  private spotOuterCones: Sprite[] = []
  private spotInnerCones: Sprite[] = []
  private spotGlints: Sprite[] = []
  private sconceGlowSprites: Sprite[] = []
  private paintingLightPools: Sprite[] = []
  private plaqueGlowSprites: Sprite[] = []
  private plaqueFloorPools: Sprite[] = []
  private plinthLightSprites: Sprite[] = []
  private plinthFloorGlowSprites: Sprite[] = []
  private planterBaseGlows: Sprite[] = []
  private planterFloorPools: Sprite[] = []
  private staticFloorShadowSprite!: Sprite
  private ambientTintOverlay!: Graphics
  private dustParticles: DustParticle[] = []
  private bokehParticles: BokehParticle[] = []

  private activePromptContainer = new Container()
  private activePromptBg = new Graphics()
  private activePromptDot = new Graphics()

  // Entrance Turnstile Gate & Frosted Double-Door Animation State (0 = closed, 1 = open)
  private entranceGateOpen = false
  private entranceDoorOpen = false
  private gateOpenProgress = 0
  private doorOpenProgress = 0
  private entranceAnimDelaySec = 0
  private gateFlapsGfx = new Graphics()
  private gateStatusGfx = new Graphics()
  private gateFloorGlowSprites: Sprite[] = []
  private entranceDoorContainer = new Container()
  private entranceGateContainer!: Container
  private entranceStanchionSprite!: Sprite
  private frostedBlurMaskGfx = new Graphics()
  private leftDoorSprite!: Sprite
  private rightDoorSprite!: Sprite
  private doorThresholdGlow!: Sprite

  // Registration Corridor DoF Stage
  private regCorridorFadeAlpha = 1
  private regCorridorTargetAlpha = 1
  private regPedestalFloorSprite!: Sprite
  private floorBaseSprite!: Sprite
  private floorReflSprite!: Sprite
  private floorGroutSprite!: Sprite

  // DoF & Vignette
  private dofRenderTex!: RenderTexture
  private dofSprite!: Sprite
  private dofMaskSprite!: Sprite
  private dofBlurFilter!: BlurFilter
  private vignetteSprite!: Sprite

  // Camera state
  private cameraTargetX = WING_CENTERS.center
  private cameraTargetY = SCENE_HEIGHT / 2
  private cameraTargetZoom = 1
  private cameraX = WING_CENTERS.center
  private cameraY = SCENE_HEIGHT / 2
  private cameraZoom = 1
  private lookAheadX = 0
  private manualPanX = 0
  private userZoom = 1
  private patrolActive = false
  private patrolPhase = 0
  private focusX = WING_CENTERS.center
  private focusY = SCENE_HEIGHT / 2
  private focusZoom = 1

  // Scene flags
  private artworks: GeneratedArtworks
  private preset: LightingPreset = LIGHTING_PRESETS.night_gallery
  private resonanceEnabled = false
  private lightsDimmed = false
  private timeSec = 0
  private lastDofUpdate = 0

  constructor(artworks: GeneratedArtworks) {
    this.artworks = artworks
    this.buildSkyBackdrop()
    this.buildStaticArchitecture()
    this.buildEntranceFrostedDoors()
    this.buildRegistrationCorridorStage()
    this.buildAnimatedArtworkOverlays()
    this.buildFloorAndReflections()
    this.buildFloorShadows()
    this.buildBenches()
    this.buildEntranceGatesAndStanchions()
    this.buildLightingAndParticles()
    this.buildForegroundParallax()
    this.buildPrologueSubterraneanStage()
    this.buildDoFAndVignette()
    this.assembleHierarchy()
  }

  private assembleHierarchy(): void {
    this.depthSortedLayer.sortableChildren = true

    this.floorLayer.addChild(
      this.reflectionLayer,
      this.groutOverlayLayer,
      this.floorLightingLayer,
      this.floorRugLayer,
      this.floorShadowLayer,
    )
    this.reflectionLayer.addChild(this.heroReflectionSlot)
    this.benchShadowLayer.zIndex = 320.5
    this.depthSortedLayer.addChild(this.benchShadowLayer)

    this.worldLayer.addChild(
      this.skyBackdropLayer,
      this.bgArchitectureLayer,
      this.waterfallAnimGfx,
      this.starAnimGfx,
      this.westAnimGfx,
      this.eastAnimGfx,
      this.backWallLightingLayer,
      this.regBackdropLayer,
      this.floorLayer,
      this.prologueLayer,
      this.backParticleLayer,
      this.depthSortedLayer,
      this.midVolumetricLightingLayer,
      this.frontParticleLayer,
      this.frontColorGradeLayer,
      this.foregroundParallaxLayer,
      this.promptLayer,
    )

    this.postLayer.addChild(this.dofSprite, this.dofMaskSprite, this.vignetteSprite)
    this.root.addChild(this.worldLayer, this.postLayer)
  }

  private buildSkyBackdrop(): void {
    const surf = createPixelSurface(WORLD_WIDTH, 120)
    const { ctx } = surf
    const rand = mulberry32(2901)

    for (let y = 0; y < 120; y++) {
      const t = y / 119
      px(ctx, 0, y, WORLD_WIDTH, 1, lerpColor([16, 36, 76], [32, 74, 126], t))
    }
    // Moonlit cloud wisps visible behind skylights
    for (let i = 0; i < 42; i++) {
      const cx = Math.floor(rand() * WORLD_WIDTH)
      const cy = Math.floor(rand() * 64) + 6
      const cw = 26 + Math.floor(rand() * 44)
      px(ctx, cx, cy, cw, 4, 'rgba(130, 195, 245, 0.22)')
      px(ctx, cx + 4, cy - 2, Math.max(8, cw - 8), 3, 'rgba(180, 224, 255, 0.16)')
    }
    // Crisp distant stars
    for (let i = 0; i < 160; i++) {
      const sx = Math.floor(rand() * WORLD_WIDTH)
      const sy = Math.floor(rand() * 88)
      px(ctx, sx, sy, 1, 1, rand() > 0.4 ? '#dff4ff' : '#96c9f5')
    }

    const skySprite = new Sprite(surfaceToNearestTexture(surf))
    this.skyBackdropLayer.addChild(skySprite)
  }

  private buildStaticArchitecture(): void {
    const surf = createPixelSurface(WORLD_WIDTH, FLOOR_HORIZON_Y)
    const { ctx } = surf

    const firstFloorTreePalette = {
      trunkDark: '#261d17',
      trunkLight: '#49372a',
      leafDeep: '#121814',
      leafMid: '#233122',
      leafLit: '#4b5a34',
      leafHighlight: '#96874a',
      potDark: '#1c1d21',
      potMid: '#2e3036',
      potRim: '#42444d',
      potGlow: '#ffbc6b',
    }
    const secondFloorTreePalette: TreePalette = {
      trunkDark: '#1b1512',
      trunkLight: '#2e241d',
      leafDeep: '#151c16',
      leafMid: '#232e1e',
      leafLit: '#36432a',
      leafHighlight: '#4a5735',
      potDark: '#19191b',
      potMid: '#272629',
      potRim: '#373539',
    }

    this.animatedTrees = []
    const balconyTreeContainer = new Container()
    const floorTreeContainer = new Container()
    const balconyTreeMask = new Graphics()
    balconyTreeMask.rect(0, 0, WORLD_WIDTH, 87).fill(0xffffff)
    balconyTreeContainer.mask = balconyTreeMask

    const addAnimatedTree = (
      cx: number,
      baseY: number,
      scale: number,
      palette: TreePalette,
      seed: number,
      isSecondFloor: boolean,
    ) => {
      drawPixelTreePotOnly(ctx, cx, baseY, scale, palette)
      if (isSecondFloor) {
        drawPixelTreeTrunkBase(ctx, cx, baseY, scale, palette, seed, 8)
      }
      const parts = createTreeSwayParts(scale, palette, seed, baseY)
      const trunkSprite = new Sprite(surfaceToNearestTexture(parts.trunkCanvas))
      trunkSprite.anchor.set(parts.pivotX / parts.width, parts.pivotY / parts.height)
      trunkSprite.position.set(cx, parts.potY)

      const canopySprite = new Sprite(surfaceToNearestTexture(parts.canopyCanvas))
      canopySprite.anchor.set(parts.pivotX / parts.width, parts.pivotY / parts.height)
      canopySprite.position.set(cx, parts.potY)

      const target = isSecondFloor ? balconyTreeContainer : floorTreeContainer
      target.addChild(trunkSprite, canopySprite)
      this.animatedTrees.push({
        trunkSprite,
        canopySprite,
        anchorX: cx,
        phase: (seed * 0.6180339887) % (Math.PI * 2),
        isSecondFloor,
      })
    }

    const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0)

    const paintTextureBlock = (
      x0: number,
      y0: number,
      w: number,
      h: number,
      sampler: (x: number, y: number) => [number, number, number],
    ) => {
      const img = ctx.createImageData(w, h)
      const data = img.data
      for (let ly = 0; ly < h; ly++) {
        const y = y0 + ly
        const rowOffset = ly * w * 4
        for (let lx = 0; lx < w; lx++) {
          const x = x0 + lx
          const [r, g, b] = sampler(x, y)
          const idx = rowOffset + lx * 4
          data[idx] = clampByte(r)
          data[idx + 1] = clampByte(g)
          data[idx + 2] = clampByte(b)
          data[idx + 3] = 255
        }
      }
      ctx.putImageData(img, x0, y0)
    }

    const drawBaseboard = (x0: number, x1: number) => {
      const w = x1 - x0
      px(ctx, x0, 263, w, 1, '#44372f')
      px(ctx, x0, 264, w, 1, '#2d2420')
      px(ctx, x0, 265, w, 5, '#1d1818')
      for (let jx = x0 + 24; jx < x1 - 4; jx += 32) {
        px(ctx, jx, 264, 1, 6, '#120f10')
        px(ctx, jx + 1, 264, 1, 5, 'rgba(255, 226, 186, 0.06)')
      }
      px(ctx, x0, 270, w, 2, '#0a090c')
    }

    const drawMoldedPanelFrame = (
      fx0: number,
      fy0: number,
      fw: number,
      fh: number,
      shadowCol = 'rgba(7, 6, 10, 0.44)',
      lightCol = 'rgba(255, 224, 182, 0.14)',
    ) => {
      // Outer recessed shadow on top & left, catch-light on bottom & right
      px(ctx, fx0, fy0, fw, 1, shadowCol)
      px(ctx, fx0, fy0, 1, fh, shadowCol)
      px(ctx, fx0 + 1, fy0 + fh - 1, fw - 1, 1, lightCol)
      px(ctx, fx0 + fw - 1, fy0 + 1, 1, fh - 1, lightCol)

      // Inner architectural bevel trim + stepped corner notches
      const ix0 = fx0 + 4
      const iy0 = fy0 + 4
      const iw = fw - 8
      const ih = fh - 8
      px(ctx, ix0, iy0, iw, 1, lightCol)
      px(ctx, ix0, iy0, 1, ih, lightCol)
      px(ctx, ix0, iy0 + ih - 1, iw, 1, shadowCol)
      px(ctx, ix0 + iw - 1, iy0, 1, ih, shadowCol)

      // Delicate corner step brackets
      for (const [cx, cy] of [
        [fx0 + 2, fy0 + 2],
        [fx0 + fw - 5, fy0 + 2],
        [fx0 + 2, fy0 + fh - 5],
        [fx0 + fw - 5, fy0 + fh - 5],
      ]) {
        px(ctx, cx, cy, 3, 1, lightCol)
        px(ctx, cx, cy + 1, 1, 2, shadowCol)
      }
    }

    // 1. Base ceiling & coffered horizontal timber beams across 1920px
    px(ctx, 0, 0, WORLD_WIDTH, 40, '#0a090d')
    for (let cx = 0; cx < WORLD_WIDTH; cx += 46) {
      const nearSkylight = SKYLIGHT_CENTERS.some((sc) => Math.abs(cx + 23 - sc) < 62)
      if (!nearSkylight) {
        // Recessed ceiling coffer bay between rafters
        px(ctx, cx + 8, 2, 34, 18, '#100e13')
        px(ctx, cx + 10, 4, 30, 14, '#151218')
        px(ctx, cx + 10, 4, 30, 1, '#1e1920')
      }
    }
    for (let rx = 20; rx < WORLD_WIDTH; rx += 46) {
      const nearSkylight = SKYLIGHT_CENTERS.some((sc) => Math.abs(rx - sc) < 62)
      if (nearSkylight) continue
      px(ctx, rx, 0, 1, 24, '#29201b')
      px(ctx, rx + 1, 0, 5, 24, '#1b1512')
      px(ctx, rx + 6, 0, 2, 24, '#080607')
      px(ctx, rx - 1, 20, 9, 3, '#221a15')
    }
    // Main horizontal coffered ceiling girder
    px(ctx, 0, 23, WORLD_WIDTH, 11, '#231b16')
    px(ctx, 0, 23, WORLD_WIDTH, 1, '#4b3b2f')
    px(ctx, 0, 24, WORLD_WIDTH, 1, '#362a21')
    for (let gx = 16; gx < WORLD_WIDTH - 24; gx += 32) {
      const nearSkylight = SKYLIGHT_CENTERS.some((sc) => Math.abs(gx + 12 - sc) < 52)
      if (nearSkylight) continue
      px(ctx, gx, 26, 24, 5, '#19130f')
      px(ctx, gx + 1, 27, 22, 3, '#2a201a')
      px(ctx, gx + 1, 27, 22, 1, '#3b2e24')
    }
    px(ctx, 0, 32, WORLD_WIDTH, 2, '#130e0c')
    px(ctx, 0, 34, WORLD_WIDTH, 2, 'rgba(6, 5, 8, 0.65)')

    const drawPlasterBay = (x0: number, x1: number, cx: number) => {
      const w = x1 - x0
      paintTextureBlock(x0, 122, w, FLOOR_HORIZON_Y - 122, (x, y) => {
        const dx = (x - cx) / 72
        const dy = (y - 170) / 96
        const spot = Math.max(0, 1 - Math.hypot(dx * 0.9, dy * 0.85))
        // Multi-scale lime-stucco plaster grain + horizontal trowel wisps
        const trowelPatch = (hash2d(x >> 2, y >> 1, 17) - 0.5) * 0.065
        const mediumMineral = (hash2d(x >> 1, y, 53) - 0.5) * 0.045
        const fineSand = (hash2d(x, y, 91) - 0.5) * 0.032
        const edgeDist = Math.min(x - x0, x1 - 1 - x)
        const cornerAo = edgeDist < 10 ? 0.84 + (edgeDist / 10) * 0.16 : 1
        const topAo = y < 130 ? 0.72 + ((y - 122) / 8) * 0.28 : 1
        const d = (bayer4(x, y) - 0.5) * 0.075
        const tex = (trowelPatch + mediumMineral + fineSand) * (0.45 + spot * 0.65)
        const lum = Math.max(0, Math.min(1, (spot * 0.88 + d + tex) * cornerAo * topAo))
        return [27 + lum * 74, 24 + lum * 60, 25 + lum * 46]
      })

      // Upper soffit contact shadow & plaster cornice bead
      px(ctx, x0, 122, w, 3, 'rgba(7, 6, 9, 0.62)')
      px(ctx, x0, 125, w, 1, 'rgba(255, 224, 184, 0.08)')

      // Recessed classical wall molding frame
      drawMoldedPanelFrame(x0 + 8, 132, w - 16, 108)

      // Dado rail molding & recessed lower wainscot bays (behind cabinets & planters)
      px(ctx, x0, 241, w, 1, '#47392e')
      px(ctx, x0, 242, w, 2, '#2d231c')
      px(ctx, x0, 244, w, 2, 'rgba(7, 6, 9, 0.55)')
      for (let y = 246; y < 263; y++) {
        const shade = y < 248 ? 0.84 : 1.0
        for (let x = x0; x < x1; x++) {
          const grain = (hash2d(x, y >> 1, 211) - 0.5) * 3.5
          const v = 24 * shade + grain
          px(ctx, x, y, 1, 1, `rgb(${Math.round(v + 3)},${Math.round(v)},${Math.round(v - 1)})`)
        }
      }
      // Subtle vertical wainscot panel divisions
      const dadoStep = Math.floor((w - 16) / 4)
      for (let i = 0; i < 4; i++) {
        const pxStart = x0 + 8 + i * dadoStep
        const pw = i === 3 ? x1 - 8 - pxStart : dadoStep - 4
        if (pw > 10) {
          px(ctx, pxStart, 248, pw, 12, 'rgba(12, 10, 14, 0.34)')
          px(ctx, pxStart + 1, 249, pw - 2, 1, 'rgba(255, 216, 174, 0.07)')
          px(ctx, pxStart + 1, 259, pw - 2, 1, 'rgba(6, 5, 8, 0.45)')
        }
      }

      drawBaseboard(x0, x1)
    }

    const drawAtriumWall = (x0: number, x1: number, cx: number, coolColor: [number, number, number]) => {
      const w = x1 - x0
      paintTextureBlock(x0, 26, w, FLOOR_HORIZON_Y - 26, (x, y) => {
        const coolTop = Math.max(0, 1 - (y - 24) / 118) * Math.max(0, 1 - Math.abs(x - cx) / 96)
        const leftSconce = Math.max(0, 1 - Math.hypot((x - (x0 + 14)) / 66, (y - 174) / 88))
        const rightSconce = Math.max(0, 1 - Math.hypot((x - (x1 - 14)) / 66, (y - 174) / 88))
        const plinthBounce = Math.max(0, 1 - Math.abs(x - cx) / 92) * Math.max(0, 1 - Math.abs(y - 252) / 36)
        const warm = Math.min(1, leftSconce + rightSconce + plinthBounce * 0.48)
        const d = (bayer4(x, y) - 0.5) * 0.06

        // Architectural limestone / lime-plaster grain + subtle staggered ashlar seams
        const stucco = (hash2d(x >> 2, y >> 1, 313) - 0.5) * 3.8 + (hash2d(x, y, 401) - 0.5) * 2.4
        const courseRow = Math.floor((y - 24) / 28)
        const courseY = (y - 24) % 28
        const jointOffset = (courseRow & 1) * 26
        const isHorizSeam = y > 40 && y < 262 && courseY === 0
        const isHorizCatch = y > 40 && y < 262 && courseY === 1
        const isVertSeam = y > 40 && y < 262 && (x - x0 + jointOffset) % 52 === 0
        const edgeDist = Math.min(x - x0, x1 - 1 - x)
        const cornerShade = edgeDist < 5 ? -3.5 * (1 - edgeDist / 5) : 0

        let seamDelta = 0
        if (isHorizSeam || isVertSeam) seamDelta = -4.2 - warm * 2.5 - coolTop * 2.0
        else if (isHorizCatch) seamDelta = 1.6 + warm * 2.2 + coolTop * 1.4

        const r = 24 + warm * 66 + coolTop * coolColor[0] + d * 18 + stucco + seamDelta + cornerShade
        const g = 23 + warm * 46 + coolTop * coolColor[1] + d * 18 + stucco * 0.9 + seamDelta + cornerShade
        const b = 26 + warm * 24 + coolTop * coolColor[2] + d * 18 + stucco * 0.8 + seamDelta * 0.8 + cornerShade
        return [Math.max(12, r), Math.max(12, g), Math.max(15, b)]
      })

      // Upper architrave cornice beneath skylight girder
      px(ctx, x0, 34, w, 2, '#110e10')
      px(ctx, x0, 36, w, 1, 'rgba(130, 185, 235, 0.16)')

      // Flanking vertical plaster pilaster molding strips beside inner columns
      for (const mx of [x0 + 5, x1 - 6]) {
        px(ctx, mx, 38, 1, 224, 'rgba(8, 7, 11, 0.48)')
        px(ctx, mx + (mx < cx ? 1 : -1), 38, 1, 224, 'rgba(255, 222, 180, 0.1)')
      }

      // Continuous dado molding line & stone baseboard behind central plinth
      px(ctx, x0, 242, w, 1, 'rgba(255, 212, 160, 0.11)')
      px(ctx, x0, 243, w, 1, 'rgba(7, 6, 10, 0.48)')
      drawBaseboard(x0, x1)
    }

    const drawWallSconce = (cx: number, cy: number) => {
      // Drop shadow on plaster wall
      px(ctx, cx - 3, cy - 8, 8, 18, 'rgba(5, 5, 9, 0.55)')
      // Dark bronze wall backplate & mounting bracket
      px(ctx, cx - 3, cy - 9, 6, 18, '#1a1310')
      px(ctx, cx - 2, cy - 8, 4, 16, '#3a2b20')
      // Brass top & bottom lantern caps
      px(ctx, cx - 3, cy - 8, 6, 2, '#8b6a3e')
      px(ctx, cx - 2, cy - 8, 4, 1, '#cfa663')
      px(ctx, cx - 3, cy + 6, 6, 2, '#7d5f37')
      px(ctx, cx - 2, cy + 7, 4, 1, '#3b2c1a')
      // Frosted glowing amber glass lantern tube
      px(ctx, cx - 2, cy - 6, 4, 12, '#e28836')
      px(ctx, cx - 1, cy - 5, 2, 10, '#ffd47e')
      px(ctx, cx - 1, cy - 3, 2, 6, '#fff5cf')
      // Delicate vertical brass cage muntin
      px(ctx, cx, cy - 6, 1, 12, 'rgba(92, 64, 34, 0.45)')
    }

    const drawBalconyWall = (x0: number, x1: number) => {
      const w = x1 - x0
      paintTextureBlock(x0, 32, w, 80, (x, y) => {
        const t = (y - 32) / 80
        const grain = (hash2d(x >> 1, y >> 1, 607) - 0.5) * 4.0
        const edgeDist = Math.min(x - x0, x1 - 1 - x)
        const ao = (edgeDist < 12 ? 0.8 + (edgeDist / 12) * 0.2 : 1) * (y < 42 ? 0.82 + ((y - 32) / 10) * 0.18 : 1)
        const r = (24 + t * 20 + grain) * ao
        const g = (21 + t * 17 + grain) * ao
        const b = (23 + t * 13 + grain) * ao
        return [r, g, b]
      })
      // Subtle recessed 2F wall paneling & dado wainscot behind the potted trees
      drawMoldedPanelFrame(x0 + 10, 42, w - 20, 46, 'rgba(6, 5, 9, 0.42)', 'rgba(220, 198, 174, 0.08)')
      px(ctx, x0, 88, w, 1, '#3b2f26')
    }

    const drawBalconyRailing = (x0: number, x1: number) => {
      const w = x1 - x0
      // Sculpted top wooden handrail
      px(ctx, x0, 87, w, 1, '#584434')
      px(ctx, x0, 88, w, 3, '#3c2e24')
      px(ctx, x0, 91, w, 1, '#140f0c')

      // Alternating balusters & thicker intermediate newel posts
      for (let sx = x0 + 4; sx < x1 - 3; sx += 5) {
        const isPost = (sx - x0) % 45 < 5
        if (isPost) {
          px(ctx, sx - 1, 86, 4, 22, '#2d221b')
          px(ctx, sx, 87, 1, 21, '#4a382c')
          px(ctx, sx + 2, 87, 1, 21, '#140f0c')
        } else {
          px(ctx, sx, 92, 2, 16, '#261d17')
          px(ctx, sx, 92, 1, 16, '#362920')
          px(ctx, sx + 2, 92, 1, 16, '#140f0c')
        }
      }

      // Bottom rail shoe + Coffered mezzanine beam fascia
      px(ctx, x0, 106, w, 2, '#1c1511')
      px(ctx, x0, 108, w, 14, '#29201a')
      px(ctx, x0, 108, w, 2, '#4c3b2e')
      for (let cx = x0 + 6; cx < x1 - 24; cx += 28) {
        px(ctx, cx, 111, 22, 8, '#1e1713')
        px(ctx, cx + 1, 112, 20, 6, '#2d231c')
        px(ctx, cx + 1, 112, 20, 1, '#3d3026')
        px(ctx, cx + 1, 117, 20, 1, '#140f0c')
      }
      px(ctx, x0, 120, w, 3, '#130f0c')
    }

    const drawColumn = (x: number, w: number, rimLeft = false, rimRight = false) => {
      // Main timber column shaft with subtle wood grain & fluted channels
      px(ctx, x, 24, w, FLOOR_HORIZON_Y - 24, '#241c17')
      px(ctx, x + 2, 24, Math.max(2, w - 4), FLOOR_HORIZON_Y - 24, '#362a22')
      px(ctx, x + w - 2, 24, 2, FLOOR_HORIZON_Y - 24, '#130e0c')

      if (w >= 20) {
        // Wide dividing arch pier: twin fluted channels + central ridge
        px(ctx, x + 5, 42, 3, 212, '#221a15')
        px(ctx, x + 8, 42, 1, 212, '#44352b')
        px(ctx, x + 11, 42, 2, 212, '#3d2f26')
        px(ctx, x + 15, 42, 3, 212, '#221a15')
        px(ctx, x + 18, 42, 1, 212, '#44352b')
      } else {
        // Inner column: central carved fluting groove + lit bevel ridge
        const mid = x + Math.floor(w / 2)
        px(ctx, mid - 1, 42, 2, 212, '#231b16')
        px(ctx, mid + 1, 42, 1, 212, '#433429')
      }

      // Subtle vertical wood-grain variations
      for (let gy = 44; gy < 252; gy += 7) {
        if (hash2d(x, gy, 881) > 0.45) {
          px(ctx, x + 3, gy, 1, 4, 'rgba(18, 12, 10, 0.35)')
        }
        if (hash2d(x + 4, gy, 883) > 0.5) {
          px(ctx, x + w - 4, gy + 2, 1, 3, 'rgba(255, 218, 178, 0.08)')
        }
      }

      // Stepped timber capitals & carved corbel knee brackets at ceiling & mezzanine levels
      px(ctx, x - 2, 33, w + 4, 3, '#3c2e24')
      px(ctx, x - 1, 36, w + 2, 3, '#281f18')
      px(ctx, x - 3, 39, 3, 3, '#2b211a')
      px(ctx, x - 2, 42, 2, 3, '#1f1713')
      px(ctx, x + w, 39, 3, 3, '#2b211a')
      px(ctx, x + w, 42, 2, 3, '#1f1713')

      // Mezzanine collar trim
      px(ctx, x - 1, 108, w + 2, 3, '#44352a')
      px(ctx, x - 1, 120, w + 2, 3, '#1d1612')
      px(ctx, x - 3, 123, 3, 3, '#2b211a')
      px(ctx, x + w, 123, 3, 3, '#2b211a')

      if (rimLeft) {
        px(ctx, x, 110, 1, 130, 'rgba(255, 198, 128, 0.38)')
      }
      if (rimRight) {
        px(ctx, x + w - 1, 110, 1, 130, 'rgba(255, 198, 128, 0.38)')
      }

      // Multi-tier stone & timber column plinth base + contact shadow
      px(ctx, x - 3, FLOOR_HORIZON_Y - 3, w + 6, 3, 'rgba(6, 5, 8, 0.68)')
      px(ctx, x - 1, 255, w + 2, 4, '#362a22')
      px(ctx, x - 1, 255, w + 2, 1, '#524033')
      px(ctx, x - 2, 259, w + 4, 4, '#2c2b33')
      px(ctx, x - 2, 259, w + 4, 1, '#4a4956')
      px(ctx, x - 2, 263, w + 4, 9, '#19191f')
      px(ctx, x - 1, 264, w + 2, 6, '#23232b')
    }

    const drawSpotFixture = (cx: number, y: number) => {
      px(ctx, cx - 3, y - 4, 6, 2, '#1f1c20')
      px(ctx, cx - 1, y - 2, 2, 3, '#0e0c0d')
      px(ctx, cx - 3, y + 1, 6, 6, '#181519')
      px(ctx, cx - 2, y + 1, 1, 5, '#3b3640')
      px(ctx, cx - 2, y + 7, 4, 2, '#ffe1a6')
      px(ctx, cx - 1, y + 7, 2, 1, '#fff8dc')
    }

    const drawSkylight = (cx: number, spanW: number) => {
      const sx0 = cx - Math.round(spanW / 2)
      px(ctx, sx0 - 6, 0, spanW + 12, 23, '#0b0d13')
      px(ctx, sx0 - 4, 1, spanW + 8, 20, '#161b25')
      // Cut out transparent skylight panes so parallax sky shows behind!
      ctx.clearRect(sx0, 2, spanW, 17)
      // Translucent cyan glass reflection sheen + diagonal glass glints
      px(ctx, sx0, 2, spanW, 17, 'rgba(84, 168, 232, 0.22)')
      px(ctx, sx0, 2, spanW, 3, 'rgba(176, 228, 255, 0.3)')
      // Skylight mullions (5 bays!) with subtle beveled highlight
      const paneStep = spanW / 5
      for (let i = 0; i <= 5; i++) {
        const mx = Math.round(sx0 + i * paneStep)
        px(ctx, mx - 1, 0, 2, 21, '#121319')
        px(ctx, mx - 1, 2, 1, 17, '#29303e')
        if (i < 5) {
          px(ctx, mx + 3, 4, 4, 1, 'rgba(210, 240, 255, 0.28)')
          px(ctx, mx + 2, 5, 3, 1, 'rgba(210, 240, 255, 0.16)')
        }
      }
      px(ctx, sx0 - 2, 9, spanW + 4, 2, '#121319')
      px(ctx, sx0 - 2, 9, spanW + 4, 1, '#262d3b')
      // Lower skylight sill molding
      px(ctx, sx0 - 6, 19, spanW + 12, 4, '#1b1615')
      px(ctx, sx0 - 5, 19, spanW + 10, 1, '#394150')
      px(ctx, sx0 - 6, 22, spanW + 12, 1, '#0d0a0c')
    }

    const drawSideExhibit = (
      centerX: number,
      paintingCanvas: HTMLCanvasElement,
      mirrorPreviewLeft: boolean,
    ) => {
      const px0 = centerX - 28
      const py0 = 158
      // Multi-tiered museum frame + drop shadow on plaster wall
      px(ctx, px0 - 2, py0 - 1, 56 + 7, 34 + 7, 'rgba(5, 6, 10, 0.58)')
      px(ctx, px0 - 4, py0 - 4, 56 + 8, 34 + 8, '#131011')
      px(ctx, px0 - 3, py0 - 3, 56 + 6, 34 + 6, '#3d3028')
      px(ctx, px0 - 3, py0 - 3, 56 + 6, 1, '#5d4a3c')
      px(ctx, px0 - 2, py0 - 2, 56 + 4, 34 + 4, '#241c18')
      px(ctx, px0 - 1, py0 - 1, 56 + 2, 34 + 2, '#0e0b0c')
      // Corner brass ornaments
      for (const [cx, cy] of [
        [px0 - 3, py0 - 3],
        [px0 + 56 + 2, py0 - 3],
        [px0 - 3, py0 + 34 + 2],
        [px0 + 56 + 2, py0 + 34 + 2],
      ]) {
        px(ctx, cx, cy, 1, 1, '#9c7c48')
      }
      ctx.drawImage(paintingCanvas, px0, py0)

      // Wood cabinet plinth + beveled double cabinet doors + brass pulls
      const bx0 = centerX - 58
      px(ctx, bx0 - 2, 246, 120, 26, 'rgba(5, 5, 8, 0.48)')
      px(ctx, bx0, 246, 116, 26, '#2c221b')
      px(ctx, bx0 - 1, 245, 118, 3, '#4c3b2f')
      px(ctx, bx0 - 1, 245, 118, 1, '#66503f')
      px(ctx, bx0 + 3, 250, 52, 20, '#221914')
      px(ctx, bx0 + 4, 251, 50, 1, '#382a21')
      px(ctx, bx0 + 61, 250, 52, 20, '#221914')
      px(ctx, bx0 + 62, 251, 50, 1, '#382a21')
      px(ctx, bx0 + 51, 257, 2, 3, '#8f7044')
      px(ctx, bx0 + 63, 257, 2, 3, '#8f7044')
      px(ctx, bx0, 270, 116, 2, '#0b090c')

      // Glowing digital display plaque on cabinet
      const qx0 = centerX - 40
      px(ctx, qx0 - 2, 230, 84, 15, '#13161e')
      px(ctx, qx0 - 2, 230, 84, 1, '#323b4d')
      px(ctx, qx0 - 1, 231, 82, 13, '#1e2b3e')
      const thumbX = mirrorPreviewLeft ? qx0 + 2 : qx0 + 50
      const textX = mirrorPreviewLeft ? qx0 + 34 : qx0 + 4
      ctx.drawImage(paintingCanvas, thumbX, 232, 28, 11)
      px(ctx, textX, 233, 24, 2, '#b9dcff')
      px(ctx, textX, 237, 40, 1, '#79a4cf')
      px(ctx, textX, 240, 34, 1, '#648ab3')
    }

    const drawMainExhibit = (
      centerX: number,
      paintingCanvas: HTMLCanvasElement,
      topY: number,
      plinthW: number,
    ) => {
      const pw = paintingCanvas.width
      const ph = paintingCanvas.height
      const px0 = centerX - Math.round(pw / 2)
      // Frame ambient occlusion drop shadow & gilded multi-step frame
      px(ctx, px0 - 3, topY - 2, pw + 9, ph + 9, 'rgba(5, 6, 10, 0.64)')
      px(ctx, px0 - 5, topY - 5, pw + 10, ph + 10, '#131011')
      px(ctx, px0 - 4, topY - 4, pw + 8, ph + 8, '#3f322a')
      px(ctx, px0 - 4, topY - 4, pw + 8, 1, '#614d3f')
      px(ctx, px0 - 2, topY - 2, pw + 4, ph + 4, '#261e19')
      px(ctx, px0 - 1, topY - 1, pw + 2, ph + 2, '#0c0a0b')
      for (const [cx, cy] of [
        [px0 - 4, topY - 4],
        [px0 + pw + 3, topY - 4],
        [px0 - 4, topY + ph + 3],
        [px0 + pw + 3, topY + ph + 3],
      ]) {
        px(ctx, cx, cy, 1, 1, '#aa864c')
      }
      ctx.drawImage(paintingCanvas, px0, topY)

      // Plinth + sculpted wood molding & LED under-glow channel
      const plX = centerX - Math.round(plinthW / 2)
      px(ctx, plX - 2, 247, plinthW + 4, 23, 'rgba(5, 6, 10, 0.54)')
      px(ctx, plX, 246, plinthW, 22, '#2d241e')
      px(ctx, plX - 1, 245, plinthW + 2, 3, '#4c3d32')
      px(ctx, plX - 1, 245, plinthW + 2, 1, '#685343')
      px(ctx, plX + 4, 250, plinthW - 8, 14, '#221a15')
      px(ctx, plX + 5, 251, plinthW - 10, 1, '#392c24')
      // Vertical plinth panel dividers
      for (let div = 1; div <= 2; div++) {
        const dx = plX + Math.round((plinthW * div) / 3)
        px(ctx, dx, 250, 1, 14, '#16110e')
        px(ctx, dx + 1, 250, 1, 14, 'rgba(255, 214, 166, 0.08)')
      }
      px(ctx, plX, 266, plinthW, 4, '#15110f')
      // Crisp glowing LED line under plinth lip
      px(ctx, plX + 2, 265, plinthW - 4, 2, '#ffd088')
    }

    // Build Entrance Hall (x = 0..640, completely front-facing orthographic perspective)
    {
      const o = WING_OFFSETS.entrance
      const cx = o + 320

      // 1F Plaster side bays & Atrium rear wall
      drawPlasterBay(o + 12, o + 194, o + 132)
      drawPlasterBay(o + 446, o + 628, o + 508)
      drawAtriumWall(o + 206, o + 434, cx, [10, 32, 54])

      // 2F Balcony back walls, ornamental trees & balustrades
      drawBalconyWall(o + 12, o + 194)
      drawBalconyWall(o + 446, o + 628)
      addAnimatedTree(o + 84, 106, 0.86, secondFloorTreePalette, 401, true)
      addAnimatedTree(o + 556, 106, 0.86, secondFloorTreePalette, 402, true)
      drawBalconyRailing(o + 12, o + 194)
      drawBalconyRailing(o + 446, o + 628)

      // Skylight & Ceiling Spot fixtures
      drawSkylight(cx, 102)
      drawSpotFixture(cx - 78, 34)
      drawSpotFixture(cx, 34)
      drawSpotFixture(cx + 78, 34)

      // Atrium & Entrance Wall Sconces
      drawWallSconce(o + 220, 174)
      drawWallSconce(o + 420, 174)

      // --- Left Bay: Reception & Ticketing Alcove (x = 56..192) ---
      const recRand = mulberry32(4109)
      // Outer dark walnut alcove portal & crown molding
      px(ctx, 56, 146, 136, 126, '#14100e')
      px(ctx, 58, 150, 132, 122, '#1f1915')
      px(ctx, 56, 145, 136, 3, '#443327')
      px(ctx, 56, 148, 136, 1, '#5e4736')
      // Warm plaster grain & recessed overhead cove light wash inside alcove
      for (let i = 0; i < 180; i++) {
        const gx = 60 + Math.floor(recRand() * 128)
        const gy = 152 + Math.floor(recRand() * 70)
        px(ctx, gx, gy, 1, 1, recRand() > 0.5 ? 'rgba(255, 224, 180, 0.04)' : 'rgba(6, 5, 8, 0.08)')
      }
      for (let y = 150; y < 164; y++) {
        const a = (1 - (y - 150) / 14) * 0.24
        px(ctx, 59, y, 130, 1, `rgba(255, 206, 136, ${a.toFixed(3)})`)
      }

      // Left museum archive & catalog shelving (x = 60..92, y = 152..222)
      px(ctx, 60, 152, 32, 70, '#16110e')
      px(ctx, 61, 153, 30, 68, '#1b1511')
      for (const sy of [169, 187, 205]) {
        // Under-shelf warm LED strip + walnut shelf lip
        px(ctx, 61, sy + 2, 30, 1, 'rgba(255, 208, 138, 0.35)')
        px(ctx, 61, sy + 3, 30, 2, 'rgba(255, 192, 112, 0.1)')
        px(ctx, 60, sy, 32, 2, '#4a382b')
        px(ctx, 60, sy, 32, 1, '#664e3c')
      }
      // Varied catalogs, archival boxes & stoneware display objects across the 3 shelves
      px(ctx, 63, 158, 4, 11, '#c9bea6')
      px(ctx, 68, 160, 4, 9, '#936e56')
      px(ctx, 73, 157, 5, 12, '#d8cfb8')
      px(ctx, 81, 161, 8, 8, '#3f4b5e')
      px(ctx, 82, 163, 6, 4, '#b8a07a')
      px(ctx, 63, 176, 8, 11, '#75563e')
      px(ctx, 64, 178, 6, 7, '#a88c6c')
      px(ctx, 73, 178, 4, 9, '#cfc3ab')
      px(ctx, 78, 177, 4, 10, '#6a7c8f')
      px(ctx, 83, 179, 5, 8, '#dfd4be')
      px(ctx, 64, 195, 6, 10, '#495264')
      px(ctx, 65, 194, 4, 1, '#727c92')
      px(ctx, 73, 194, 5, 11, '#c7b89c')
      px(ctx, 79, 196, 5, 9, '#8b6851')
      px(ctx, 85, 193, 4, 12, '#dfd4be')

      // Framed "From Seed to Garden" 4-Unit Prologue Flow Banner inside alcove + warm radial wash + twin-arm brass picture lamp
      const artGlow = ctx.createRadialGradient(140, 184, 6, 140, 184, 44)
      artGlow.addColorStop(0, 'rgba(242, 201, 119, 0.28)')
      artGlow.addColorStop(1, 'rgba(110, 152, 124, 0)')
      ctx.fillStyle = artGlow
      ctx.fillRect(96, 150, 88, 72)
      px(ctx, 102, 166, 76, 42, '#14100e')
      px(ctx, 104, 168, 72, 38, '#3b2b20')
      px(ctx, 105, 169, 70, 36, '#f4efe2')
      ctx.drawImage(
        this.artworks.prologueBannerCanvas,
        0,
        0,
        this.artworks.prologueBannerCanvas.width,
        this.artworks.prologueBannerCanvas.height,
        106,
        170,
        68,
        34,
      )
      px(ctx, 138, 154, 4, 4, '#47392c')
      px(ctx, 125, 158, 30, 3, '#685239')
      px(ctx, 127, 160, 26, 1, '#ffe4a8')

      // Reception Front Counter (veined slate marble top, recessed amber cove LED, textured fluted walnut + brass kickplate)
      px(ctx, 57, 222, 134, 6, '#2b2d37')
      px(ctx, 57, 222, 134, 2, '#555868')
      px(ctx, 57, 222, 134, 1, '#7b8096')
      for (let mx = 61; mx < 188; mx += 9) {
        px(ctx, mx, 223, 3, 1, 'rgba(218, 228, 248, 0.22)')
        px(ctx, mx + 4, 225, 4, 1, 'rgba(18, 20, 28, 0.35)')
      }
      // Under-counter warm LED cove strip + downward light gradient across walnut flutes
      px(ctx, 59, 228, 130, 2, '#ffe8b4')
      px(ctx, 60, 229, 128, 1, '#fff8de')
      px(ctx, 60, 230, 128, 42, '#281c15')
      for (let wx = 61; wx < 188; wx += 3) {
        const shadeShift = recRand() > 0.5 ? 2 : -2
        const ribCol = shadeShift > 0 ? '#463225' : '#3d2c20'
        px(ctx, wx, 231, 1, 36, '#563e2e')
        px(ctx, wx + 1, 231, 1, 36, ribCol)
        px(ctx, wx + 2, 231, 1, 36, '#1e140f')
        // Occasional wood grain pixel variation
        if (recRand() > 0.35) {
          const gy = 236 + Math.floor(recRand() * 28)
          px(ctx, wx + 1, gy, 1, 3, '#2d2017')
        }
      }
      for (let y = 230; y < 238; y++) {
        const a = (1 - (y - 230) / 8) * 0.32
        px(ctx, 60, y, 128, 1, `rgba(255, 204, 120, ${a.toFixed(3)})`)
      }
      // Brushed brass inlay trim & recessed matte floor plinth
      px(ctx, 60, 267, 128, 1, '#8c6f42')
      px(ctx, 60, 268, 128, 1, '#4f3e24')
      px(ctx, 58, 269, 132, 3, '#100c0b')

      // Detailed Countertop Equipment (lamp glow + banker lamp, workstation UI terminal, scanner, acrylic pamphlet stand)
      const lampPool = ctx.createRadialGradient(83, 218, 2, 83, 220, 18)
      lampPool.addColorStop(0, 'rgba(255, 208, 124, 0.42)')
      lampPool.addColorStop(1, 'rgba(255, 180, 90, 0)')
      ctx.fillStyle = lampPool
      ctx.fillRect(65, 202, 36, 26)
      // Banker lamp: brass base, gooseneck rod, faceted bronze-amber shade
      px(ctx, 78, 220, 10, 2, '#8a6b3d')
      px(ctx, 79, 219, 8, 1, '#c99f5d')
      px(ctx, 82, 209, 2, 10, '#a8834a')
      px(ctx, 75, 205, 16, 5, '#c27b38')
      px(ctx, 76, 204, 14, 1, '#e6a558')
      px(ctx, 77, 208, 12, 2, '#fff1be')
      // Workstation monitor: aluminum neck, sleek display bezel, glowing dashboard UI, keyboard pad
      px(ctx, 118, 220, 10, 2, '#3d4554')
      px(ctx, 122, 218, 2, 3, '#525c6e')
      px(ctx, 110, 204, 24, 15, '#131720')
      px(ctx, 111, 205, 22, 13, '#252c3b')
      px(ctx, 112, 206, 20, 11, '#13283d')
      px(ctx, 112, 206, 20, 2, '#5cc4ff')
      px(ctx, 113, 209, 8, 4, '#2f5d84')
      px(ctx, 123, 209, 8, 7, '#224666')
      px(ctx, 113, 214, 8, 2, '#e8b66c')
      px(ctx, 115, 221, 14, 1, '#50596b')
      // QR/NFC countertop ticket scanner + tiny status LED
      px(ctx, 145, 215, 10, 7, '#212733')
      px(ctx, 146, 216, 8, 4, '#111824')
      px(ctx, 147, 217, 6, 1, '#68ecff')
      px(ctx, 153, 220, 1, 1, '#62ffc4')
      // Acrylic 3-slot museum leaflet stand
      px(ctx, 162, 211, 15, 11, '#2d3544')
      px(ctx, 163, 212, 4, 8, '#6da3d8')
      px(ctx, 168, 211, 4, 9, '#e2b064')
      px(ctx, 173, 213, 3, 7, '#dad2c0')
      px(ctx, 161, 218, 17, 4, '#8da2be')
      px(ctx, 162, 219, 15, 2, '#b6cadf')

      // --- Center Bay: Frosted-Glass Vestibule Aperture (populated with 1-pt Perspective + Real Frosted Blur in buildEntranceFrostedDoors) ---
      px(ctx, 214, 136, 212, 136, '#141923')
      ctx.clearRect(218, 141, 204, 131)

      // Suspended Overhead Illuminated Signboard (Seed Sprout | Algorithmic Tree ->)
      px(ctx, 272, 34, 2, 66, '#1c202a')
      px(ctx, 366, 34, 2, 66, '#1c202a')
      px(ctx, 250, 100, 140, 24, '#14100e')
      px(ctx, 250, 100, 140, 1, '#f2c977')
      px(ctx, 250, 123, 140, 1, '#6e987c')
      px(ctx, 250, 100, 1, 24, '#b5904d')
      px(ctx, 389, 100, 1, 24, '#b5904d')
      // Left seed + sage-green sprout glyph
      px(ctx, 276, 106, 22, 12, '#1f1814')
      px(ctx, 285, 113, 4, 4, '#f2c977')
      px(ctx, 286, 109, 2, 4, '#6e987c')
      px(ctx, 282, 109, 4, 2, '#8ab898')
      px(ctx, 288, 108, 4, 2, '#8ab898')
      // Center dark-red & gold divider
      px(ctx, 320, 105, 1, 14, '#a83c32')
      // Right algorithmic tree node + arrow glyph
      px(ctx, 336, 107, 14, 2, '#f4efe2')
      px(ctx, 338, 109, 2, 6, '#6e987c')
      px(ctx, 342, 109, 2, 6, '#f2c977')
      px(ctx, 346, 109, 2, 6, '#a83c32')
      px(ctx, 335, 115, 16, 2, '#f2c977')
      px(ctx, 357, 111, 10, 2, '#ffd080')
      px(ctx, 363, 109, 2, 6, '#ffd080')
      px(ctx, 365, 110, 2, 4, '#ffd080')

      // --- Right Bay: Self-Service Ticket Kiosk + Feature Poster (x = 446..628) ---
      // Ticket Kiosk (x = 459..489, y = 186..272) — brushed anodized aluminum chassis, glowing 4-tile UI, scanner & stub dispenser
      // Ambient cyan screen glow around upper display
      const kioskGlow = ctx.createRadialGradient(474, 210, 4, 474, 210, 26)
      kioskGlow.addColorStop(0, 'rgba(92, 204, 255, 0.28)')
      kioskGlow.addColorStop(1, 'rgba(60, 168, 255, 0)')
      ctx.fillStyle = kioskGlow
      ctx.fillRect(448, 184, 52, 52)
      // Angled top crown hood + brushed metallic vertical column
      px(ctx, 461, 186, 26, 82, '#1d222d')
      px(ctx, 462, 187, 24, 80, '#262d3b')
      // Left metallic edge chamfer & right edge shadow
      px(ctx, 461, 187, 2, 80, '#444e63')
      px(ctx, 462, 188, 1, 78, '#667491')
      px(ctx, 485, 187, 2, 80, '#12161e')
      // Subtle horizontal brushed-aluminum hairline shading
      for (let ky = 192; ky < 266; ky += 4) {
        px(ctx, 464, ky, 20, 1, 'rgba(180, 200, 232, 0.06)')
      }
      // Top hood header bevel + cyan accent light bar
      px(ctx, 460, 186, 28, 3, '#384152')
      px(ctx, 461, 186, 26, 1, '#687692')
      px(ctx, 468, 190, 12, 1, '#7ce8ff')
      // Recessed touchscreen monitor with anti-glare bezel & interactive UI tiles
      px(ctx, 463, 194, 22, 31, '#0e121a')
      px(ctx, 464, 195, 20, 29, '#193b5c')
      // Diagonal glass glare streak across screen
      for (let gy = 0; gy < 16; gy++) {
        px(ctx, 465 + gy, 196 + gy, 2, 1, 'rgba(218, 246, 255, 0.12)')
      }
      // UI top header, 2x2 feature buttons & mint bottom CTA bar
      px(ctx, 465, 196, 18, 4, '#79d8ff')
      px(ctx, 467, 197, 8, 2, '#dcf7ff')
      px(ctx, 465, 202, 8, 8, '#3689c9')
      px(ctx, 467, 204, 4, 4, '#ffd884')
      px(ctx, 475, 202, 8, 8, '#3689c9')
      px(ctx, 477, 204, 4, 4, '#a6ecff')
      px(ctx, 465, 212, 8, 7, '#2d76b2')
      px(ctx, 466, 214, 6, 3, '#9be8ff')
      px(ctx, 475, 212, 8, 7, '#2d76b2')
      px(ctx, 477, 213, 4, 5, '#fff4cc')
      px(ctx, 465, 220, 18, 3, '#4ef2d4')
      // Sloped keyboard/reader sill receiving cyan screen bounce light
      px(ctx, 462, 225, 24, 3, '#394356')
      px(ctx, 463, 225, 22, 1, '#7ad8ff')
      // Hardware reader bay: QR scan window + NFC contactless pad
      px(ctx, 464, 230, 11, 10, '#12161f')
      px(ctx, 465, 231, 9, 7, '#1b2636')
      px(ctx, 466, 234, 7, 1, '#ff687c')
      px(ctx, 477, 230, 7, 10, '#161b25')
      px(ctx, 479, 232, 3, 3, '#5effe4')
      px(ctx, 479, 237, 3, 1, '#8496b4')
      // Brushed recessed ticket dispensing slot + protruding printed ticket stub
      px(ctx, 466, 244, 16, 7, '#11151d')
      px(ctx, 467, 245, 14, 2, '#07090e')
      px(ctx, 466, 244, 16, 1, '#4c576e')
      px(ctx, 470, 246, 7, 4, '#ece4d0')
      px(ctx, 471, 247, 5, 1, '#c89b52')
      // Lower cabinet service door seam + cooling louvers + heavy stepped plinth
      px(ctx, 464, 254, 20, 12, '#1e2430')
      px(ctx, 465, 255, 18, 10, '#232a38')
      for (let vy = 258; vy <= 262; vy += 2) {
        px(ctx, 468, vy, 12, 1, '#12161e')
      }
      px(ctx, 459, 267, 30, 5, '#131720')
      px(ctx, 459, 267, 30, 1, '#485266')

      // First Hall Main Visual Feature Wall: "生长中的算法树" (The Growing Algorithmic Tree) + Prologue Lectern
      const treeWallGlow = ctx.createRadialGradient(546, 180, 8, 546, 180, 62)
      treeWallGlow.addColorStop(0, 'rgba(242, 201, 119, 0.26)')
      treeWallGlow.addColorStop(0.55, 'rgba(110, 152, 124, 0.14)')
      treeWallGlow.addColorStop(1, 'rgba(20, 16, 14, 0)')
      ctx.fillStyle = treeWallGlow
      ctx.fillRect(496, 118, 100, 140)

      // Outer dark-walnut & ink-black museum shadowbox frame + ivory matting
      px(ctx, 511, 131, 70, 100, '#120e0c')
      px(ctx, 513, 133, 66, 96, '#36261d')
      px(ctx, 515, 135, 62, 92, '#f4efe2') // ivory museum mat border
      px(ctx, 517, 137, 58, 88, '#1a1411')
      // Corner accents in dark red (pruning) & sage green (cultivation)
      px(ctx, 513, 133, 4, 2, '#a83c32')
      px(ctx, 575, 133, 4, 2, '#6e987c')
      px(ctx, 513, 227, 4, 2, '#6e987c')
      px(ctx, 575, 227, 4, 2, '#a83c32')
      ctx.drawImage(
        this.artworks.prologueTreeCanvas,
        0,
        0,
        this.artworks.prologueTreeCanvas.width,
        this.artworks.prologueTreeCanvas.height,
        518,
        138,
        56,
        86,
      )
      // Overhead brass picture lamp casting warm yellow wash
      px(ctx, 544, 122, 4, 4, '#3b2d22')
      px(ctx, 530, 125, 32, 3, '#6e553b')
      px(ctx, 532, 127, 28, 1, '#ffe59e')

      // Prologue Curatorial Statement Lectern below the main visual (x = 516..576, y = 235..270)
      px(ctx, 516, 235, 60, 16, '#1a1411')
      px(ctx, 517, 236, 58, 14, '#f4efe2') // ivory statement card
      px(ctx, 519, 238, 16, 2, '#a83c32') // dark red header bar
      px(ctx, 537, 238, 22, 2, '#6e987c') // sage green sub bar
      px(ctx, 519, 242, 52, 1, '#3a2e25')
      px(ctx, 519, 245, 46, 1, '#59493d')
      px(ctx, 519, 247, 36, 1, '#7a6758')
      // Walnut lectern pedestal + warm brass base trim
      px(ctx, 542, 251, 8, 16, '#261b14')
      px(ctx, 544, 251, 4, 16, '#3d2c21')
      px(ctx, 532, 267, 28, 3, '#17110e')
      px(ctx, 534, 267, 24, 1, '#c89b52')

      // Inner Timber Columns + 1F Potted Trees
      drawColumn(o + 194, 12, true, true)
      drawColumn(o + 434, 12, true, true)
      addAnimatedTree(o + 42, 276, 1.15, firstFloorTreePalette, 403, false)
      addAnimatedTree(o + 596, 276, 1.15, firstFloorTreePalette, 404, false)
    }

    // Build Gallery Wings (West, Center, East)
    const wingSpecs: Array<{
      offset: number
      coolColor: [number, number, number]
      skylightSpan: number
      mainCanvas: HTMLCanvasElement
      mainY: number
      plinthW: number
      leftCanvas: HTMLCanvasElement
      rightCanvas: HTMLCanvasElement
      spotPairDx: number
      seedBase: number
    }> = [
      {
        offset: WING_OFFSETS.west,
        coolColor: [10, 34, 58],
        skylightSpan: 92,
        mainCanvas: this.artworks.westCenterCanvas,
        mainY: 52,
        plinthW: 144,
        leftCanvas: this.artworks.westLeftCanvas,
        rightCanvas: this.artworks.westRightCanvas,
        spotPairDx: 76,
        seedBase: 1000,
      },
      {
        offset: WING_OFFSETS.center,
        coolColor: [12, 30, 56],
        skylightSpan: 100,
        mainCanvas: this.artworks.centerCanvas,
        mainY: 47,
        plinthW: 160,
        leftCanvas: this.artworks.leftCanvas,
        rightCanvas: this.artworks.rightCanvas,
        spotPairDx: 82,
        seedBase: 100,
      },
      {
        offset: WING_OFFSETS.east,
        coolColor: [30, 22, 48],
        skylightSpan: 92,
        mainCanvas: this.artworks.eastCenterCanvas,
        mainY: 52,
        plinthW: 144,
        leftCanvas: this.artworks.eastLeftCanvas,
        rightCanvas: this.artworks.eastRightCanvas,
        spotPairDx: 76,
        seedBase: 2000,
      },
    ]

    for (const w of wingSpecs) {
      const o = w.offset
      const cx = o + 320

      // 1F Plaster walls & Atrium back wall
      drawPlasterBay(o + 12, o + 194, o + 132)
      drawPlasterBay(o + 446, o + 628, o + 508)
      drawAtriumWall(o + 206, o + 434, cx, w.coolColor)

      // 2F Balcony back walls -> 2F potted trees behind rails -> Balcony balustrades & coffered beams
      drawBalconyWall(o + 12, o + 194)
      drawBalconyWall(o + 446, o + 628)
      addAnimatedTree(o + 84, 106, 0.86, secondFloorTreePalette, w.seedBase + 1, true)
      addAnimatedTree(o + 556, 106, 0.86, secondFloorTreePalette, w.seedBase + 2, true)
      drawBalconyRailing(o + 12, o + 194)
      drawBalconyRailing(o + 446, o + 628)

      // Skylight & Spot fixtures
      drawSkylight(cx, w.skylightSpan)
      drawSpotFixture(o + 102, 34)
      drawSpotFixture(cx - w.spotPairDx, 34)
      drawSpotFixture(cx + w.spotPairDx, 34)
      drawSpotFixture(o + 538, 34)
      drawSpotFixture(o + 132, 122)
      drawSpotFixture(o + 508, 122)

      // Atrium warm brass-and-glass wall sconces
      drawWallSconce(o + 220, 174)
      drawWallSconce(o + 420, 174)

      // Exhibits
      drawMainExhibit(cx, w.mainCanvas, w.mainY, w.plinthW)
      drawSideExhibit(o + 132, w.leftCanvas, true)
      drawSideExhibit(o + 508, w.rightCanvas, false)

      // Inner Timber Columns + Grazing Rim Highlights
      drawColumn(o + 194, 12, true, true)
      drawColumn(o + 434, 12, true, true)

      // 1st-Floor Potted Trees
      addAnimatedTree(o + 42, 276, 1.15, firstFloorTreePalette, w.seedBase + 3, false)
      addAnimatedTree(o + 596, 276, 1.15, firstFloorTreePalette, w.seedBase + 4, false)
    }

    // Outer Wing Boundary Columns + Corridor Dividing Arch Piers (x=628..652, 1268..1292, 1908..1932)
    drawColumn(0, 12, false, true)
    drawColumn(WORLD_WIDTH - 12, 12, true, false)

    for (const pierX of [628, 1268, 1908]) {
      drawColumn(pierX, 24, true, true)
      // Carved wooden corbel arch brackets at ceiling & mezzanine girder levels
      px(ctx, pierX - 7, 34, 38, 4, '#2d221b')
      px(ctx, pierX - 7, 34, 38, 1, '#4c3b2e')
      px(ctx, pierX - 5, 38, 34, 4, '#211914')
      px(ctx, pierX - 3, 42, 30, 3, '#16110e')
      px(ctx, pierX - 6, 122, 36, 4, '#2d221b')
      px(ctx, pierX - 6, 122, 36, 1, '#48372b')
      px(ctx, pierX - 4, 126, 32, 3, '#1b1410')
    }

    // Interactive Lighting Control Console & Wardrobe Mirror Plaque in Central Hall
    px(ctx, 1474, 227, 12, 24, 'rgba(6, 5, 9, 0.55)')
    px(ctx, 1475, 228, 10, 22, '#221a14')
    px(ctx, 1475, 228, 10, 1, '#8c6b3f')
    px(ctx, 1476, 229, 8, 18, '#382d23')
    px(ctx, 1477, 230, 6, 16, '#1a1b22')
    px(ctx, 1478, 232, 4, 4, '#ffbf69')
    px(ctx, 1478, 239, 4, 4, '#7cd4ff')
    px(ctx, 1479, 245, 2, 1, '#b58d52')

    px(ctx, 1714, 227, 12, 24, 'rgba(6, 5, 9, 0.55)')
    px(ctx, 1715, 228, 10, 22, '#221a14')
    px(ctx, 1716, 229, 8, 20, '#8d6d43')
    px(ctx, 1716, 229, 8, 1, '#cfa462')
    px(ctx, 1717, 231, 6, 16, '#52708f')
    px(ctx, 1718, 232, 2, 5, '#c7e9ff')
    px(ctx, 1719, 236, 3, 4, '#8db9de')
    px(ctx, 1716, 248, 8, 2, '#5a4328')

    const bgSprite = new Sprite(surfaceToNearestTexture(surf))
    this.bgArchitectureLayer.addChild(
      bgSprite,
      balconyTreeMask,
      balconyTreeContainer,
      floorTreeContainer,
      this.deviceAnimGfx,
    )
  }

  /**
   * 1-point perspective vestibule corridor + optical DoF + real GPU frosted-glass blur
   * for fixed side panes, top transom, and animated sliding double doors.
   */
  private updateFrostedBlurMask(slidePx: number): void {
    const g = this.frostedBlurMaskGfx
    g.clear()
    // Fixed frosted side panels (always blur the left/right corridor bays behind them)
    g.rect(218, 171, 48, 101).fill(0xffffff)
    g.rect(374, 171, 48, 101).fill(0xffffff)
    // Top transom glass (always blurs ceiling beams & skylight behind it)
    g.rect(218, 141, 204, 27).fill(0xffffff)
    // Sliding center double-door glass panes (shrink inward from center as doors open)
    const leafVisibleW = Math.max(0, 51 - slidePx)
    if (leafVisibleW > 0) {
      g.rect(269, 171, leafVisibleW, 101).fill(0xffffff)
      g.rect(320 + slidePx, 171, leafVisibleW, 101).fill(0xffffff)
    }
  }

  private buildEntranceFrostedDoors(): void {
    // Aperture world bounds inside vestibule frame: x = 218..422 (204px), y = 141..272 (131px)
    const ax = 218
    const ay = 141
    const aw = 204
    const ah = 131
    // 8px bleed margin around the aperture so BlurFilter never samples alpha=0 at edges
    const pad = 8
    const sw = aw + pad * 2
    const sh = ah + pad * 2

    // Perspective projection helper in aperture-local coordinates (worldX - ax, worldY - ay)
    const vpX = 102 // world 320
    const vpY = 75 // world 216
    const nearL = -14
    const nearR = 218
    const nearT = -9
    const nearB = 133
    const kZ = 2.1
    const scaleAt = (z: number) => 1 / (1 + kZ * z)
    const projBox = (z: number) => {
      const s = scaleAt(z)
      return {
        s,
        l: vpX + (nearL - vpX) * s,
        r: vpX + (nearR - vpX) * s,
        t: vpY + (nearT - vpY) * s,
        b: vpY + (nearB - vpY) * s,
      }
    }

    const fillTrap = (
      ctx: CanvasRenderingContext2D,
      x0a: number,
      y0a: number,
      x1a: number,
      y1a: number,
      x1b: number,
      y1b: number,
      x0b: number,
      y0b: number,
      fill: string,
    ) => {
      ctx.fillStyle = fill
      ctx.beginPath()
      ctx.moveTo(x0a + pad, y0a + pad)
      ctx.lineTo(x1a + pad, y1a + pad)
      ctx.lineTo(x1b + pad, y1b + pad)
      ctx.lineTo(x0b + pad, y0b + pad)
      ctx.closePath()
      ctx.fill()
    }

    // Helper to stroke crisp 1px perspective lines inside padded surface
    const strokeSeg = (
      ctx: CanvasRenderingContext2D,
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color: string,
      width = 1,
    ) => {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x0 + pad + 0.5, y0 + pad + 0.5)
      ctx.lineTo(x1 + pad + 0.5, y1 + pad + 0.5)
      ctx.stroke()
    }

    // Paint the entire 1-point perspective corridor cleanly up to the crisp end wall (zero fog/mist)
    const paintCorridor = (ctx: CanvasRenderingContext2D) => {
      const far = projBox(1.0)
      const near = projBox(0.0)

      // Dark architectural base across padded canvas so BlurFilter borders never sample alpha=0
      px(ctx, 0, 0, sw, sh, '#161922')

      // 1. Continuous Ceiling, Side Walls, Wainscoting & Terrazzo Floor (z = 0.0 .. 1.0, NO fog lift)
      const slices = 56
      for (let i = 0; i < slices; i++) {
        const z0 = i / slices
        const z1 = (i + 1) / slices
        const b0 = projBox(z0)
        const b1 = projBox(z1)

        // Ceiling: rich dark coffer tone subtly shaded deeper along corridor
        const ceilRgb = lerpColor([24, 27, 36], [19, 22, 31], z0)
        fillTrap(ctx, b0.l, b0.t, b0.r, b0.t, b1.r, b1.t, b1.l, b1.t, ceilRgb)

        // Side walls: crisp warm charcoal museum plaster
        const wallL = lerpColor([33, 35, 46], [28, 30, 41], z0)
        const wallR = lerpColor([30, 32, 43], [25, 27, 38], z0)
        fillTrap(ctx, b0.l, b0.t, b1.l, b1.t, b1.l, b1.b, b0.l, b0.b, wallL)
        fillTrap(ctx, b1.r, b1.t, b0.r, b0.t, b0.r, b0.b, b1.r, b1.b, wallR)

        // Walnut wood wainscoting along lower 28% of side walls
        const wain0Y = b0.t + (b0.b - b0.t) * 0.72
        const wain1Y = b1.t + (b1.b - b1.t) * 0.72
        const wainCol = lerpColor([44, 32, 27], [34, 25, 22], z0)
        fillTrap(ctx, b0.l, wain0Y, b1.l, wain1Y, b1.l, b1.b, b0.l, b0.b, wainCol)
        fillTrap(ctx, b1.r, wain1Y, b0.r, wain0Y, b0.r, b0.b, b1.r, b1.b, wainCol)

        // Polished dark slate-terrazzo floor
        const flCol = lerpColor([19, 22, 31], [16, 19, 27], z0)
        fillTrap(ctx, b1.l, b1.b, b1.r, b1.b, b0.r, b0.b, b0.l, b0.b, flCol)
      }

      // Continuous converging architectural perspective lines right to the far wall corners
      strokeSeg(ctx, near.l, near.t + 16, far.l, far.t + 16 * far.s, 'rgba(130, 146, 178, 0.28)')
      strokeSeg(ctx, near.r, near.t + 16, far.r, far.t + 16 * far.s, 'rgba(130, 146, 178, 0.28)')
      // Wainscot chair-rail molding
      strokeSeg(ctx, near.l, near.t + (near.b - near.t) * 0.72, far.l, far.t + (far.b - far.t) * 0.72, '#5a4337')
      strokeSeg(ctx, near.r, near.t + (near.b - near.t) * 0.72, far.r, far.t + (far.b - far.t) * 0.72, '#5a4337')
      // Skirting / baseboard trim
      strokeSeg(ctx, near.l, near.b - 2, far.l, far.b - 1, '#11141c', 2)
      strokeSeg(ctx, near.r, near.b - 2, far.r, far.b - 1, '#11141c', 2)

      // Converging skylight ribs on ceiling
      for (const offset of [-32, 32]) {
        strokeSeg(
          ctx,
          vpX + offset * near.s,
          near.t,
          vpX + offset * far.s,
          far.t,
          'rgba(110, 176, 245, 0.36)',
        )
      }
      // Illuminated cool skylight ceiling trough running down center axis
      for (let i = 0; i < 24; i++) {
        const z0 = i / 24
        const z1 = (i + 1) / 24
        const b0 = projBox(z0)
        const b1 = projBox(z1)
        const skyAlpha = 0.26 - z0 * 0.08
        fillTrap(
          ctx,
          vpX - 28 * b0.s,
          b0.t + 2 * b0.s,
          vpX + 28 * b0.s,
          b0.t + 2 * b0.s,
          vpX + 28 * b1.s,
          b1.t + 2 * b1.s,
          vpX - 28 * b1.s,
          b1.t + 2 * b1.s,
          `rgba(84, 162, 246, ${skyAlpha.toFixed(3)})`,
        )
      }

      // Strong 1-point perspective floor tile seams right up to the end wall
      for (const u of [-96, -72, -48, -24, 0, 24, 48, 72, 96]) {
        const xN = vpX + u * near.s
        const xF = vpX + u * far.s
        strokeSeg(ctx, xN, near.b, xF, far.b, 'rgba(84, 108, 146, 0.34)')
        strokeSeg(ctx, xN + 1, near.b, xF + 0.4, far.b, 'rgba(176, 212, 255, 0.08)')
      }
      for (const fz of [0.05, 0.12, 0.21, 0.32, 0.45, 0.6, 0.77, 0.94]) {
        const b = projBox(fz)
        strokeSeg(ctx, b.l, b.b, b.r, b.b, 'rgba(96, 122, 162, 0.36)')
        strokeSeg(ctx, b.l, b.b + 1, b.r, b.b + 1, 'rgba(182, 216, 255, 0.1)')
      }

      // Center floor specular shimmer strips (cool skylight + warm end-wall hero art reflection)
      for (let i = 0; i < 24; i++) {
        const z0 = i / 24
        const z1 = (i + 1) / 24
        const b0 = projBox(z0)
        const b1 = projBox(z1)
        const sheen = 0.06 + z0 * 0.12
        fillTrap(
          ctx,
          vpX - 32 * b0.s,
          b0.b,
          vpX + 32 * b0.s,
          b0.b,
          vpX + 32 * b1.s,
          b1.b,
          vpX - 32 * b1.s,
          b1.b,
          `rgba(96, 164, 236, ${(sheen * 0.65).toFixed(3)})`,
        )
        fillTrap(
          ctx,
          vpX - 18 * b0.s,
          b0.b,
          vpX + 18 * b0.s,
          b0.b,
          vpX + 18 * b1.s,
          b1.b,
          vpX - 18 * b1.s,
          b1.b,
          `rgba(248, 188, 118, ${(sheen * 0.75).toFixed(3)})`,
        )
      }

      // 2. Four Alternating Gallery Bays along Left & Right Walls (up to the end wall)
      const bayDefs = [
        { zStart: 0.07, zEnd: 0.19, artA: [188, 110, 82], artB: [76, 118, 184], hasPlant: true },
        { zStart: 0.23, zEnd: 0.38, artA: [122, 164, 212], artB: [212, 148, 86], hasPlant: false },
        { zStart: 0.42, zEnd: 0.59, artA: [176, 126, 206], artB: [98, 152, 216], hasPlant: true },
        { zStart: 0.63, zEnd: 0.82, artA: [216, 152, 92], artB: [82, 114, 168], hasPlant: false },
      ]

      for (const bay of bayDefs) {
        const bA = projBox(bay.zStart)
        const bB = projBox(bay.zEnd)
        const yTopA = bA.t + (bA.b - bA.t) * 0.23
        const yBotA = bA.t + (bA.b - bA.t) * 0.62
        const yTopB = bB.t + (bB.b - bB.t) * 0.23
        const yBotB = bB.t + (bB.b - bB.t) * 0.62

        for (const isRight of [false, true]) {
          const xOut = isRight ? bA.r : bA.l
          const xIn = isRight ? bB.r : bB.l
          const framePad = Math.max(1.2, 3 * bA.s)
          fillTrap(
            ctx,
            xOut,
            yTopA - framePad,
            xIn,
            yTopB - framePad * 0.8,
            xIn,
            yBotB + framePad * 0.8,
            xOut,
            yBotA + framePad,
            '#181c28',
          )
          const yMidA = (yTopA + yBotA) * 0.5
          const yMidB = (yTopB + yBotB) * 0.5
          fillTrap(
            ctx,
            xOut + (isRight ? -1 : 1),
            yTopA,
            xIn + (isRight ? 1 : -1),
            yTopB,
            xIn + (isRight ? 1 : -1),
            yMidB,
            xOut + (isRight ? -1 : 1),
            yMidA,
            `rgb(${bay.artA[0]}, ${bay.artA[1]}, ${bay.artA[2]})`,
          )
          fillTrap(
            ctx,
            xOut + (isRight ? -1 : 1),
            yMidA,
            xIn + (isRight ? 1 : -1),
            yMidB,
            xIn + (isRight ? 1 : -1),
            yBotB,
            xOut + (isRight ? -1 : 1),
            yBotA,
            `rgb(${bay.artB[0]}, ${bay.artB[1]}, ${bay.artB[2]})`,
          )
          // Warm picture-lamp light wash above painting
          fillTrap(
            ctx,
            xOut,
            yTopA - 5 * bA.s,
            xIn,
            yTopB - 4 * bB.s,
            xIn,
            yTopB,
            xOut,
            yTopA,
            'rgba(255, 214, 146, 0.34)',
          )
          // Floor reflection of glowing painting
          fillTrap(
            ctx,
            xOut + (isRight ? -6 * bA.s : 6 * bA.s),
            bA.b,
            xIn + (isRight ? -4 * bB.s : 4 * bB.s),
            bB.b,
            xIn,
            bB.b,
            xOut,
            bA.b,
            'rgba(210, 174, 134, 0.16)',
          )

          if (bay.hasPlant) {
            const pX = Math.round(pad + (xOut + xIn) * 0.5 + (isRight ? -4 * bA.s : 4 * bA.s))
            const pY = Math.round(pad + (bA.b + bB.b) * 0.5)
            const pW = Math.max(4, Math.round(10 * bA.s))
            const pH = Math.max(5, Math.round(12 * bA.s))
            px(ctx, pX - Math.floor(pW / 2), pY - Math.max(3, Math.round(pH * 0.45)), pW, Math.max(3, Math.round(pH * 0.45)), '#4f5564')
            px(ctx, pX - Math.floor(pW * 0.65), pY - pH, Math.round(pW * 1.3), Math.max(4, Math.round(pH * 0.62)), '#31583a')
            px(ctx, pX - Math.floor(pW * 0.45), pY - pH + 1, Math.round(pW * 0.9), Math.max(2, Math.round(pH * 0.35)), '#497d4d')
          }
        }
      }

      // 3. Five Receding Timber Beams, Side Columns, Pendant Downlights & Brass Sconces
      const pierDepths = [0.05, 0.21, 0.40, 0.61, 0.84]
      for (const pz of pierDepths) {
        const b = projBox(pz)
        const s = b.s
        const pierW = Math.max(3, Math.round(12 * s))
        const beamH = Math.max(3, Math.round(11 * s))
        const timberFill = lerpColor([46, 33, 27], [37, 27, 23], pz)
        const timberHi = lerpColor([82, 58, 44], [64, 46, 36], pz)

        // Overhead timber beam spanning full corridor width
        px(ctx, Math.round(pad + b.l), Math.round(pad + b.t), Math.ceil(b.r - b.l), beamH, timberFill)
        px(ctx, Math.round(pad + b.l), Math.round(pad + b.t + beamH - 1), Math.ceil(b.r - b.l), 1, timberHi)
        // Small pendant ceiling downlight centered on beam
        const dlW = Math.max(2, Math.round(6 * s))
        const dlH = Math.max(2, Math.round(5 * s))
        px(ctx, Math.round(pad + vpX - dlW / 2), Math.round(pad + b.t + beamH), dlW, dlH, '#161b26')
        px(ctx, Math.round(pad + vpX - dlW / 2), Math.round(pad + b.t + beamH + dlH - 1), dlW, 1, '#ffdba0')

        // Left & Right architectural columns
        const colH = Math.ceil(b.b - b.t)
        px(ctx, Math.round(pad + b.l), Math.round(pad + b.t), pierW, colH, timberFill)
        px(ctx, Math.round(pad + b.l + pierW - 1), Math.round(pad + b.t), 1, colH, timberHi)
        px(ctx, Math.round(pad + b.r - pierW), Math.round(pad + b.t), pierW, colH, timberFill)
        px(ctx, Math.round(pad + b.r - pierW), Math.round(pad + b.t), 1, colH, timberHi)

        // Glowing brass wall sconce mounted inside each pier
        const scY = Math.round(pad + b.t + colH * 0.45)
        const scH = Math.max(4, Math.round(11 * s))
        const scW = Math.max(2, Math.round(4 * s))
        const scLX = Math.round(pad + b.l + pierW + 1)
        const scRX = Math.round(pad + b.r - pierW - scW - 1)
        const haloR = Math.max(5, Math.round(16 * s))

        const haloGradL = ctx.createRadialGradient(scLX + scW / 2, scY, 1, scLX + scW / 2, scY, haloR)
        haloGradL.addColorStop(0, 'rgba(255, 206, 128, 0.62)')
        haloGradL.addColorStop(1, 'rgba(255, 170, 82, 0)')
        ctx.fillStyle = haloGradL
        ctx.fillRect(scLX - haloR, scY - haloR, haloR * 2, haloR * 2)

        const haloGradR = ctx.createRadialGradient(scRX + scW / 2, scY, 1, scRX + scW / 2, scY, haloR)
        haloGradR.addColorStop(0, 'rgba(255, 206, 128, 0.62)')
        haloGradR.addColorStop(1, 'rgba(255, 170, 82, 0)')
        ctx.fillStyle = haloGradR
        ctx.fillRect(scRX - haloR, scY - haloR, haloR * 2, haloR * 2)

        px(ctx, scLX, scY - Math.floor(scH / 2), scW, scH, '#ffe3a8')
        px(ctx, scLX, scY - Math.floor(scH / 2), scW, Math.max(1, Math.floor(scH * 0.3)), '#ffffff')
        px(ctx, scRX, scY - Math.floor(scH / 2), scW, scH, '#ffe3a8')
        px(ctx, scRX, scY - Math.floor(scH / 2), scW, Math.max(1, Math.floor(scH * 0.3)), '#ffffff')

        const refAlpha = 0.26 * (1 - pz * 0.3)
        px(
          ctx,
          scLX - 1,
          Math.round(pad + b.b),
          scW + 3,
          Math.max(4, Math.round(14 * s)),
          `rgba(255, 186, 102, ${refAlpha.toFixed(3)})`,
        )
        px(
          ctx,
          scRX - 1,
          Math.round(pad + b.b),
          scW + 3,
          Math.max(4, Math.round(14 * s)),
          `rgba(255, 186, 102, ${refAlpha.toFixed(3)})`,
        )
      }

      // 4. Crisp, Solid, Richly Detailed Gallery End Wall (z = 1.0, zero fog)
      const fl = Math.round(pad + far.l)
      const fr = Math.round(pad + far.r)
      const ft = Math.round(pad + far.t)
      const fb = Math.round(pad + far.b)
      const fw = fr - fl
      const fh = fb - ft
      const cx = pad + vpX

      // Subtle vertical warm-charcoal plaster shading on end wall
      for (let py = 0; py < fh; py++) {
        const t = py / Math.max(1, fh - 1)
        const c =
          t < 0.7
            ? lerpColor([31, 35, 48], [41, 45, 60], t / 0.7)
            : lerpColor([41, 45, 60], [34, 37, 50], (t - 0.7) / 0.3)
        px(ctx, fl, ft + py, fw, 1, c)
      }

      // Corner walnut pilasters & top wooden crown beam
      px(ctx, fl, ft, 3, fh, '#33241d')
      px(ctx, fl + 3, ft, 1, fh, '#543e32')
      px(ctx, fr - 3, ft, 3, fh, '#33241d')
      px(ctx, fr - 4, ft, 1, fh, '#543e32')
      px(ctx, fl, ft, fw, 3, '#2d201a')
      px(ctx, fl + 3, ft + 3, fw - 6, 1, '#584134')
      px(ctx, fl + 3, ft + 4, fw - 6, 1, 'rgba(8, 10, 16, 0.55)')

      // Centered ceiling pendant canopy + crisp downward spotlight pool on center exhibition panel
      px(ctx, cx - 3, ft + 3, 6, 2, '#161a24')
      px(ctx, cx - 2, ft + 5, 4, 1, '#ffe4a8')
      const spotGrad = ctx.createRadialGradient(cx, ft + 9, 2, cx, ft + 18, 22)
      spotGrad.addColorStop(0, 'rgba(255, 214, 148, 0.24)')
      spotGrad.addColorStop(1, 'rgba(255, 200, 120, 0)')
      ctx.fillStyle = spotGrad
      ctx.fillRect(fl + 4, ft + 4, fw - 8, fh - 16)

      // Architectural panel molding grooves dividing end wall into center bay + 2 side bays
      px(ctx, fl + 18, ft + 6, 1, fh - 19, 'rgba(18, 21, 30, 0.65)')
      px(ctx, fl + 19, ft + 6, 1, fh - 19, 'rgba(130, 142, 170, 0.16)')
      px(ctx, fr - 19, ft + 6, 1, fh - 19, 'rgba(18, 21, 30, 0.65)')
      px(ctx, fr - 20, ft + 6, 1, fh - 19, 'rgba(130, 142, 170, 0.16)')

      // Continuous walnut wainscoting + 3 beveled wood panels + chair rail + baseboard
      const chairY = fb - 13
      px(ctx, fl + 3, chairY, fw - 6, 1, '#63493b')
      px(ctx, fl + 3, chairY + 1, fw - 6, 1, '#261a15')
      px(ctx, fl + 3, chairY + 2, fw - 6, 9, '#2a1f1a')
      const wainPanels: Array<[number, number]> = [
        [fl + 6, fl + 16],
        [fl + 21, fr - 21],
        [fr - 16, fr - 6],
      ]
      for (const [wpL, wpR] of wainPanels) {
        const wpw = wpR - wpL
        if (wpw >= 6) {
          px(ctx, wpL, chairY + 3, wpw, 6, '#211814')
          px(ctx, wpL + 1, chairY + 4, wpw - 2, 4, '#32251f')
          px(ctx, wpL, chairY + 8, wpw, 1, '#49362d')
        }
      }
      // Solid stone skirting / baseboard & grounded floor contact shadow
      px(ctx, fl, fb - 2, fw, 2, '#12151e')
      px(ctx, fl, fb, fw, 2, 'rgba(6, 8, 14, 0.6)')

      // Left & Right Brass Wall Sconces on the end wall with warm localized wall-wash glow
      const wallSconceXs = [fl + 8, fr - 11]
      const wallSconceY = ft + 15
      for (const sx of wallSconceXs) {
        const sGrad = ctx.createRadialGradient(sx + 1, wallSconceY + 3, 1, sx + 1, wallSconceY + 3, 11)
        sGrad.addColorStop(0, 'rgba(255, 200, 116, 0.56)')
        sGrad.addColorStop(1, 'rgba(255, 172, 84, 0)')
        ctx.fillStyle = sGrad
        ctx.fillRect(sx - 10, wallSconceY - 8, 22, 22)
        px(ctx, sx, wallSconceY, 3, 6, '#ffe5a8')
        px(ctx, sx, wallSconceY + 1, 3, 2, '#ffffff')
        px(ctx, sx, wallSconceY + 6, 3, 1, '#3b2d24')
      }

      // Left & Right Companion Small Framed Vertical Artworks + mini picture lights
      const companionBoxes = [
        { x: fl + 12, topC: '#5d86ba', botC: '#d98f5c' },
        { x: fr - 18, topC: '#7b6ab0', botC: '#e6ae6e' },
      ]
      for (const comp of companionBoxes) {
        px(ctx, comp.x + 1, ft + 9, 4, 1, '#c99b5d')
        px(ctx, comp.x + 2, ft + 10, 2, 1, '#fff0be')
        px(ctx, comp.x, ft + 12, 6, 10, '#141822')
        px(ctx, comp.x + 1, ft + 13, 4, 4, comp.topC)
        px(ctx, comp.x + 1, ft + 17, 4, 4, comp.botC)
      }

      // Centered Hero Exhibition Painting (28x17px framed) + Brass Picture Lamp + Gold Title Plaque
      const heroW = 24
      const heroH = 14
      const heroX = cx - Math.floor(heroW / 2)
      const heroY = ft + 10
      // Brass picture light bar above frame
      px(ctx, cx - 5, heroY - 4, 10, 1, '#b88b4e')
      px(ctx, cx - 4, heroY - 3, 8, 1, '#ffefc2')
      // Frame + brass fillet + artwork canvas
      px(ctx, heroX - 2, heroY - 2, heroW + 4, heroH + 4, '#131620')
      px(ctx, heroX - 1, heroY - 1, heroW + 2, heroH + 2, '#7d623f')
      for (let py = 0; py < heroH; py++) {
        const t = py / (heroH - 1)
        const c =
          t < 0.42
            ? lerpColor([42, 68, 128], [164, 92, 146], t / 0.42)
            : lerpColor([236, 152, 92], [52, 74, 134], (t - 0.42) / 0.58)
        px(ctx, heroX, heroY + py, heroW, 1, c)
      }
      // Crisp miniature landscape details inside center painting: moon star, floating cliff, citadel light & water shimmer
      px(ctx, heroX + 4, heroY + 2, 1, 1, '#fff4cf')
      px(ctx, heroX + 18, heroY + 3, 1, 1, '#dbe8ff')
      px(ctx, heroX + 9, heroY + 5, 6, 4, '#27203d')
      px(ctx, heroX + 11, heroY + 3, 2, 3, '#ffdf96')
      px(ctx, heroX + 10, heroY + 9, 4, 1, '#6cc4ee')
      px(ctx, heroX + 8, heroY + 11, 8, 1, '#f4c07a')
      // Gold curatorial exhibition plaque beside bottom-right of hero frame
      px(ctx, heroX + heroW + 3, heroY + heroH - 2, 2, 2, '#d8b068')

      // Grounded Gallery Props along the End Wall: Centered Upholstered Bench + Two Corner Planters
      // Centered low walnut & upholstered museum bench resting flush on floor line fb
      const benchX = cx - 9
      const benchW = 18
      const benchTopY = fb - 4
      px(ctx, benchX - 1, fb, benchW + 2, 2, 'rgba(5, 7, 12, 0.65)')
      px(ctx, benchX + 1, benchTopY + 3, 2, 2, '#131722')
      px(ctx, benchX + benchW - 3, benchTopY + 3, 2, 2, '#131722')
      px(ctx, benchX, benchTopY + 2, benchW, 1, '#443026')
      px(ctx, benchX, benchTopY, benchW, 2, '#7a5d4c')
      px(ctx, benchX + 1, benchTopY, benchW - 2, 1, '#987762')

      // Left & Right corner potted greenery against the pilasters
      for (const pxCenter of [fl + 6, fr - 7]) {
        px(ctx, pxCenter - 2, fb, 5, 1, 'rgba(5, 7, 12, 0.55)')
        px(ctx, pxCenter - 2, fb - 4, 4, 4, '#545c6e')
        px(ctx, pxCenter - 2, fb - 4, 4, 1, '#7a8398')
        px(ctx, pxCenter - 3, fb - 9, 6, 5, '#2b5837')
        px(ctx, pxCenter - 2, fb - 10, 4, 4, '#47824d')
        px(ctx, pxCenter - 1, fb - 9, 2, 2, '#629c5e')
      }

      // Crisp subtle end-wall reflections on the polished floor directly in front (fb..fb+10)
      for (let fy = 0; fy < 10; fy++) {
        const a = (0.24 * (1 - fy / 10)).toFixed(3)
        px(ctx, cx - 10, fb + fy, 20, 1, `rgba(244, 178, 108, ${a})`)
        px(ctx, fl + 7, fb + fy, 5, 1, `rgba(255, 198, 118, ${(Number(a) * 0.85).toFixed(3)})`)
        px(ctx, fr - 12, fb + fy, 5, 1, `rgba(255, 198, 118, ${(Number(a) * 0.85).toFixed(3)})`)
      }
    }

    // --- Layer 1: Crisp Un-fogged Perspective Corridor & Detailed End Wall ---
    const corridorSurf = createPixelSurface(sw, sh)
    paintCorridor(corridorSurf.ctx)
    const corridorTex = surfaceToNearestTexture(corridorSurf)
    const corridorSharpSprite = new Sprite(corridorTex)
    corridorSharpSprite.position.set(ax - pad, ay - pad)

    // Aperture clip mask for unblurred interior corridor
    const interiorClipMask = new Graphics()
    interiorClipMask.rect(ax, ay, aw, ah).fill(0xffffff)
    const corridorSharpContainer = new Container()
    corridorSharpContainer.mask = interiorClipMask
    corridorSharpContainer.addChild(corridorSharpSprite)

    // --- Layer 2: Real GPU Frosted-Glass Blur of Full Interior Scenery ---
    const corridorBlurredSprite = new Sprite(corridorTex)
    corridorBlurredSprite.position.set(ax - pad, ay - pad)
    corridorBlurredSprite.filters = [new BlurFilter({ strength: 5.2, quality: 4 })]

    const corridorBlurredContainer = new Container()
    corridorBlurredContainer.mask = this.frostedBlurMaskGfx
    this.updateFrostedBlurMask(0)
    corridorBlurredContainer.addChild(corridorBlurredSprite)

    this.bgArchitectureLayer.addChild(
      interiorClipMask,
      corridorSharpContainer,
      this.frostedBlurMaskGfx,
      corridorBlurredContainer,
    )

    // --- Layer 4: Semi-Transparent Moving Frosted Double Door Leaves ---
    const doorW = 51
    const doorH = 101
    const buildDoorLeaf = (isLeft: boolean): Sprite => {
      const leafSurf = createPixelSurface(doorW, doorH)
      const ctx = leafSurf.ctx
      const rand = mulberry32(isLeft ? 8301 : 8302)

      // Translucent frosted glass tint so the GPU-blurred corridor shines genuinely through
      for (let y = 0; y < doorH; y++) {
        const t = y / (doorH - 1)
        const r = Math.round(32 + t * 14)
        const g = Math.round(58 + t * 14)
        const b = Math.round(92 - t * 10)
        px(ctx, 0, y, doorW, 1, `rgba(${r}, ${g}, ${b}, 0.28)`)
      }

      // Frosted diagonal refraction streaks + micro-etched grain
      for (let y = 6; y < doorH - 6; y += 2) {
        const bandX = isLeft ? 7 + ((y * 0.42) % 18) : 22 - ((y * 0.36) % 16)
        px(ctx, Math.round(bandX), y, 14, 1, 'rgba(186, 228, 255, 0.1)')
      }
      for (let i = 0; i < 320; i++) {
        const gx = 2 + Math.floor(rand() * (doorW - 4))
        const gy = 2 + Math.floor(rand() * (doorH - 4))
        px(ctx, gx, gy, 1, 1, rand() > 0.4 ? 'rgba(218, 240, 255, 0.14)' : 'rgba(12, 20, 36, 0.14)')
      }

      // Horizontal safety glaze stripe across mid-glass
      px(ctx, 3, 52, doorW - 6, 1, 'rgba(210, 236, 255, 0.18)')
      px(ctx, 3, 55, doorW - 6, 1, 'rgba(210, 236, 255, 0.1)')

      // Crisp etched inner border & opaque brushed dark-steel door frame
      px(ctx, 5, 5, doorW - 10, 1, 'rgba(176, 224, 255, 0.28)')
      px(ctx, 5, doorH - 6, doorW - 10, 1, 'rgba(255, 214, 152, 0.22)')
      px(ctx, 0, 0, doorW, 3, '#232836')
      px(ctx, 0, doorH - 3, doorW, 3, '#1a1e29')
      px(ctx, 0, 0, 2, doorH, '#232836')
      px(ctx, doorW - 2, 0, 2, doorH, '#232836')

      if (isLeft) {
        px(ctx, doorW - 1, 0, 1, doorH, '#0e121a')
        px(ctx, doorW - 7, 39, 2, 24, '#9ab0ca')
        px(ctx, doorW - 6, 40, 1, 22, '#dcecff')
      } else {
        px(ctx, 0, 0, 1, doorH, '#0e121a')
        px(ctx, 5, 39, 2, 24, '#9ab0ca')
        px(ctx, 6, 40, 1, 22, '#dcecff')
      }

      const sp = new Sprite(surfaceToNearestTexture(leafSurf))
      sp.position.set(isLeft ? 269 : 320, 171)
      return sp
    }

    this.leftDoorSprite = buildDoorLeaf(true)
    this.rightDoorSprite = buildDoorLeaf(false)

    const apertureMask = new Graphics()
    apertureMask.rect(269, 171, 102, 101).fill(0xffffff)
    this.entranceDoorContainer.mask = apertureMask
    this.entranceDoorContainer.addChild(this.leftDoorSprite, this.rightDoorSprite)
    this.bgArchitectureLayer.addChild(apertureMask, this.entranceDoorContainer)

    // --- Layer 5: Fixed Side/Transom Frosted Surface Sheen + Crisp Steel Mullions ---
    const overlaySurf = createPixelSurface(aw, ah)
    const octx = overlaySurf.ctx
    const randO = mulberry32(9412)

    // Translucent frosted milk-glass glaze over left side (0..48), right side (156..204), top transom (0..204, 0..27)
    const fixedZones: Array<[number, number, number, number]> = [
      [0, 30, 48, 101],
      [156, 30, 48, 101],
      [0, 0, 204, 27],
    ]
    for (const [zx, zy, zw, zh] of fixedZones) {
      px(octx, zx, zy, zw, zh, 'rgba(34, 58, 86, 0.22)')
      // Subtle frost diagonal highlight streaks
      for (let y = zy + 3; y < zy + zh - 3; y += 2) {
        const bx = zx + ((y * 3 + zx) % Math.max(8, zw - 14))
        px(octx, bx, y, Math.min(12, zx + zw - bx), 1, 'rgba(184, 226, 255, 0.09)')
      }
      // Micro-frosted crystal stipple
      const grains = Math.round((zw * zh) / 14)
      for (let i = 0; i < grains; i++) {
        const gx = zx + 1 + Math.floor(randO() * Math.max(1, zw - 2))
        const gy = zy + 1 + Math.floor(randO() * Math.max(1, zh - 2))
        px(octx, gx, gy, 1, 1, randO() > 0.45 ? 'rgba(218, 240, 255, 0.14)' : 'rgba(10, 18, 32, 0.14)')
      }
      // Subtle etched inner highlight
      px(octx, zx + 2, zy + 2, zw - 4, 1, 'rgba(176, 224, 255, 0.22)')
    }

    // Safety etching bar across fixed left & right frosted glass aligned with sliding doors
    px(octx, 2, 82, 44, 1, 'rgba(210, 236, 255, 0.16)')
    px(octx, 158, 82, 44, 1, 'rgba(210, 236, 255, 0.16)')

    // Crisp opaque steel mullions separating fixed panes, doorway & transom
    // Horizontal transom bar (y = 168..171 -> local y = 27..30)
    px(octx, 0, 27, aw, 3, '#1a202d')
    px(octx, 0, 27, aw, 1, '#3b4861')
    // Vertical left mullion (x = 266..269 -> local x = 48..51)
    px(octx, 48, 0, 3, ah, '#1a202d')
    px(octx, 48, 0, 1, ah, '#38445c')
    // Vertical right mullion (x = 371..374 -> local x = 153..156)
    px(octx, 153, 0, 3, ah, '#1a202d')
    px(octx, 155, 0, 1, ah, '#38445c')
    // Center transom vertical divider aligned above double doors (local x = 101..103)
    px(octx, 101, 0, 2, 27, '#1a202d')

    const vestibuleOverlaySprite = new Sprite(surfaceToNearestTexture(overlaySurf))
    vestibuleOverlaySprite.position.set(ax, ay)
    this.bgArchitectureLayer.addChild(vestibuleOverlaySprite)
  }

  /**
   * Full-screen Blurred 1-point perspective Corridor Stage modeled after the sanctuary behind the
   * entrance doors + crisp foreground terrazzo/brass pedestal for the live character registration view.
   */
  private buildRegistrationCorridorStage(): void {
    const pad = 8
    const cw = SCENE_WIDTH + pad * 2
    const ch = SCENE_HEIGHT + pad * 2
    const surf = createPixelSurface(cw, ch)
    const ctx = surf.ctx

    const vpX = 320
    const vpY = 172
    const nearL = -30
    const nearR = 670
    const nearT = -18
    const nearB = 278
    const kZ = 2.4
    const scaleAt = (z: number) => 1 / (1 + kZ * z)
    const proj = (z: number) => {
      const s = scaleAt(z)
      return {
        s,
        l: vpX + (nearL - vpX) * s,
        r: vpX + (nearR - vpX) * s,
        t: vpY + (nearT - vpY) * s,
        b: vpY + (nearB - vpY) * s,
      }
    }

    const fillQuad = (
      x0a: number,
      y0a: number,
      x1a: number,
      y1a: number,
      x1b: number,
      y1b: number,
      x0b: number,
      y0b: number,
      color: string,
    ) => {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x0a + pad, y0a + pad)
      ctx.lineTo(x1a + pad, y1a + pad)
      ctx.lineTo(x1b + pad, y1b + pad)
      ctx.lineTo(x0b + pad, y0b + pad)
      ctx.closePath()
      ctx.fill()
    }

    const strokeLine = (x0: number, y0: number, x1: number, y1: number, color: string, width = 1) => {
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x0 + pad + 0.5, y0 + pad + 0.5)
      ctx.lineTo(x1 + pad + 0.5, y1 + pad + 0.5)
      ctx.stroke()
    }

    px(ctx, 0, 0, cw, ch, '#12151f')

    // Continuous 1-point perspective ceiling, charcoal walls, walnut wainscoting & dark terrazzo floor
    const near = proj(0)
    const far = proj(1)
    const slices = 56
    for (let i = 0; i < slices; i++) {
      const z0 = i / slices
      const z1 = (i + 1) / slices
      const b0 = proj(z0)
      const b1 = proj(z1)

      fillQuad(b0.l, b0.t, b0.r, b0.t, b1.r, b1.t, b1.l, b1.t, lerpColor([22, 26, 36], [18, 21, 30], z0))
      fillQuad(b0.l, b0.t, b1.l, b1.t, b1.l, b1.b, b0.l, b0.b, lerpColor([31, 34, 46], [26, 29, 40], z0))
      fillQuad(b1.r, b1.t, b0.r, b0.t, b0.r, b0.b, b1.r, b1.b, lerpColor([28, 31, 43], [23, 26, 37], z0))

      const w0Y = b0.t + (b0.b - b0.t) * 0.72
      const w1Y = b1.t + (b1.b - b1.t) * 0.72
      const wain = lerpColor([44, 31, 26], [32, 23, 20], z0)
      fillQuad(b0.l, w0Y, b1.l, w1Y, b1.l, b1.b, b0.l, b0.b, wain)
      fillQuad(b1.r, w1Y, b0.r, w0Y, b0.r, b0.b, b1.r, b1.b, wain)

      fillQuad(b1.l, b1.b, b1.r, b1.b, b0.r, b0.b, b0.l, b0.b, lerpColor([18, 22, 32], [14, 17, 25], z0))
    }

    // Extended deep foreground stone floor downward to bottom of screen
    px(ctx, 0, pad + nearB - 2, cw, ch - (pad + nearB - 2), '#111520')

    // Architectural perspective moldings & center skylight blue trough
    strokeLine(near.l, near.t + 26, far.l, far.t + 26 * far.s, 'rgba(136, 154, 186, 0.3)')
    strokeLine(near.r, near.t + 26, far.r, far.t + 26 * far.s, 'rgba(136, 154, 186, 0.3)')
    strokeLine(near.l, near.t + (near.b - near.t) * 0.72, far.l, far.t + (far.b - far.t) * 0.72, '#5c4438', 1.5)
    strokeLine(near.r, near.t + (near.b - near.t) * 0.72, far.r, far.t + (far.b - far.t) * 0.72, '#5c4438', 1.5)
    strokeLine(near.l, near.b - 2, far.l, far.b - 1, '#0e1118', 2)
    strokeLine(near.r, near.b - 2, far.r, far.b - 1, '#0e1118', 2)

    for (let i = 0; i < 24; i++) {
      const z0 = i / 24
      const z1 = (i + 1) / 24
      const b0 = proj(z0)
      const b1 = proj(z1)
      const a = 0.34 - z0 * 0.1
      fillQuad(
        vpX - 78 * b0.s,
        b0.t + 4 * b0.s,
        vpX + 78 * b0.s,
        b0.t + 4 * b0.s,
        vpX + 78 * b1.s,
        b1.t + 4 * b1.s,
        vpX - 78 * b1.s,
        b1.t + 4 * b1.s,
        `rgba(84, 166, 250, ${a.toFixed(3)})`,
      )
    }

    // Radial perspective floor grout lines extending all the way into bottom foreground
    for (const u of [-300, -220, -140, -70, 0, 70, 140, 220, 300]) {
      const xF = vpX + u * far.s
      const xNear = vpX + u * near.s
      const dx = xNear - xF
      const dy = near.b - far.b
      const extT = (SCENE_HEIGHT + 20 - far.b) / Math.max(1, dy)
      strokeLine(xF, far.b, xF + dx * extT, far.b + dy * extT, 'rgba(92, 116, 156, 0.32)')
    }
    for (const fz of [0.06, 0.14, 0.24, 0.36, 0.5, 0.66, 0.84]) {
      const b = proj(fz)
      strokeLine(b.l, b.b, b.r, b.b, 'rgba(98, 124, 164, 0.34)')
    }

    // Center floor cool skylight & amber centerpiece reflection shimmer
    for (let i = 0; i < 24; i++) {
      const z0 = i / 24
      const z1 = (i + 1) / 24
      const b0 = proj(z0)
      const b1 = proj(z1)
      const sheen = 0.08 + z0 * 0.14
      fillQuad(vpX - 88 * b0.s, b0.b, vpX + 88 * b0.s, b0.b, vpX + 88 * b1.s, b1.b, vpX - 88 * b1.s, b1.b, `rgba(98, 174, 248, ${(sheen * 0.62).toFixed(3)})`)
      fillQuad(vpX - 46 * b0.s, b0.b, vpX + 46 * b0.s, b0.b, vpX + 46 * b1.s, b1.b, vpX - 46 * b1.s, b1.b, `rgba(255, 198, 120, ${(sheen * 0.72).toFixed(3)})`)
    }

    // Alternating Gallery Bays (angled paintings, brass picture lights & floor sheen)
    const bays = [
      { z0: 0.06, z1: 0.20, a: [194, 114, 84], b: [76, 122, 190] },
      { z0: 0.24, z1: 0.39, a: [124, 168, 218], b: [216, 152, 92] },
      { z0: 0.43, z1: 0.60, a: [182, 130, 212], b: [98, 154, 222] },
      { z0: 0.64, z1: 0.84, a: [222, 158, 96], b: [84, 118, 174] },
    ]
    for (const bay of bays) {
      const bA = proj(bay.z0)
      const bB = proj(bay.z1)
      const ytA = bA.t + (bA.b - bA.t) * 0.22
      const ybA = bA.t + (bA.b - bA.t) * 0.62
      const ytB = bB.t + (bB.b - bB.t) * 0.22
      const ybB = bB.t + (bB.b - bB.t) * 0.62
      for (const isRight of [false, true]) {
        const xOut = isRight ? bA.r : bA.l
        const xIn = isRight ? bB.r : bB.l
        fillQuad(xOut, ytA - 6 * bA.s, xIn, ytB - 5 * bB.s, xIn, ybB + 5 * bB.s, xOut, ybA + 6 * bA.s, '#171b26')
        fillQuad(xOut, ytA, xIn, ytB, xIn, (ytB + ybB) * 0.5, xOut, (ytA + ybA) * 0.5, `rgb(${bay.a.join(',')})`)
        fillQuad(xOut, (ytA + ybA) * 0.5, xIn, (ytB + ybB) * 0.5, xIn, ybB, xOut, ybA, `rgb(${bay.b.join(',')})`)
        fillQuad(xOut, ytA - 12 * bA.s, xIn, ytB - 9 * bB.s, xIn, ytB, xOut, ytA, 'rgba(255, 214, 146, 0.36)')
      }
    }

    // Five Walnut Beams, Columns & Glowing Brass Sconces
    for (const pz of [0.05, 0.22, 0.41, 0.62, 0.85]) {
      const b = proj(pz)
      const s = b.s
      const pw = Math.max(6, Math.round(28 * s))
      const bh = Math.max(5, Math.round(24 * s))
      const colH = Math.ceil(b.b - b.t)
      px(ctx, Math.round(pad + b.l), Math.round(pad + b.t), Math.ceil(b.r - b.l), bh, '#2d201a')
      px(ctx, Math.round(pad + b.l), Math.round(pad + b.t + bh - 2), Math.ceil(b.r - b.l), 2, '#563e32')
      px(ctx, Math.round(pad + b.l), Math.round(pad + b.t), pw, colH, '#2e211b')
      px(ctx, Math.round(pad + b.r - pw), Math.round(pad + b.t), pw, colH, '#2e211b')

      const scY = Math.round(pad + b.t + colH * 0.45)
      const scLX = Math.round(pad + b.l + pw + 3)
      const scRX = Math.round(pad + b.r - pw - 8)
      const rGlow = Math.max(12, Math.round(36 * s))
      for (const sx of [scLX, scRX]) {
        const g = ctx.createRadialGradient(sx, scY, 2, sx, scY, rGlow)
        g.addColorStop(0, 'rgba(255, 206, 128, 0.68)')
        g.addColorStop(1, 'rgba(255, 170, 82, 0)')
        ctx.fillStyle = g
        ctx.fillRect(sx - rGlow, scY - rGlow, rGlow * 2, rGlow * 2)
        px(ctx, sx - 2, scY - Math.round(10 * s), Math.max(3, Math.round(6 * s)), Math.max(6, Math.round(20 * s)), '#ffe4a8')
      }
    }

    // Crisp Architectural End Wall at z = 1.0
    const fl = Math.round(pad + far.l)
    const fr = Math.round(pad + far.r)
    const ft = Math.round(pad + far.t)
    const fb = Math.round(pad + far.b)
    const fw = fr - fl
    const fh = fb - ft
    const cx = pad + vpX
    px(ctx, fl, ft, fw, fh, '#242838')
    px(ctx, fl, ft, 8, fh, '#33241d')
    px(ctx, fr - 8, ft, 8, fh, '#33241d')
    px(ctx, fl, ft, fw, 6, '#2d201a')
    px(ctx, fl, fb - 26, fw, 26, '#2a1f1a')
    px(ctx, fl, fb - 26, fw, 3, '#63493b')
    px(ctx, fl, fb - 5, fw, 5, '#12151e')
    // Hero painting + picture lamp + twin end-wall sconces
    const hw = 64
    const hh = 36
    const hx = cx - Math.floor(hw / 2)
    const hy = ft + 18
    px(ctx, cx - 12, hy - 6, 24, 2, '#c89b58')
    px(ctx, hx - 3, hy - 3, hw + 6, hh + 6, '#131620')
    for (let py = 0; py < hh; py++) {
      const t = py / (hh - 1)
      px(
        ctx,
        hx,
        hy + py,
        hw,
        1,
        t < 0.45 ? lerpColor([42, 68, 132], [174, 96, 152], t / 0.45) : lerpColor([238, 156, 94], [52, 74, 136], (t - 0.45) / 0.55),
      )
    }
    for (const sx of [fl + 24, fr - 24]) {
      const g = ctx.createRadialGradient(sx, ft + 36, 2, sx, ft + 36, 28)
      g.addColorStop(0, 'rgba(255, 206, 128, 0.7)')
      g.addColorStop(1, 'rgba(255, 170, 82, 0)')
      ctx.fillStyle = g
      ctx.fillRect(sx - 28, ft + 8, 56, 56)
      px(ctx, sx - 3, ft + 30, 6, 14, '#ffe6aa')
    }

    const blurredCorridorSprite = new Sprite(surfaceToNearestTexture(surf))
    blurredCorridorSprite.position.set(-pad, -pad)
    blurredCorridorSprite.filters = [new BlurFilter({ strength: 4.5, quality: 4 })]

    // Subtle dark gradient flanking left/right so the floating UI cards read effortlessly over the DoF corridor
    const sideVignetteSurf = createLinearTexture(SCENE_WIDTH, SCENE_HEIGHT, (vctx, w, h) => {
      const gL = vctx.createLinearGradient(0, 0, w * 0.34, 0)
      gL.addColorStop(0, 'rgba(5, 7, 13, 0.72)')
      gL.addColorStop(1, 'rgba(5, 7, 13, 0)')
      vctx.fillStyle = gL
      vctx.fillRect(0, 0, w * 0.34, h)

      const gR = vctx.createLinearGradient(w, 0, w * 0.66, 0)
      gR.addColorStop(0, 'rgba(5, 7, 13, 0.72)')
      gR.addColorStop(1, 'rgba(5, 7, 13, 0)')
      vctx.fillStyle = gR
      vctx.fillRect(w * 0.66, 0, w * 0.34, h)
    })
    const sideVignetteSprite = new Sprite(sideVignetteSurf)

    this.regBackdropLayer.addChild(blurredCorridorSprite, sideVignetteSprite)

    // Crisp foreground polished terrazzo & brass registration pedestal stage (added inside reflectionLayer before heroReflectionSlot)
    const floorH = SCENE_HEIGHT - FLOOR_HORIZON_Y
    const pedSurf = createPixelSurface(SCENE_WIDTH, floorH)
    const pctx = pedSurf.ctx
    // Soft horizon feather blending blurred corridor floor smoothly into crisp foreground stone
    for (let y = 0; y < floorH; y++) {
      const alpha = y < 18 ? (y / 18) * 0.88 : 0.88
      const c = lerpColor([18, 22, 32], [8, 10, 16], y / (floorH - 1))
      pctx.fillStyle = c
      pctx.globalAlpha = alpha
      pctx.fillRect(0, y, SCENE_WIDTH, 1)
    }
    pctx.globalAlpha = 1

    // Radial perspective stone grout seams across registration foreground floor
    const stageVpY = 172 - FLOOR_HORIZON_Y
    for (let i = -8; i <= 8; i++) {
      const x1 = 320 + i * 36
      const dx = x1 - 320
      const x2 = 320 + dx * ((floorH - stageVpY) / (26 - stageVpY))
      pctx.strokeStyle = 'rgba(84, 108, 146, 0.32)'
      pctx.lineWidth = 1
      pctx.beginPath()
      pctx.moveTo(x1 + 0.5, 20)
      pctx.lineTo(x2 + 0.5, floorH)
      pctx.stroke()
    }
    for (const fy of [22, 34, 49, 68]) {
      pctx.fillStyle = 'rgba(92, 118, 158, 0.3)'
      pctx.fillRect(0, fy, SCENE_WIDTH, 1)
    }

    // Centerpiece brass inlaid ring & warm-cyan spotlight pool beneath hero's feet (320, 296 -> local y = 24)
    const glowG = pctx.createRadialGradient(320, 28, 4, 320, 28, 72)
    glowG.addColorStop(0, 'rgba(130, 212, 255, 0.32)')
    glowG.addColorStop(0.5, 'rgba(244, 198, 120, 0.16)')
    glowG.addColorStop(1, 'rgba(10, 14, 24, 0)')
    pctx.fillStyle = glowG
    pctx.fillRect(220, 0, 200, floorH)

    pctx.strokeStyle = 'rgba(232, 196, 122, 0.65)'
    pctx.lineWidth = 1.5
    pctx.beginPath()
    pctx.ellipse(320, 25, 34, 8, 0, 0, Math.PI * 2)
    pctx.stroke()

    pctx.strokeStyle = 'rgba(126, 224, 255, 0.38)'
    pctx.lineWidth = 1
    pctx.beginPath()
    pctx.ellipse(320, 25, 44, 10.5, 0, 0, Math.PI * 2)
    pctx.stroke()

    this.regPedestalFloorSprite = new Sprite(surfaceToNearestTexture(pedSurf))
    this.regPedestalFloorSprite.position.set(0, FLOOR_HORIZON_Y)
  }

  private buildAnimatedArtworkOverlays(): void {
    // Center Hall painting canvas starts at (1543, 47)
    this.waterfallAnimGfx.position.set(1543, 47)
    this.starAnimGfx.position.set(1543, 47)
    // West & East main paintings start at (912, 52) and (2192, 52)
    this.westAnimGfx.position.set(912, 52)
    this.eastAnimGfx.position.set(2192, 52)
  }

  private buildFloorAndReflections(): void {
    const floorH = SCENE_HEIGHT - FLOOR_HORIZON_Y
    const floorSurf = createPixelSurface(WORLD_WIDTH, floorH)
    const { ctx } = floorSurf

    // 1. Dark Obsidian Slate Floor Base across all 1920px
    for (let y = 0; y < floorH; y++) {
      const t = y / (floorH - 1)
      const c = lerpColor([20, 24, 34], [9, 11, 16], t)
      px(ctx, 0, y, WORLD_WIDTH, 1, c)
    }
    // Corridor Archway Brass & Basalt Floor Threshold Strips
    for (const tx of [637, 1277, 1917]) {
      px(ctx, tx - 2, 0, 10, floorH, 'rgba(6, 7, 11, 0.55)')
      px(ctx, tx, 0, 6, floorH, '#2b241d')
      px(ctx, tx + 1, 0, 1, floorH, '#4a3a2c')
      px(ctx, tx + 2, 0, 2, floorH, '#8c6f42')
      px(ctx, tx + 4, 0, 1, floorH, '#201914')
    }
    const baseSprite = new Sprite(surfaceToNearestTexture(floorSurf))
    baseSprite.position.set(0, FLOOR_HORIZON_Y)
    this.floorBaseSprite = baseSprite
    this.floorLayer.addChild(baseSprite)

    // 2. Anisotropic Glossy Floor Reflections
    const reflSurf = createPixelSurface(WORLD_WIDTH, floorH)
    const rctx = reflSurf.ctx

    const drawCanvasReflection = (canvas: HTMLCanvasElement, x: number, scaleY: number, alpha: number) => {
      rctx.save()
      rctx.translate(x, floorH)
      rctx.scale(1, -scaleY)
      rctx.globalAlpha = alpha
      rctx.drawImage(canvas, 0, 0)
      rctx.restore()
    }

    drawCanvasReflection(this.artworks.westCenterCanvas, 912, 0.54, 0.42)
    drawCanvasReflection(this.artworks.centerCanvas, 1543, 0.52, 0.44)
    drawCanvasReflection(this.artworks.eastCenterCanvas, 2192, 0.54, 0.42)

    // Side painting subtle floor sheen
    const sideRefs: Array<[number, HTMLCanvasElement]> = [
      [744, this.artworks.westLeftCanvas],
      [1120, this.artworks.westRightCanvas],
      [1384, this.artworks.leftCanvas],
      [1760, this.artworks.rightCanvas],
      [2024, this.artworks.eastLeftCanvas],
      [2400, this.artworks.eastRightCanvas],
    ]
    for (const [rx, rc] of sideRefs) {
      drawCanvasReflection(rc, rx, 0.95, 0.14)
    }

    // Soft anisotropic distance attenuation + subtle stone grain shimmer
    for (let y = 0; y < floorH; y++) {
      const fade = Math.max(0, 1 - y / floorH)
      rctx.fillStyle = `rgba(10, 12, 18, ${0.24 + (1 - fade) * 0.72})`
      rctx.fillRect(0, y, WORLD_WIDTH, 1)
    }

    // Entrance Reception Counter warm LED + Glass Vestibule cool blue + Turnstile cyan reflections
    for (let y = 0; y < 44; y++) {
      const a = Math.pow(1 - y / 44, 1.7) * 0.36
      rctx.fillStyle = `rgba(255, 198, 114, ${a})`
      rctx.fillRect(58 - Math.floor(y * 0.12), y, 132 + Math.floor(y * 0.24), 1)
    }
    for (let y = 0; y < 56; y++) {
      const a = Math.pow(1 - y / 56, 1.8) * 0.22
      rctx.fillStyle = `rgba(92, 178, 255, ${a})`
      rctx.fillRect(226 - Math.floor(y * 0.15), y, 188 + Math.floor(y * 0.3), 1)
    }
    for (const gx of [252, 320, 388]) {
      for (let y = 18; y < 62; y++) {
        const a = Math.pow(1 - (y - 18) / 44, 1.7) * 0.32
        rctx.fillStyle = `rgba(82, 245, 220, ${a})`
        rctx.fillRect(gx - 6, y, 12, 1)
      }
    }
    // Kiosk blue reflection
    for (let y = 0; y < 38; y++) {
      const a = Math.pow(1 - y / 38, 1.8) * 0.24
      rctx.fillStyle = `rgba(88, 200, 255, ${a})`
      rctx.fillRect(460, y, 28, 1)
    }

    // Center plinth golden/cyan LED bounce reflections
    for (const p of PLINTH_CENTERS) {
      for (let y = 0; y < 58; y++) {
        const a = Math.pow(1 - y / 58, 1.75) * 0.48
        rctx.fillStyle = `rgba(255, 194, 108, ${a})`
        rctx.fillRect(p.x - p.halfW - Math.floor(y * 0.2), y, p.halfW * 2 + Math.floor(y * 0.4), 1)
      }
    }

    // Side Digital Plaques Cool Blue Reflections (skip Entrance Left Reception bay at 132 which has warm counter)
    for (const qx of SIDE_BAY_CENTERS) {
      if (qx < 640) continue
      for (let y = 2; y < 44; y++) {
        const a = Math.pow(1 - y / 44, 1.7) * 0.2
        rctx.fillStyle = `rgba(116, 188, 255, ${a})`
        rctx.fillRect(qx - 38, y, 76, 1)
      }
    }

    // Planter Bottom-Base Glow Reflections
    for (const tx of PLANTER_BASE_XS) {
      for (let y = 0; y < 22; y++) {
        const a = Math.pow(1 - y / 22, 1.8) * 0.28
        rctx.fillStyle = `rgba(255, 184, 96, ${a})`
        rctx.fillRect(tx - 10 - Math.floor(y * 0.12), y, 20 + Math.floor(y * 0.24), 1)
      }
    }

    const reflSprite = new Sprite(surfaceToNearestTexture(reflSurf))
    reflSprite.position.set(0, FLOOR_HORIZON_Y)
    reflSprite.blendMode = 'add'
    this.floorReflSprite = reflSprite
    this.reflectionLayer.addChild(reflSprite, this.regPedestalFloorSprite)

    // 3. Perspective Obsidian Tile Grout Grid & Specular Seam Glints
    const groutSurf = createPixelSurface(WORLD_WIDTH, floorH)
    const gctx = groutSurf.ctx
    const rand = mulberry32(5521)

    const rowYs = [0, 5, 11, 18, 27, 37, 49, 63, 79]
    for (const ry of rowYs) {
      gctx.fillStyle = 'rgba(5, 6, 10, 0.74)'
      gctx.fillRect(0, ry, WORLD_WIDTH, 1)
      gctx.fillStyle = 'rgba(130, 148, 182, 0.1)'
      gctx.fillRect(0, ry + 1, WORLD_WIDTH, 1)

      // Specular bevel glints along horizontal grout seams within plinth & planter base light pools
      for (const p of PLINTH_CENTERS) {
        gctx.fillStyle = 'rgba(255, 224, 170, 0.28)'
        gctx.fillRect(p.x - p.halfW + 10, ry + 1, (p.halfW - 10) * 2, 1)
      }
      if (ry < 22) {
        for (const tx of PLANTER_BASE_XS) {
          gctx.fillStyle = 'rgba(255, 212, 148, 0.2)'
          gctx.fillRect(tx - 10, ry + 1, 20, 1)
        }
      }
    }

    // Per-wing foreshortened vertical tile seams (keeps perspective authentic across all 2560px!)
    const vpY = -110
    for (const wingCenter of [320, 960, 1600, 2240]) {
      for (let i = -10; i <= 10; i++) {
        const topX = wingCenter + i * 32
        const botX = wingCenter + ((topX - wingCenter) * (floorH - vpY)) / (0 - vpY)
        const steps = floorH
        for (let y = 0; y < steps; y++) {
          const x = Math.round(topX + ((botX - topX) * y) / steps)
          if (x < wingCenter - 320 || x >= wingCenter + 320) continue
          gctx.fillStyle = 'rgba(5, 6, 10, 0.56)'
          gctx.fillRect(x, y, 1, 1)
          // Specular grout bevel glint near plinth centers
          const nearWarm = PLINTH_CENTERS.some((p) => Math.abs(x - p.x) < p.halfW)
          if (nearWarm && y < 60 && x + 1 < WORLD_WIDTH) {
            gctx.fillStyle = `rgba(255, 226, 176, ${Math.max(0.04, 0.16 * (1 - y / 60))})`
            gctx.fillRect(x + 1, y, 1, 1)
          }
        }
      }
    }

    // Subtle stone polish micro-sheen speckles & basalt veining
    gctx.fillStyle = 'rgba(4, 5, 10, 0.65)'
    gctx.fillRect(0, 0, WORLD_WIDTH, 1)
    for (let i = 0; i < 90; i++) {
      const vx = Math.floor(rand() * (WORLD_WIDTH - 24))
      const vy = 4 + Math.floor(rand() * (floorH - 8))
      const vw = 10 + Math.floor(rand() * 20)
      gctx.fillStyle = rand() > 0.45 ? 'rgba(98, 116, 146, 0.045)' : 'rgba(3, 4, 8, 0.1)'
      gctx.fillRect(vx, vy, vw, 1)
      if (vy + 1 < floorH) {
        gctx.fillRect(vx + 3, vy + 1, Math.max(4, vw - 6), 1)
      }
    }
    for (let i = 0; i < 1260; i++) {
      const sx = Math.floor(rand() * WORLD_WIDTH)
      const sy = Math.floor(rand() * floorH)
      gctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.032)' : 'rgba(0,0,0,0.08)'
      gctx.fillRect(sx, sy, 2 + Math.floor(rand() * 4), 1)
    }

    const groutSprite = new Sprite(surfaceToNearestTexture(groutSurf))
    groutSprite.position.set(0, FLOOR_HORIZON_Y)
    this.floorGroutSprite = groutSprite
    this.groutOverlayLayer.addChild(groutSprite)
  }

  /** Pre-rendered directional architectural, tree-planter & furniture cast shadows on the floor plane. */
  private buildFloorShadows(): void {
    const floorH = SCENE_HEIGHT - FLOOR_HORIZON_Y
    const shadowSurf = createPixelSurface(WORLD_WIDTH, floorH)
    const sctx = shadowSurf.ctx

    // 1. Plinth Stone Cheek Cutoff Shadow Wedges (frame the LED floor wash diagonally)
    for (const p of PLINTH_CENTERS) {
      const leftOuter = p.x - p.halfW - 4
      const rightOuter = p.x + p.halfW + 4
      for (let y = 0; y < 32; y++) {
        const a = Math.pow(1 - y / 32, 1.3) * 0.72
        const flare = Math.round(y * 0.52)
        sctx.fillStyle = `rgba(3, 4, 9, ${a})`
        sctx.fillRect(leftOuter - flare, y, 12 + Math.round(flare * 0.55), 1)
        sctx.fillRect(rightOuter - 12 + Math.round(flare * 0.55), y, 12 + Math.round(flare * 0.55), 1)
      }
    }

    // 2. Heavy Column & Pier Base Contact Shadows
    for (const cx of COLUMN_BASE_XS) {
      for (let y = 0; y < 10; y++) {
        const contactA = Math.pow(1 - y / 10, 1.35) * 0.78
        sctx.fillStyle = `rgba(3, 4, 9, ${contactA})`
        sctx.fillRect(cx - 18, y, 36, 1)
      }
    }

    // 3. Side Display Cabinet, Reception Counter & Kiosk Base Contact Shadows
    for (const cx of SIDE_BAY_CENTERS) {
      if (cx === 508) {
        // Entrance right bay has kiosk at x=474 instead of wide cabinet
        for (let y = 0; y < 10; y++) {
          const a = 0.72 - (y / 9) * 0.56
          sctx.fillStyle = `rgba(3, 4, 9, ${a})`
          sctx.fillRect(458 + y, y, 32 - y * 2, 1)
        }
        continue
      }
      for (let y = 0; y < 12; y++) {
        const a = 0.74 - (y / 11) * 0.58
        sctx.fillStyle = `rgba(3, 4, 9, ${a})`
        sctx.fillRect(cx - 52 + y, y, 104 - y * 2, 1)
      }
    }

    // 4. Potted Tree Planter Base Contact Shadows
    for (const tx of PLANTER_BASE_XS) {
      for (let y = 0; y < 9; y++) {
        const t = y / 8
        const halfW = Math.round(10 - t * 2)
        const contactA = 0.56 * Math.pow(1 - t, 1.4)
        sctx.fillStyle = `rgba(3, 4, 9, ${contactA})`
        sctx.fillRect(tx - halfW, y, halfW * 2, 1)
      }
    }

    // 5. Gallery Bench Directional Floor-Overhang Shadows extending onto Polished Floor (bench floorY = 320 -> localY = 48)
    const benchFloorShadows = [
      { cx: 960, shift: 0 },
      { cx: 1438, shift: -18 },
      { cx: 1762, shift: 18 },
      { cx: 2240, shift: 0 },
    ]
    const benchLocalY = 320 - FLOOR_HORIZON_Y
    for (const b of benchFloorShadows) {
      for (let y = benchLocalY; y <= benchLocalY + 26; y++) {
        const t = (y - benchLocalY) / 26
        const shiftX = Math.round(b.shift * ((y - (benchLocalY - 2)) / 28))
        const bodyA = 0.62 * Math.pow(1 - t, 1.15)
        const legA = 0.76 * Math.pow(1 - t, 1.1)
        sctx.fillStyle = `rgba(3, 4, 9, ${bodyA})`
        sctx.fillRect(b.cx - 43 + shiftX, y, 86, 1)
        sctx.fillStyle = `rgba(2, 3, 8, ${legA})`
        sctx.fillRect(b.cx - 41 + shiftX, y, 9, 1)
        sctx.fillRect(b.cx + 32 + shiftX, y, 9, 1)
      }
    }

    this.staticFloorShadowSprite = new Sprite(surfaceToNearestTexture(shadowSurf))
    this.staticFloorShadowSprite.position.set(0, FLOOR_HORIZON_Y)
    this.floorShadowLayer.addChild(this.staticFloorShadowSprite)
  }

  private buildBenches(): void {
    const benchMaskGfx = new Graphics()
    this.depthSortedLayer.addChild(benchMaskGfx)
    this.benchShadowLayer.mask = benchMaskGfx

    const drawBenchOnRug = (cx: number, floorY: number, shadowShiftX: number) => {
      const w = 128
      const h = 48
      const localFloorY = 36

      // 1. Woven Rug + Bench-on-Rug Static Shadow (placed in floorRugLayer BELOW floorShadowLayer so hero shadows fall onto the rug)
      const rugSurf = createPixelSurface(w, h)
      const rctx = rugSurf.ctx
      for (let ry = 0; ry < 20; ry++) {
        const inset = Math.round((19 - ry) * 0.25)
        const rw = 118 - inset * 2
        const rx = Math.round((w - rw) / 2)
        const rugY = localFloorY - 8 + ry
        const col =
          ry === 0 || ry === 19
            ? '#4a433d'
            : ry === 1 || ry === 18
              ? '#645a50'
              : ry < 3 || ry > 16
                ? '#786d60'
                : '#877a6b'
        px(rctx, rx, rugY, rw, 1, col)
        if (ry > 2 && ry < 17) {
          px(rctx, rx + 2, rugY, 2, 1, '#5a5047')
          px(rctx, rx + 5, rugY, 1, 1, '#9d8e7c')
          px(rctx, rx + rw - 4, rugY, 2, 1, '#5a5047')
          px(rctx, rx + rw - 6, rugY, 1, 1, '#9d8e7c')
          if (ry % 2 === 0) {
            px(rctx, rx - 1, rugY, 1, 1, '#b3a38f')
            px(rctx, rx + rw, rugY, 1, 1, '#b3a38f')
          }
        }
        if (ry === 3 || ry === 16) {
          px(rctx, rx + 6, rugY, rw - 12, 1, '#685e53')
        }
      }
      for (let dy = -2; dy <= 11; dy++) {
        const rowShift = Math.round((shadowShiftX * (dy + 3)) / 11)
        const apronAlpha = dy <= 3 ? 0.76 : 0.58 - ((dy - 4) / 8) * 0.26
        px(rctx, 21 + rowShift, localFloorY + dy, 86, 1, `rgba(5, 6, 11, ${apronAlpha.toFixed(2)})`)
        if (dy >= 0) {
          const legAlpha = Math.min(0.86, apronAlpha + 0.18)
          px(rctx, 23 + rowShift, localFloorY + dy, 7, 1, `rgba(3, 4, 9, ${legAlpha.toFixed(2)})`)
          px(rctx, 98 + rowShift, localFloorY + dy, 7, 1, `rgba(3, 4, 9, ${legAlpha.toFixed(2)})`)
        }
      }
      const rugSprite = new Sprite(surfaceToNearestTexture(rugSurf))
      rugSprite.anchor.set(0.5, localFloorY / h)
      rugSprite.position.set(cx, floorY)
      this.floorRugLayer.addChild(rugSprite)

      // 2. Physical Bench Geometry (placed in depthSortedLayer at zIndex = floorY)
      const benchSurf = createPixelSurface(w, h)
      const { ctx } = benchSurf
      px(ctx, 24, localFloorY - 12, 5, 13, '#1e1612')
      px(ctx, 99, localFloorY - 12, 5, 13, '#1e1612')
      px(ctx, 25, localFloorY - 12, 2, 13, '#382a22')
      px(ctx, 100, localFloorY - 12, 2, 13, '#382a22')

      px(ctx, 21, localFloorY - 16, 86, 6, '#33261e')
      px(ctx, 21, localFloorY - 11, 86, 2, '#17110e')

      px(ctx, 20, localFloorY - 22, 88, 6, '#7a6c5e')
      px(ctx, 22, localFloorY - 24, 84, 3, '#9a8a78')
      px(ctx, 24, localFloorY - 24, 80, 1, '#b5a490')
      px(ctx, 63, localFloorY - 23, 2, 6, '#574c41')

      const sprite = new Sprite(surfaceToNearestTexture(benchSurf))
      sprite.anchor.set(0.5, localFloorY / h)
      sprite.position.set(cx, floorY)
      sprite.zIndex = floorY
      this.depthSortedLayer.addChild(sprite)

      // 3. Bench Silhouette Mask so hero shadows cast cleanly onto the bench cushion/apron/legs
      const left = cx - w / 2
      const top = floorY - localFloorY
      benchMaskGfx.rect(left + 20, top + localFloorY - 24, 88, 15).fill(0xffffff)
      benchMaskGfx.rect(left + 24, top + localFloorY - 12, 5, 13).fill(0xffffff)
      benchMaskGfx.rect(left + 99, top + localFloorY - 12, 5, 13).fill(0xffffff)
    }

    drawBenchOnRug(960, 320, 0)
    drawBenchOnRug(1438, 320, -12)
    drawBenchOnRug(1762, 320, 12)
    drawBenchOnRug(2240, 320, 0)
  }

  /** Front-facing Entrance Turnstile Gates (with animated flaps) + Brass Velvet Stanchions. */
  private buildEntranceGatesAndStanchions(): void {
    // 1. Left & Right Velvet Stanchion Barriers (zIndex = 296)
    const stanchionSurf = createPixelSurface(WORLD_WIDTH, 48)
    const sctx = stanchionSurf.ctx
    const drawStanchionGroup = (xs: number[]) => {
      // Velvet ropes between posts
      for (let i = 0; i < xs.length - 1; i++) {
        const x0 = xs[i]
        const x1 = xs[i + 1]
        px(sctx, x0, 16, x1 - x0, 2, '#5a4e7c')
        px(sctx, x0, 17, x1 - x0, 1, '#393152')
      }
      // Brass posts
      for (const x of xs) {
        px(sctx, x - 3, 33, 7, 3, 'rgba(3, 4, 9, 0.72)')
        px(sctx, x - 3, 31, 7, 2, '#8b6d3c')
        px(sctx, x - 1, 14, 2, 18, '#caa35e')
        px(sctx, x, 14, 1, 18, '#f0d494')
        px(sctx, x - 2, 11, 4, 3, '#e2be76')
      }
    }
    drawStanchionGroup([92, 138, 184, 230])
    drawStanchionGroup([410, 456, 502, 548])

    const stanchionSprite = new Sprite(surfaceToNearestTexture(stanchionSurf))
    stanchionSprite.anchor.set(0, 34 / 48)
    stanchionSprite.position.set(0, 296)
    stanchionSprite.zIndex = 296
    this.entranceStanchionSprite = stanchionSprite
    this.depthSortedLayer.addChild(stanchionSprite)

    // 2. Three Brushed Stainless-Steel Turnstile Gate Pillars (zIndex = 290)
    const gateSurf = createPixelSurface(170, 44)
    const gctx = gateSurf.ctx
    for (const gx of [17, 85, 153]) {
      // Top cyan optical rim glow spilling onto floor & housing shoulder
      const capGlow = gctx.createRadialGradient(gx, 7, 1, gx, 7, 11)
      capGlow.addColorStop(0, 'rgba(94, 255, 228, 0.42)')
      capGlow.addColorStop(1, 'rgba(94, 255, 228, 0)')
      gctx.fillStyle = capGlow
      gctx.fillRect(gx - 11, 0, 22, 16)

      // Base contact shadow + stepped heavy steel plinth
      px(gctx, gx - 9, 37, 18, 4, 'rgba(3, 4, 9, 0.78)')
      px(gctx, gx - 8, 36, 16, 2, '#222834')
      px(gctx, gx - 8, 36, 16, 1, '#48546a')

      // Brushed stainless-steel 14px housing with metallic cylindrical shading
      px(gctx, gx - 7, 8, 14, 28, '#262c38')
      px(gctx, gx - 6, 8, 12, 28, '#384152')
      px(gctx, gx - 5, 8, 2, 28, '#6a7a96')
      px(gctx, gx - 3, 8, 5, 28, '#465166')
      px(gctx, gx + 4, 8, 2, 28, '#232936')
      px(gctx, gx + 6, 8, 1, 28, '#131720')
      // Horizontal brushed-metal micro texture
      for (let by = 10; by < 35; by += 3) {
        px(gctx, gx - 5, by, 10, 1, 'rgba(216, 232, 255, 0.08)')
      }

      // Sloped machined top deck + NFC/QR reader pad + glowing cyan halo collar
      px(gctx, gx - 6, 4, 12, 2, '#5a667d')
      px(gctx, gx - 5, 4, 10, 1, '#8c9cb8')
      px(gctx, gx - 7, 6, 14, 2, '#5effe4')
      px(gctx, gx - 6, 6, 12, 1, '#dcfff9')
      px(gctx, gx - 4, 8, 8, 3, '#101722')
      px(gctx, gx - 2, 9, 4, 1, '#7cf7e4')

      // Glossy dark acrylic LED status panel with inset bezel & glass sheen
      px(gctx, gx - 5, 12, 10, 13, '#475368')
      px(gctx, gx - 4, 13, 8, 11, '#090d14')
      px(gctx, gx - 4, 14, 2, 1, 'rgba(186, 224, 255, 0.22)')
      px(gctx, gx - 3, 15, 2, 1, 'rgba(186, 224, 255, 0.14)')

      // Lower stainless service hatch seam & kickplate trim
      px(gctx, gx - 4, 27, 8, 7, '#2d3544')
      px(gctx, gx - 3, 28, 6, 5, '#3b4456')
      px(gctx, gx, 30, 1, 2, '#171c26')
    }
    const gateContainer = new Container()
    gateContainer.position.set(235, 294)
    gateContainer.zIndex = 294

    const gatePillarSprite = new Sprite(surfaceToNearestTexture(gateSurf))
    gatePillarSprite.anchor.set(0, 38 / 44)
    gatePillarSprite.position.set(0, 0)

    this.gateFlapsGfx.position.set(0, 0)
    this.gateStatusGfx.position.set(0, 0)
    gateContainer.addChild(this.gateFlapsGfx, gatePillarSprite, this.gateStatusGfx)
    this.entranceGateContainer = gateContainer
    this.depthSortedLayer.addChild(gateContainer)

    this.redrawGateFlapsAndStatus()
  }

  private redrawGateFlapsAndStatus(): void {
    const ease = 1 - Math.pow(1 - this.gateOpenProgress, 3)
    const leafW = Math.max(0, Math.round((1 - ease) * 27))

    this.gateFlapsGfx.clear()
    if (leafW > 0) {
      const alpha = 0.24 * (1 - ease * 0.35)
      const edgeAlpha = 0.88 * (1 - ease * 0.3)
      const drawFlapWing = (startX: number, hingesLeft: boolean) => {
        const edgeX = hingesLeft ? startX + leafW - 1 : startX
        const hingeX = hingesLeft ? startX : startX + leafW - Math.min(3, leafW)
        const clampW = Math.min(3, leafW)
        // Translucent tempered-cyan glass panel
        this.gateFlapsGfx.rect(startX, -25, leafW, 19).fill({ color: 0x5be8ff, alpha })
        // Etched safety frost strip across mid-glass
        this.gateFlapsGfx.rect(startX, -16, leafW, 2).fill({ color: 0xdcfbff, alpha: alpha * 0.85 })
        // Edge-lit top & bottom optical acrylic rims
        this.gateFlapsGfx.rect(startX, -25, leafW, 1).fill({ color: 0xc4fdff, alpha: edgeAlpha })
        this.gateFlapsGfx.rect(startX, -7, leafW, 1).fill({ color: 0x8ef2ff, alpha: edgeAlpha * 0.72 })
        // Leading meeting-edge illumination bar
        this.gateFlapsGfx.rect(edgeX, -25, 1, 19).fill({ color: 0xe6ffff, alpha: edgeAlpha })
        // Brushed stainless hinge clamp anchoring glass inside pillar pocket
        this.gateFlapsGfx.rect(hingeX, -23, clampW, 15).fill({ color: 0x627088, alpha: 0.92 })
      }

      // Left lane flaps (between x=24..78) & Right lane flaps (between x=92..146)
      drawFlapWing(24, true)
      drawFlapWing(78 - leafW, false)
      drawFlapWing(92, true)
      drawFlapWing(146 - leafW, false)
    }

    this.redrawGateAnimatedIndicators()
  }

  private redrawGateAnimatedIndicators(): void {
    this.gateStatusGfx.clear()
    const t = this.timeSec
    const isOpen = this.gateOpenProgress > 0.5
    const ease = 1 - Math.pow(1 - this.gateOpenProgress, 3)
    const leafW = Math.max(0, Math.round((1 - ease) * 27))

    for (let idx = 0; idx < 3; idx++) {
      const gx = [17, 85, 153][idx]
      // Top cyan optical collar shimmer + active NFC reader laser tick
      const collarPulse = 0.22 + 0.28 * (0.5 + 0.5 * Math.sin(t * 3.0 + idx * 0.9))
      this.gateStatusGfx.rect(gx - 6, -32, 12, 1).fill({ color: 0xe6ffff, alpha: collarPulse })
      const readerScanX = gx - 2 + (Math.floor(t * 4.5 + idx * 1.3) % 4)
      this.gateStatusGfx.rect(readerScanX, -29, 1, 1).fill({ color: 0xffffff, alpha: 0.88 })

      if (isOpen) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 4.0 + idx * 0.7)
        this.gateStatusGfx.circle(gx, -19, 5).fill({ color: 0x58ffe0, alpha: 0.13 + 0.06 * pulse })
        const dy = Math.round((1 - ((t * 2.8 + idx * 0.25) % 1)) * 2) - 1
        this.gateStatusGfx.rect(gx - 1, -22 + dy, 2, 1).fill(0xdffff9)
        this.gateStatusGfx.rect(gx - 2, -21 + dy, 4, 1).fill(0x58ffe0)
        this.gateStatusGfx.rect(gx - 3, -20 + dy, 6, 1).fill(0x58ffe0)
        this.gateStatusGfx.rect(gx - 1, -19 + dy, 2, 3).fill(0x58ffe0)
        this.gateStatusGfx.rect(gx - 4, -24, 1, 1).fill({ color: 0xb8fff3, alpha: 0.35 + 0.55 * pulse })
      } else {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.1 + idx * 0.8)
        this.gateStatusGfx.circle(gx, -19, 5).fill({ color: 0xffad4a, alpha: 0.12 + 0.06 * pulse })
        this.gateStatusGfx.rect(gx - 3, -20, 6, 2).fill({ color: 0xffad4a, alpha: 0.84 + 0.16 * pulse })
        this.gateStatusGfx.rect(gx - 2, -20, 4, 1).fill({ color: 0xffe4b8, alpha: 0.58 + 0.36 * pulse })
        const pipLeft = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.6 + idx))
        const pipRight = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.6 + idx + Math.PI))
        this.gateStatusGfx.rect(gx - 3, -16, 1, 1).fill({ color: 0xffd28a, alpha: pipLeft })
        this.gateStatusGfx.rect(gx + 2, -16, 1, 1).fill({ color: 0xffd28a, alpha: pipRight })
      }
    }

    if (leafW > 0) {
      const glintAlpha = 0.65 * (1 - ease * 0.45)
      const gy1 = -25 + (Math.floor(t * 14) % 17)
      const gy2 = -25 + ((Math.floor(t * 14) + 8) % 17)
      this.gateStatusGfx
        .rect(24 + leafW - 1, gy1, 1, 2)
        .fill({ color: 0xffffff, alpha: glintAlpha })
        .rect(78 - leafW, gy1, 1, 2)
        .fill({ color: 0xffffff, alpha: glintAlpha })
        .rect(92 + leafW - 1, gy2, 1, 2)
        .fill({ color: 0xffffff, alpha: glintAlpha })
        .rect(146 - leafW, gy2, 1, 2)
        .fill({ color: 0xffffff, alpha: glintAlpha })
    }
  }

  private buildLightingAndParticles(): void {
    // 1. Ambient Color Grading Overlay across entire 1920px corridor (Front Grade Layer)
    this.ambientTintOverlay = new Graphics()
    this.ambientTintOverlay.rect(0, 0, WORLD_WIDTH, SCENE_HEIGHT).fill(0xffffff)
    this.ambientTintOverlay.alpha = this.preset.ambientAlpha
    this.ambientTintOverlay.tint = this.preset.ambientTint
    this.frontColorGradeLayer.addChild(this.ambientTintOverlay)

    const makeGlowTex = (size: number, innerAlpha = 1) =>
      createLinearTexture(size, size, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
        g.addColorStop(0, `rgba(255,255,255,${innerAlpha})`)
        g.addColorStop(0.32, `rgba(255,255,255,${innerAlpha * 0.52})`)
        g.addColorStop(0.68, `rgba(255,255,255,${innerAlpha * 0.14})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      })

    const makeBeamTex = (w: number, h: number, topHalfRatio = 0.12) =>
      createLinearTexture(w, h, (ctx) => {
        for (let y = 0; y < h; y++) {
          const t = y / h
          const halfW = w * (topHalfRatio + (0.5 - topHalfRatio) * t)
          const vFade = Math.sin(Math.min(1, t * 1.1) * Math.PI) * (1 - t * 0.52)
          const grad = ctx.createLinearGradient(w / 2 - halfW, 0, w / 2 + halfW, 0)
          grad.addColorStop(0, 'rgba(255,255,255,0)')
          grad.addColorStop(0.28, `rgba(255,255,255,${0.3 * vFade})`)
          grad.addColorStop(0.5, `rgba(255,255,255,${0.62 * vFade})`)
          grad.addColorStop(0.72, `rgba(255,255,255,${0.3 * vFade})`)
          grad.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.fillStyle = grad
          ctx.fillRect(0, y, w, 1)
        }
      })

    const makeStarburstTex = (size: number) =>
      createLinearTexture(size, size, (ctx, w, h) => {
        const cx = w / 2
        const cy = h / 2
        const rad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.36)
        rad.addColorStop(0, 'rgba(255,255,255,0.95)')
        rad.addColorStop(0.4, 'rgba(255,255,255,0.35)')
        rad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = rad
        ctx.fillRect(0, 0, w, h)
        const hg = ctx.createLinearGradient(0, cy, w, cy)
        hg.addColorStop(0, 'rgba(255,255,255,0)')
        hg.addColorStop(0.5, 'rgba(255,255,255,0.72)')
        hg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = hg
        ctx.fillRect(0, cy - 1, w, 2)
      })

    const glowTex = makeGlowTex(128, 1)
    const skylightShaftTex = makeBeamTex(42, 232, 0.28)
    const outerConeTex = makeBeamTex(112, 174, 0.08)
    const innerConeTex = makeBeamTex(62, 165, 0.05)
    const glintTex = makeStarburstTex(28)

    // 2. Louvered Skylight Shafts split into Back Wall Shafts + Front Volumetric Haze Veil + Floor Pools
    for (const cx of SKYLIGHT_CENTERS) {
      const span = cx === 960 ? 20 : 18
      for (let pane = -2; pane <= 2; pane++) {
        const backRay = new Sprite(skylightShaftTex)
        backRay.anchor.set(0.5, 0)
        backRay.position.set(cx + pane * span, 14)
        backRay.skew.x = pane * 0.025
        backRay.scale.set(pane === 0 ? 1.15 : 0.92, 1.0)
        backRay.blendMode = 'add'
        this.backSkylightRays.push(backRay)
        this.backWallLightingLayer.addChild(backRay)

        const frontRay = new Sprite(skylightShaftTex)
        frontRay.anchor.set(0.5, 0)
        frontRay.position.set(cx + pane * span, 14)
        frontRay.skew.x = pane * 0.025
        frontRay.scale.set(pane === 0 ? 1.25 : 1.0, 1.04)
        frontRay.blendMode = 'add'
        this.frontSkylightRays.push(frontRay)
        this.midVolumetricLightingLayer.addChild(frontRay)
      }

      const skyFloor = new Sprite(glowTex)
      skyFloor.anchor.set(0.5)
      skyFloor.position.set(cx, 296)
      skyFloor.scale.set(1.65, 0.52)
      skyFloor.blendMode = 'add'
      this.skylightFloorPools.push(skyFloor)
      this.floorLightingLayer.addChild(skyFloor)
    }

    // 3. Dual-Cone Spotlights split across Back Wall (inner core + glints) & Mid Volumetric Veil (outer cones)
    const spotConfigs: Array<[number, number, number, number]> = []
    spotConfigs.push(
      [242, 40, 1.0, 1.35],
      [320, 40, 1.05, 1.45],
      [398, 40, 1.0, 1.35],
    )
    for (const wingOffset of [WING_OFFSETS.west, WING_OFFSETS.center, WING_OFFSETS.east]) {
      const dx = wingOffset === WING_OFFSETS.center ? 82 : 76
      const cx = wingOffset + 320
      spotConfigs.push(
        [wingOffset + 102, 40, 1.0, 1.15],
        [cx - dx, 40, 1.05, 1.45],
        [cx + dx, 40, 1.05, 1.45],
        [wingOffset + 538, 40, 1.0, 1.15],
        [wingOffset + 132, 128, 1.0, 0.92],
        [wingOffset + 508, 128, 1.0, 0.92],
      )
    }

    // Entrance-specific warm reception lamp & counter wash + cyan kiosk & turnstile floor glows
    const deskLampGlow = new Sprite(glowTex)
    deskLampGlow.anchor.set(0.5)
    deskLampGlow.position.set(83, 210)
    deskLampGlow.scale.set(0.45, 0.35)
    deskLampGlow.tint = 0xffbd66
    deskLampGlow.alpha = 0.72
    deskLampGlow.blendMode = 'add'
    this.deskLampGlowSprite = deskLampGlow
    this.backWallLightingLayer.addChild(deskLampGlow)

    const counterWash = new Sprite(glowTex)
    counterWash.anchor.set(0.5, 0.2)
    counterWash.position.set(124, 274)
    counterWash.scale.set(1.25, 0.44)
    counterWash.tint = 0xffbf6b
    counterWash.alpha = 0.38
    counterWash.blendMode = 'add'
    this.floorLightingLayer.addChild(counterWash)

    const kioskGlow = new Sprite(glowTex)
    kioskGlow.anchor.set(0.5)
    kioskGlow.position.set(474, 208)
    kioskGlow.scale.set(0.42, 0.42)
    kioskGlow.tint = 0x5cc8ff
    kioskGlow.alpha = 0.56
    kioskGlow.blendMode = 'add'
    this.kioskGlowSprite = kioskGlow
    this.backWallLightingLayer.addChild(kioskGlow)

    const signHalo = new Sprite(glowTex)
    signHalo.anchor.set(0.5)
    signHalo.position.set(320, 112)
    signHalo.scale.set(1.3, 0.34)
    signHalo.tint = 0xffc770
    signHalo.alpha = 0.32
    signHalo.blendMode = 'add'
    this.signHaloSprite = signHalo
    this.backWallLightingLayer.addChild(signHalo)

    for (const gx of [252, 320, 388]) {
      const gPool = new Sprite(glowTex)
      gPool.anchor.set(0.5)
      gPool.position.set(gx, 295)
      gPool.scale.set(0.42, 0.2)
      gPool.tint = 0x58ffe0
      gPool.alpha = 0.34
      gPool.blendMode = 'add'
      this.gateFloorGlowSprites.push(gPool)
      this.floorLightingLayer.addChild(gPool)
    }

    this.doorThresholdGlow = new Sprite(glowTex)
    this.doorThresholdGlow.anchor.set(0.5, 0.25)
    this.doorThresholdGlow.position.set(320, 272)
    this.doorThresholdGlow.scale.set(1.05, 0.36)
    this.doorThresholdGlow.tint = 0x90d6ff
    this.doorThresholdGlow.alpha = 0.16
    this.doorThresholdGlow.blendMode = 'add'
    this.floorLightingLayer.addChild(this.doorThresholdGlow)

    for (const [sx, sy, sw, sh] of spotConfigs) {
      const outer = new Sprite(outerConeTex)
      outer.anchor.set(0.5, 0)
      outer.position.set(sx, sy)
      outer.scale.set(sw, sh)
      outer.blendMode = 'add'
      this.spotOuterCones.push(outer)
      this.midVolumetricLightingLayer.addChild(outer)

      const inner = new Sprite(innerConeTex)
      inner.anchor.set(0.5, 0)
      inner.position.set(sx, sy)
      inner.scale.set(sw * 0.9, sh * 0.94)
      inner.tint = 0xfff0d4
      inner.blendMode = 'add'
      this.spotInnerCones.push(inner)

      const glint = new Sprite(glintTex)
      glint.anchor.set(0.5)
      glint.position.set(sx, sy + 1)
      glint.scale.set(0.85)
      glint.blendMode = 'add'
      this.spotGlints.push(glint)

      this.backWallLightingLayer.addChild(inner, glint)
    }

    // Wall Sconces Warm Glow Halos (Back Wall Layer)
    for (const sx of SCONCE_POSITIONS) {
      const sconceGlow = new Sprite(glowTex)
      sconceGlow.anchor.set(0.5)
      sconceGlow.position.set(sx, 174)
      sconceGlow.scale.set(0.95, 1.15)
      sconceGlow.blendMode = 'add'
      this.sconceGlowSprites.push(sconceGlow)
      this.backWallLightingLayer.addChild(sconceGlow)
    }

    // Dedicated Wall Backlight Pools behind side exhibits & main tall paintings (Back Wall Layer)
    for (const cx of SIDE_BAY_CENTERS) {
      const pool = new Sprite(glowTex)
      pool.anchor.set(0.5)
      pool.position.set(cx, 175)
      pool.scale.set(0.95, 0.72)
      pool.blendMode = 'add'
      this.paintingLightPools.push(pool)
      this.backWallLightingLayer.addChild(pool)

      const plaqueGlow = new Sprite(glowTex)
      plaqueGlow.anchor.set(0.5)
      plaqueGlow.position.set(cx, 237)
      plaqueGlow.scale.set(0.78, 0.32)
      plaqueGlow.tint = 0x74c8ff
      plaqueGlow.blendMode = 'add'
      this.plaqueGlowSprites.push(plaqueGlow)
      this.backWallLightingLayer.addChild(plaqueGlow)

      const plaqueFloor = new Sprite(glowTex)
      plaqueFloor.anchor.set(0.5)
      plaqueFloor.position.set(cx, 284)
      plaqueFloor.scale.set(0.82, 0.3)
      plaqueFloor.tint = 0x74c8ff
      plaqueFloor.blendMode = 'add'
      this.plaqueFloorPools.push(plaqueFloor)
      this.floorLightingLayer.addChild(plaqueFloor)
    }

    for (const cx of SKYLIGHT_CENTERS) {
      const mainPool = new Sprite(glowTex)
      mainPool.anchor.set(0.5)
      mainPool.position.set(cx, 165)
      mainPool.scale.set(1.6, 1.8)
      mainPool.blendMode = 'add'
      this.paintingLightPools.push(mainPool)
      this.backWallLightingLayer.addChild(mainPool)
    }

    // 4. Three Plinths LED Backlight Halos (Back Wall Layer) & Floor Wash Pools (Floor Layer)
    for (const p of PLINTH_CENTERS) {
      const halo = new Sprite(glowTex)
      halo.anchor.set(0.5)
      halo.position.set(p.x, 268)
      halo.scale.set((p.halfW / 80) * 1.85, 0.42)
      halo.blendMode = 'add'
      this.plinthLightSprites.push(halo)
      this.backWallLightingLayer.addChild(halo)

      const floorGlow = new Sprite(glowTex)
      floorGlow.anchor.set(0.5, 0.2)
      floorGlow.position.set(p.x, 278)
      floorGlow.scale.set((p.halfW / 80) * 1.65, 0.68)
      floorGlow.blendMode = 'add'
      this.plinthFloorGlowSprites.push(floorGlow)
      this.floorLightingLayer.addChild(floorGlow)
    }

    // 5. Potted Tree Planter Bottom-Base Glow + Floor Spill Pool
    for (const tx of PLANTER_BASE_XS) {
      const baseGlow = new Sprite(glowTex)
      baseGlow.anchor.set(0.5, 0.5)
      baseGlow.position.set(tx, 275)
      baseGlow.scale.set(0.42, 0.16)
      baseGlow.blendMode = 'add'
      this.planterBaseGlows.push(baseGlow)
      this.backWallLightingLayer.addChild(baseGlow)

      const floorPool = new Sprite(glowTex)
      floorPool.anchor.set(0.5, 0.2)
      floorPool.position.set(tx, 278)
      floorPool.scale.set(0.48, 0.22)
      floorPool.blendMode = 'add'
      this.planterFloorPools.push(floorPool)
      this.floorLightingLayer.addChild(floorPool)
    }

    // 7. Split Dust Motes into Back Depth & Front Air Planes
    const rand = mulberry32(7788)
    for (let i = 0; i < 140; i++) {
      const size = rand() > 0.78 ? 2 : 1
      const g = new Graphics()
      g.rect(0, 0, size, size).fill(0xffffff)
      g.blendMode = 'add'
      const x = 28 + rand() * (WORLD_WIDTH - 56)
      const y = 26 + rand() * 290
      g.position.set(x, y)
      if (i % 2 === 0) {
        this.backParticleLayer.addChild(g)
      } else {
        this.frontParticleLayer.addChild(g)
      }
      this.dustParticles.push({
        sprite: g,
        x,
        y,
        vx: (rand() - 0.5) * 6,
        vy: -2 - rand() * 5,
        baseAlpha: 0.28 + rand() * 0.55,
        phase: rand() * Math.PI * 2,
        size,
      })
    }

    // 8. Interactive Hotspot Marker Bubble
    this.activePromptContainer.visible = false
    this.activePromptContainer.addChild(this.activePromptBg, this.activePromptDot)
    this.promptLayer.addChild(this.activePromptContainer)
  }

  private buildForegroundParallax(): void {
    // 1. Subtle overhead silhouetted ceiling timber joists & wing transition framing pillars (scrolls at 1.14x)
    const fgGfx = new Graphics()
    for (let rx = 20; rx <= WORLD_WIDTH - 20; rx += 160) {
      fgGfx.rect(rx - 4, 0, 8, 12).fill({ color: 0x050508, alpha: 0.72 })
      fgGfx.rect(rx - 7, 5, 14, 3).fill({ color: 0x050508, alpha: 0.56 })
    }
    fgGfx.rect(0, 0, WORLD_WIDTH, 5).fill({ color: 0x050508, alpha: 0.78 })
    fgGfx.rect(0, 5, WORLD_WIDTH, 2).fill({ color: 0x09080d, alpha: 0.48 })

    // Slender translucent foreground framing pilasters with chamfered corbels at wing entrances
    for (const fx of [10, 640, 1280, 1920, WORLD_WIDTH - 10]) {
      fgGfx.rect(fx - 7, 0, 14, SCENE_HEIGHT).fill({ color: 0x040509, alpha: 0.34 })
      fgGfx.rect(fx - 3, 0, 6, SCENE_HEIGHT).fill({ color: 0x030407, alpha: 0.42 })
      fgGfx.rect(fx - 11, 5, 22, 7).fill({ color: 0x040509, alpha: 0.45 })
      fgGfx.rect(fx - 9, 12, 18, 5).fill({ color: 0x040509, alpha: 0.32 })
    }
    this.foregroundParallaxLayer.addChild(fgGfx)

    // 2. Soft Out-of-Focus Foreground Optical Bokeh Orbs near top/bottom DoF fringe
    const bokehTex = createLinearTexture(24, 24, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2)
      g.addColorStop(0, 'rgba(255,255,255,0.62)')
      g.addColorStop(0.55, 'rgba(255,255,255,0.24)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    })

    const rand = mulberry32(9104)
    for (let i = 0; i < 28; i++) {
      const s = new Sprite(bokehTex)
      s.anchor.set(0.5)
      const isTop = i % 2 === 0
      const baseX = 40 + rand() * (WORLD_WIDTH - 80)
      const baseY = isTop ? 12 + rand() * 34 : 318 + rand() * 32
      const sc = 0.55 + rand() * 0.95
      s.scale.set(sc)
      s.blendMode = 'add'
      this.foregroundParallaxLayer.addChild(s)
      this.bokehParticles.push({
        sprite: s,
        baseX,
        baseY,
        driftSpeed: 2 + rand() * 4,
        phase: rand() * Math.PI * 2,
        baseAlpha: 0.12 + rand() * 0.16,
        isWarm: !isTop || rand() > 0.45,
      })
    }
  }

  private buildPrologueSubterraneanStage(): void {
    const H = 420
    const surf = createPixelSurface(WORLD_WIDTH, H)
    const { ctx } = surf
    const rand = mulberry32(7421)

    // Seamless vertical gradient below gallery floor (y = 358..778)
    for (let y = 0; y < H; y++) {
      const t = y / (H - 1)
      const col =
        t < 0.2
          ? lerpColor([5, 6, 10], [16, 13, 12], t / 0.2)
          : lerpColor([16, 13, 12], [26, 20, 17], (t - 0.2) / 0.8)
      px(ctx, 0, y, WORLD_WIDTH, 1, col)
    }

    // Subtle discrete state-space coordinate grid in ivory
    for (let gy = 26; gy < H - 16; gy += 16) {
      for (let gx = 16; gx < WORLD_WIDTH - 16; gx += 16) {
        if (rand() > 0.28) {
          px(ctx, gx, gy, 1, 1, 'rgba(244, 239, 226, 0.08)')
        }
      }
    }

    // Stratified soil & warm horizon hairline near bottom stage ground (local y = 300, world y = 658)
    px(ctx, 0, 300, WORLD_WIDTH, 1, 'rgba(110, 152, 124, 0.24)')
    px(ctx, 0, 302, WORLD_WIDTH, 118, 'rgba(10, 8, 7, 0.55)')
    for (let i = 0; i < 210; i++) {
      const sx = Math.floor(rand() * WORLD_WIDTH)
      const sy = 24 + Math.floor(rand() * 268)
      px(ctx, sx, sy, 1, 1, rand() > 0.55 ? 'rgba(242, 201, 119, 0.08)' : 'rgba(110, 152, 124, 0.09)')
    }

    const bgSprite = new Sprite(surfaceToNearestTexture(surf))
    bgSprite.y = 358
    this.prologueLayer.addChild(bgSprite, this.prologueAnimGfx)
    this.prologueLayer.visible = false
  }

  private buildDoFAndVignette(): void {
    this.dofRenderTex = RenderTexture.create({
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      scaleMode: 'linear',
    })
    this.dofSprite = new Sprite(this.dofRenderTex)
    this.dofBlurFilter = new BlurFilter({ strength: 2.3, quality: 2 })
    this.dofSprite.filters = [this.dofBlurFilter]

    const maskTex = createLinearTexture(SCENE_WIDTH, SCENE_HEIGHT, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h)
      grad.addColorStop(0.0, 'rgb(235,235,235)')
      grad.addColorStop(0.14, 'rgb(140,140,140)')
      grad.addColorStop(0.28, 'rgb(0,0,0)')
      grad.addColorStop(0.84, 'rgb(0,0,0)')
      grad.addColorStop(0.95, 'rgb(140,140,140)')
      grad.addColorStop(1.0, 'rgb(235,235,235)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    })
    this.dofMaskSprite = new Sprite(maskTex)
    this.dofSprite.mask = this.dofMaskSprite

    const vigTex = createLinearTexture(SCENE_WIDTH, SCENE_HEIGHT, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h * 0.48, w * 0.28, w / 2, h * 0.5, w * 0.64)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(0.65, 'rgba(4,5,10,0.18)')
      grad.addColorStop(1, 'rgba(2,3,8,0.68)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    })
    this.vignetteSprite = new Sprite(vigTex)

    this.applyLightingPreset(this.preset.id)
  }

  public applyLightingPreset(id: LightingPresetId): void {
    this.preset = LIGHTING_PRESETS[id]
    this.syncLightingColors()
  }

  public setResonanceEnabled(enabled: boolean): void {
    this.resonanceEnabled = enabled
    this.syncLightingColors()
  }

  public setLightsDimmed(dimmed: boolean): void {
    this.lightsDimmed = dimmed
    this.syncLightingColors()
  }

  public getResonanceEnabled(): boolean {
    return this.resonanceEnabled
  }

  public getLightsDimmed(): boolean {
    return this.lightsDimmed
  }

  public getLightingPreset(): LightingPreset {
    return this.preset
  }

  public isEntranceGateOpen(): boolean {
    return this.entranceGateOpen
  }

  public isEntranceGatePassable(): boolean {
    return this.gateOpenProgress > 0.55
  }

  public setEntranceGateOpen(open: boolean): void {
    this.entranceAnimDelaySec = 0
    this.entranceGateOpen = open
  }

  public toggleEntranceGate(): boolean {
    const next = !this.entranceGateOpen
    this.setEntranceGateOpen(next)
    return next
  }

  public setRegistrationBackdropVisible(visible: boolean, immediate = false): void {
    this.regCorridorTargetAlpha = visible ? 1 : 0
    if (immediate) {
      this.regCorridorFadeAlpha = this.regCorridorTargetAlpha
    }
  }

  /** Plays the post-registration sequence: inner frosted doors CLOSE behind, while outer turnstiles OPEN in front. */
  public playPostRegistrationSequence(): void {
    // Inner frosted double doors start WIDE OPEN (1) and animate CLOSING (0)
    this.doorOpenProgress = 1
    this.entranceDoorOpen = false
    this.leftDoorSprite.x = 269 - 48
    this.rightDoorSprite.x = 320 + 48
    this.updateFrostedBlurMask(48)

    // Outer turnstile barrier flaps start CLOSED (0) and animate OPENING (1)
    this.gateOpenProgress = 0
    this.entranceGateOpen = true
    this.redrawGateFlapsAndStatus()

    // Brief dramatic beat as registration UI fades out into the Entrance Hall
    this.entranceAnimDelaySec = 0.28
  }

  public snapCameraToFocus(): void {
    this.cameraTargetX = this.focusX
    this.cameraTargetY = this.focusY
    this.cameraTargetZoom = this.focusZoom
    this.cameraX = this.focusX
    this.cameraY = this.focusY
    this.cameraZoom = this.focusZoom
    this.worldLayer.pivot.set(this.cameraX, this.cameraY)
    this.worldLayer.position.set(SCENE_WIDTH / 2, SCENE_HEIGHT / 2)
    this.worldLayer.scale.set(this.cameraZoom)
  }

  public isPatrolActive(): boolean {
    return this.patrolActive
  }

  public togglePatrol(): boolean {
    this.patrolActive = !this.patrolActive
    if (this.patrolActive) {
      // Seed patrol phase seamlessly from current camera X so there is no snap
      const norm = Math.max(-1, Math.min(1, (this.cameraX - WING_CENTERS.center) / 620))
      this.patrolPhase = Math.asin(norm)
    }
    return this.patrolActive
  }

  public stopPatrol(): void {
    this.patrolActive = false
  }

  public adjustManualPan(deltaX: number): void {
    this.patrolActive = false
    this.manualPanX = Math.max(-220, Math.min(220, this.manualPanX + deltaX))
  }

  public resetManualPan(): void {
    this.manualPanX = 0
  }

  public adjustUserZoom(delta: number): number {
    this.userZoom = Math.max(0.95, Math.min(1.42, this.userZoom + delta))
    return this.userZoom
  }

  public getCameraState(): { x: number; y: number; zoom: number; wing: CorridorWingId } {
    const wing: CorridorWingId =
      this.cameraX < 640
        ? 'entrance'
        : this.cameraX < 1280
          ? 'west'
          : this.cameraX < 1920
            ? 'center'
            : 'east'
    return { x: this.cameraX, y: this.cameraY, zoom: this.cameraZoom, wing }
  }

  public snapCameraTo(x: number): void {
    this.cameraTargetX = x
    this.cameraX = x
    this.manualPanX = 0
    this.lookAheadX = 0
  }

  private syncLightingColors(): void {
    const dimMul = this.lightsDimmed ? 0.35 : 1.0
    const resSkyMul = this.resonanceEnabled ? 1.45 : 1.0
    this.ambientTintOverlay.tint = this.preset.ambientTint
    this.ambientTintOverlay.alpha = this.preset.ambientAlpha + (this.lightsDimmed ? 0.24 : 0)

    for (const ray of this.backSkylightRays) {
      ray.tint = this.preset.skylightColor
      ray.alpha = Math.min(0.95, this.preset.skylightAlpha * 0.58 * resSkyMul)
    }
    for (const ray of this.frontSkylightRays) {
      ray.tint = this.preset.skylightColor
      ray.alpha = Math.min(0.75, this.preset.skylightAlpha * 0.24 * resSkyMul)
    }
    for (const fp of this.skylightFloorPools) {
      fp.tint = this.preset.skylightColor
      fp.alpha = Math.min(0.8, 0.36 * resSkyMul)
    }
    for (const outer of this.spotOuterCones) {
      outer.tint = this.preset.spotColor
      outer.alpha = this.preset.spotAlpha * 0.36 * dimMul
    }
    for (const inner of this.spotInnerCones) {
      inner.tint = 0xfff0d4
      inner.alpha = this.preset.spotAlpha * 0.52 * dimMul
    }
    for (const glint of this.spotGlints) {
      glint.tint = this.preset.spotColor
      glint.alpha = 0.78 * dimMul
    }
    for (const sc of this.sconceGlowSprites) {
      sc.tint = this.preset.sconceColor
      sc.alpha = this.preset.sconceAlpha * 0.58 * dimMul
    }
    for (const pool of this.paintingLightPools) {
      pool.tint = this.preset.spotColor
      pool.alpha = 0.28 * dimMul
    }
    for (const pq of this.plaqueGlowSprites) {
      pq.alpha = 0.68 * dimMul
    }
    for (const pf of this.plaqueFloorPools) {
      pf.alpha = 0.26 * dimMul
    }
    for (const halo of this.plinthLightSprites) {
      halo.tint = this.preset.plinthColor
      halo.alpha = this.preset.plinthAlpha * 1.15 * (this.resonanceEnabled ? 1.25 : 1) * dimMul
    }
    for (const fg of this.plinthFloorGlowSprites) {
      fg.tint = this.preset.plinthColor
      fg.alpha = this.preset.plinthAlpha * 0.72 * dimMul
    }
    for (const bg of this.planterBaseGlows) {
      bg.tint = this.preset.plinthColor
      bg.alpha = 0.68 * dimMul
    }
    for (const pf of this.planterFloorPools) {
      pf.tint = this.preset.plinthColor
      pf.alpha = 0.42 * dimMul
    }
    if (this.staticFloorShadowSprite) {
      this.staticFloorShadowSprite.alpha = this.lightsDimmed ? 0.68 : 1.0
    }
  }

  private sampleLightFieldIntensity(x: number, y: number): number {
    let lum = 0.35
    for (const cx of SKYLIGHT_CENTERS) {
      if (Math.abs(x - cx) < 62 && y < 260) {
        lum += (1 - Math.abs(x - cx) / 62) * (0.85 + (this.resonanceEnabled ? 0.55 : 0))
      }
    }
    for (const cx of SIDE_BAY_CENTERS) {
      const d = Math.hypot((x - cx) / 56, (y - 190) / 85)
      if (d < 1) lum += (1 - d) * 0.55
    }
    return Math.min(1.8, lum)
  }

  /** Compute layered ambient + rear backlight + multi-light shadow projection sample for true contre-jour silhouettes and directional cast shadows. */
  public sampleCharacterLightSample(x: number, floorY: number): CharacterLightSample {
    const dimMul = this.lightsDimmed ? 0.32 : 1.0
    // Backlight is strongest right in front of rear wall lights (y=280) and softens toward front edge (y=344)
    const depthFactor = Math.max(0.25, Math.min(1, 1 - (floorY - 280) / 72))

    const rearSources: RearLightSource[] = []
    const shadowCasters: Array<{ x: number; wallY: number; elevation: number; weight: number }> = []

    // 1. Plinth LED Bars (low-elevation linear backlight -> long forward cast shadow)
    for (const p of PLINTH_CENTERS) {
      const clampedX = Math.max(p.x - p.halfW, Math.min(p.x + p.halfW, x))
      const edgeDist = Math.abs(x - clampedX) / 48
      if (edgeDist < 1) {
        rearSources.push({
          x: clampedX,
          radius: p.halfW,
          color: this.preset.plinthColor,
          strength: (1 - edgeDist) * 1.05 * depthFactor * (this.resonanceEnabled ? 1.18 : 1) * dimMul,
          isWarm: true,
        })
      }
      const casterX = Math.max(p.x - 32, Math.min(p.x + 32, x))
      const casterDist = Math.abs(x - casterX) / 105
      if (casterDist < 1) {
        shadowCasters.push({
          x: casterX,
          wallY: 270,
          elevation: 20,
          weight: Math.pow(1 - casterDist, 2.1) * 1.45 * depthFactor * (this.resonanceEnabled ? 1.2 : 1) * dimMul,
        })
      }
    }

    // 2. Side Digital Plaques + Spotlit Wall Exhibits
    for (const cx of SIDE_BAY_CENTERS) {
      const dist = Math.abs(x - cx) / 58
      if (dist < 1) {
        rearSources.push({
          x: cx,
          radius: 58,
          color: blendWeightedRgb(
            [
              { color: 0x82d8ff, weight: 0.65 },
              { color: this.preset.spotColor, weight: 0.35 },
            ],
            this.preset.spotColor,
          ),
          strength: (1 - dist) * 0.82 * depthFactor * dimMul,
          isWarm: false,
        })
      }
      const casterDist = Math.abs(x - cx) / 105
      if (casterDist < 1) {
        shadowCasters.push({
          x: cx,
          wallY: 268,
          elevation: 42,
          weight: Math.pow(1 - casterDist, 2.0) * 1.18 * depthFactor * dimMul,
        })
      }
    }

    // 3. Potted Tree Planter Bottom-Base Glow
    for (const tx of PLANTER_BASE_XS) {
      const dist = Math.abs(x - tx) / 36
      if (dist < 1) {
        rearSources.push({
          x: tx,
          radius: 36,
          color: this.preset.plinthColor,
          strength: (1 - dist) * 0.55 * depthFactor * dimMul,
          isWarm: true,
        })
      }
      const casterDist = Math.abs(x - tx) / 68
      if (casterDist < 1) {
        shadowCasters.push({
          x: tx,
          wallY: 274,
          elevation: 10,
          weight: Math.pow(1 - casterDist, 2.1) * 0.62 * depthFactor * dimMul,
        })
      }
    }

    // 5. Rear Atrium Skylight Wash Behind Main Paintings
    for (const cx of SKYLIGHT_CENTERS) {
      const dist = Math.abs(x - cx) / 78
      if (dist < 1) {
        rearSources.push({
          x: cx,
          radius: 78,
          color: this.preset.skylightColor,
          strength: (1 - dist) * 0.78 * depthFactor * (this.resonanceEnabled ? 1.3 : 1),
          isWarm: false,
        })
      }
      const casterDist = Math.abs(x - cx) / 145
      if (casterDist < 1) {
        shadowCasters.push({
          x: cx,
          wallY: 262,
          elevation: 95,
          weight: Math.pow(1 - casterDist, 2.0) * 0.62 * (this.resonanceEnabled ? 1.3 : 1),
        })
      }
    }

    let maxRear = 0
    let totalRear = 0
    let warmMix = 0
    let coolMix = 0
    let weightedLightX = 0
    const colorWeights: Array<{ color: number; weight: number }> = []

    for (const src of rearSources) {
      maxRear = Math.max(maxRear, src.strength)
      totalRear += src.strength
      if (src.isWarm) warmMix += src.strength
      else coolMix += src.strength
      weightedLightX += src.x * src.strength
      colorWeights.push({ color: src.color, weight: src.strength })
    }

    const backLightIntensity = Math.min(1, maxRear * 0.85 + totalRear * 0.25)
    const rimColor = blendWeightedRgb(colorWeights, this.preset.skylightColor)
    const rimAlpha = Math.min(0.95, 0.18 + backLightIntensity * 0.78)
    const dominantLightX = totalRear > 0.05 ? weightedLightX / totalRear : x
    const backLightDirX = Math.max(-1, Math.min(1, (x - dominantLightX) / 36))

    // 2.5D Perspective Ray Shadow Projection Solver (Dx, Dy from 3D light height Lz through Hero height Hz)
    const HERO_H = 52
    const computeAngleFade = (skew: number): number => {
      const absAngle = Math.abs(skew)
      const t = Math.max(0, Math.min(1, (absAngle - 0.12) / 1.06))
      const smooth = t * t * (3 - 2 * t)
      return 1 - smooth * 0.92
    }
    interface EvaluatedCaster {
      skew: number
      scaleY: number
      weight: number
    }
    const evaluatedCasters: EvaluatedCaster[] = []
    let casterWeightSum = 0
    let netSkewNumer = 0
    let netScaleNumer = 0

    for (const c of shadowCasters) {
      if (c.weight <= 0.001) continue
      const dDepth = Math.max(12, floorY - c.wallY)
      const perspRatio =
        c.elevation > HERO_H + 10
          ? HERO_H / (c.elevation - HERO_H)
          : 1.25 * (44 / (c.elevation + 22))
      const deltaX = Math.max(-52, Math.min(52, (x - c.x) * Math.min(1.15, perspRatio * 0.68)))
      const deltaY = Math.max(18, Math.min(58, dDepth * perspRatio + (c.elevation < 55 ? 28 : 12)))
      const skew = Math.atan2(deltaX, deltaY)
      const scaleY = Math.max(0.42, Math.min(1.15, deltaY / HERO_H))
      const effectiveWeight = c.weight * (0.28 + 0.72 * computeAngleFade(skew))
      evaluatedCasters.push({ skew, scaleY, weight: effectiveWeight })
      casterWeightSum += effectiveWeight
      netSkewNumer += skew * effectiveWeight
      netScaleNumer += scaleY * effectiveWeight
    }

    const netSkewX = casterWeightSum > 0.001 ? netSkewNumer / casterWeightSum : 0
    const netScaleY = casterWeightSum > 0.001 ? netScaleNumer / casterWeightSum : 0.72

    evaluatedCasters.sort((a, b) => b.weight - a.weight)
    const dom = evaluatedCasters[0]
    let pWeight = 0
    let pSkewNumer = 0
    let pScaleNumer = 0
    let sWeight = 0
    let sSkewNumer = 0
    let sScaleNumer = 0

    if (dom) {
      for (const ec of evaluatedCasters) {
        if (Math.abs(ec.skew - dom.skew) <= 0.22) {
          pWeight += ec.weight
          pSkewNumer += ec.skew * ec.weight
          pScaleNumer += ec.scaleY * ec.weight
        } else {
          sWeight += ec.weight
          sSkewNumer += ec.skew * ec.weight
          sScaleNumer += ec.scaleY * ec.weight
        }
      }
    }

    const shadowSkewX = pWeight > 0.001 ? pSkewNumer / pWeight : netSkewX
    const shadowScaleY = pWeight > 0.001 ? pScaleNumer / pWeight : netScaleY
    const primaryAngleFade = computeAngleFade(shadowSkewX)
    const shadowAlpha = Math.min(0.74, (0.34 + backLightIntensity * 0.4) * primaryAngleFade)

    const hasDiverging = sWeight > 0.04
    const secondaryShadowSkewX = hasDiverging ? sSkewNumer / sWeight : shadowSkewX
    const secondaryShadowScaleY = hasDiverging
      ? sScaleNumer / sWeight
      : Math.min(1.18, shadowScaleY * 1.06)
    const angleDiff = Math.abs(secondaryShadowSkewX - shadowSkewX)
    const divergeFade = hasDiverging ? Math.min(1, Math.max(0, (angleDiff - 0.14) / 0.26)) : 0
    const secondaryAngleFade = computeAngleFade(secondaryShadowSkewX)
    const secondaryShadowAlpha = hasDiverging
      ? Math.min(0.46, (0.14 + Math.min(1, sWeight) * 0.28) * divergeFade * secondaryAngleFade)
      : shadowAlpha * 0.24

    // Natural HD-2D ambient + directional bounce lighting (no artificial contre-jour silhouette darkening)
    const warmClamped = Math.min(1, warmMix)
    const coolClamped = Math.min(1, coolMix)
    let r = 0.88 + warmClamped * 0.12 - coolClamped * 0.03
    let g = 0.9 + warmClamped * 0.06 + coolClamped * 0.05
    let b = 0.95 - warmClamped * 0.04 + coolClamped * 0.07

    if (this.preset.id === 'amber_evening') {
      r += 0.06
      g += 0.02
      b -= 0.06
    } else if (this.preset.id === 'starlight_dream') {
      r -= 0.03
      g += 0.04
      b += 0.08
    }

    if (this.lightsDimmed) {
      r *= 0.78
      g *= 0.8
      b *= 0.88
    }

    const clampBody = (v: number) => Math.max(115, Math.min(255, Math.round(v * 255)))
    const bodyTint = (clampBody(r) << 16) | (clampBody(g) << 8) | clampBody(b)

    // Cooler tinted obsidian floor reflection
    const clampRef = (v: number) => Math.max(105, Math.min(255, Math.round(v * 255)))
    const reflectionTint =
      (clampRef(r * 0.78) << 16) | (clampRef(g * 0.84) << 8) | clampRef(b * 1.02)

    const shadowOffsetX = Math.max(-10, Math.min(10, Math.round(Math.sin(netSkewX) * 12)))
    const shadowStretchY = 1 + netScaleY * 0.85

    return {
      bodyTint,
      reflectionTint,
      rimColor,
      rimAlpha,
      backLightIntensity,
      backLightDirX,
      shadowOffsetX,
      shadowStretchY,
      shadowSkewX,
      shadowScaleY,
      shadowAlpha,
      secondaryShadowSkewX,
      secondaryShadowScaleY,
      secondaryShadowAlpha,
    }
  }

  public setCameraFocus(mode: ActiveMode, hotspot: Hotspot | null, heroX: number): void {
    if (mode === 'register') {
      this.patrolActive = false
      this.focusX = 320
      this.focusY = 232
      this.focusZoom = 1.44
      this.dofBlurFilter.strength = 3.2
    } else if (mode === 'prologue') {
      this.patrolActive = false
      this.prologueElapsedSec = 0
      const targetX = hotspot ? hotspot.x : heroX
      this.focusX = Math.max(SCENE_WIDTH * 0.5, Math.min(WORLD_WIDTH - SCENE_WIDTH * 0.5, targetX))
      this.focusY = 560
      this.focusZoom = 1.0
      this.prologueTreeX = Math.round(this.focusX - 138)
      this.dofBlurFilter.strength = 0.4
    } else if (mode === 'gaze_center') {
      this.patrolActive = false
      const cx = hotspot ? hotspot.x : WING_CENTERS.center
      this.focusX = cx
      this.focusY = 152
      this.focusZoom = 1.44
      this.dofBlurFilter.strength = 3.2
    } else if (mode === 'inspect_artwork') {
      this.patrolActive = false
      this.focusX = hotspot ? hotspot.x : heroX
      this.focusY = 186
      this.focusZoom = 1.38
      this.dofBlurFilter.strength = 2.8
    } else if (mode === 'sit_bench') {
      this.patrolActive = false
      this.focusX = hotspot ? hotspot.x : heroX
      this.focusY = 192
      this.focusZoom = 1.06
      this.dofBlurFilter.strength = 3.0
    } else if (mode === 'wardrobe') {
      this.patrolActive = false
      this.focusX = Math.max(160, Math.min(WORLD_WIDTH - 160, heroX + 60))
      this.focusY = 232
      this.focusZoom = 1.32
      this.dofBlurFilter.strength = 2.5
    } else {
      this.dofBlurFilter.strength = 2.2
    }
  }

  public updateCameraTarget(mode: ActiveMode, hero: HeroTelemetry, dt: number): void {
    let rawX: number
    let rawY: number
    let rawZoom: number

    if (mode === 'explore') {
      if (this.patrolActive) {
        this.patrolPhase += dt * 0.2
        rawX = 1280 + Math.sin(this.patrolPhase) * 940
        rawY = 176 + Math.cos(this.patrolPhase * 2) * 8
        rawZoom = 1.08 + Math.sin(this.patrolPhase * 1.5) * 0.06
      } else {
        const targetLead = (hero.facing === 'right' ? 1 : -1) * (hero.isRunning ? 48 : 22)
        const leadLerp = 1 - Math.exp(-dt * 4.5)
        this.lookAheadX += (targetLead - this.lookAheadX) * leadLerp

        rawX = hero.x + this.lookAheadX + this.manualPanX
        rawY = 180 + (hero.floorY - 306) * 0.22 - hero.jumpZ * 0.16
        rawZoom = this.userZoom * (hero.isRunning ? 0.97 : 1.0)
      }
    } else {
      rawX = this.focusX
      rawY = this.focusY
      rawZoom = this.focusZoom
    }

    const halfW = (SCENE_WIDTH * 0.5) / rawZoom
    const halfH = (SCENE_HEIGHT * 0.5) / rawZoom
    const maxCamY = mode === 'prologue' ? 778 - halfH : SCENE_HEIGHT - halfH
    this.cameraTargetZoom = rawZoom
    this.cameraTargetX = Math.max(halfW, Math.min(WORLD_WIDTH - halfW, rawX))
    this.cameraTargetY = Math.max(halfH, Math.min(maxCamY, rawY))
  }

  public updateHotspotIndicator(_hotspot: Hotspot | null): void {
    // World-space dot suppressed so only the tactile [E] keycap & typewriter prompt appear
    this.activePromptContainer.visible = false
  }

  public update(deltaMs: number, renderer: Renderer, mode: ActiveMode, hero: HeroTelemetry): void {
    const dt = Math.min(0.05, deltaMs / 1000)
    this.timeSec += dt

    // 1. Update & Lerp Camera Pan/Zoom + Parallax Layers
    this.updateCameraTarget(mode, hero, dt)
    const camSpeed = mode === 'prologue' || this.cameraY > 205 ? 2.6 : 5.8
    const camLerp = 1 - Math.exp(-dt * camSpeed)
    this.cameraX += (this.cameraTargetX - this.cameraX) * camLerp
    this.cameraY += (this.cameraTargetY - this.cameraY) * camLerp
    this.cameraZoom += (this.cameraTargetZoom - this.cameraZoom) * camLerp

    this.worldLayer.pivot.set(this.cameraX, this.cameraY)
    this.worldLayer.position.set(SCENE_WIDTH / 2, SCENE_HEIGHT / 2)
    this.worldLayer.scale.set(this.cameraZoom)

    // Distant sky moves slowly (0.15x screen motion); foreground moves 1.14x faster than main wall plane
    this.skyBackdropLayer.position.set((this.cameraX - WING_CENTERS.center) * 0.85, 0)
    this.foregroundParallaxLayer.position.set(-(this.cameraX - WING_CENTERS.center) * 0.14, 0)

    // 1b. Animate Registration Backdrop Fade + Entrance Turnstile Gate Flaps + Frosted-Glass Double Doors
    const regLerp = 1 - Math.exp(-dt * 4.8)
    this.regCorridorFadeAlpha += (this.regCorridorTargetAlpha - this.regCorridorFadeAlpha) * regLerp
    if (Math.abs(this.regCorridorTargetAlpha - this.regCorridorFadeAlpha) < 0.002) {
      this.regCorridorFadeAlpha = this.regCorridorTargetAlpha
    }
    const rFade = this.regCorridorFadeAlpha
    this.regBackdropLayer.visible = rFade > 0.002
    this.regBackdropLayer.alpha = rFade
    this.regPedestalFloorSprite.visible = rFade > 0.002
    this.regPedestalFloorSprite.alpha = rFade

    const hallReveal = Math.max(0, 1 - rFade)
    this.floorBaseSprite.alpha = hallReveal
    this.floorReflSprite.alpha = hallReveal
    this.floorGroutSprite.alpha = 0.12 + hallReveal * 0.88
    this.floorLightingLayer.alpha = hallReveal
    this.floorRugLayer.alpha = hallReveal
    this.staticFloorShadowSprite.alpha = hallReveal
    this.midVolumetricLightingLayer.alpha = 0.32 + hallReveal * 0.68
    this.foregroundParallaxLayer.visible = rFade < 0.35

    const gateReveal = Math.max(0, 1 - rFade * 1.45)
    this.entranceGateContainer.visible = gateReveal > 0.01
    this.entranceGateContainer.alpha = gateReveal
    this.entranceStanchionSprite.visible = gateReveal > 0.01
    this.entranceStanchionSprite.alpha = gateReveal

    if (this.entranceAnimDelaySec > 0) {
      this.entranceAnimDelaySec = Math.max(0, this.entranceAnimDelaySec - dt)
    } else {
      const gateTarget = this.entranceGateOpen ? 1 : 0
      if (Math.abs(this.gateOpenProgress - gateTarget) > 0.001) {
        const stepDelta = dt * 1.65
        if (this.gateOpenProgress < gateTarget) {
          this.gateOpenProgress = Math.min(1, this.gateOpenProgress + stepDelta)
        } else {
          this.gateOpenProgress = Math.max(0, this.gateOpenProgress - stepDelta)
        }
        this.redrawGateFlapsAndStatus()
      }
      const doorTarget = this.entranceDoorOpen ? 1 : 0
      if (Math.abs(this.doorOpenProgress - doorTarget) > 0.001) {
        const doorStep = dt * 1.35
        if (this.doorOpenProgress < doorTarget) {
          this.doorOpenProgress = Math.min(1, this.doorOpenProgress + doorStep)
        } else {
          this.doorOpenProgress = Math.max(0, this.doorOpenProgress - doorStep)
        }
        const doorEase =
          this.doorOpenProgress < 0.5
            ? 4 * this.doorOpenProgress * this.doorOpenProgress * this.doorOpenProgress
            : 1 - Math.pow(-2 * this.doorOpenProgress + 2, 3) / 2
        const slidePx = Math.round(doorEase * 48)
        this.leftDoorSprite.x = 269 - slidePx
        this.rightDoorSprite.x = 320 + slidePx
        this.updateFrostedBlurMask(slidePx)
      }
    }
    if (this.doorThresholdGlow) {
      this.doorThresholdGlow.alpha = 0.16 + this.doorOpenProgress * 0.34
    }
    for (let i = 0; i < this.gateFloorGlowSprites.length; i++) {
      const g = this.gateFloorGlowSprites[i]
      g.tint = this.gateOpenProgress > 0.5 ? 0x58ffe0 : 0xffb357
      g.alpha = (0.28 + this.gateOpenProgress * 0.24) * (0.9 + Math.sin(this.timeSec * 3.2 + i) * 0.1)
    }

    // 2. Animated Artworks Across All Three Wings
    const flowSpeed = this.resonanceEnabled ? 18 : 8
    const step = Math.floor(this.timeSec * flowSpeed)
    this.waterfallAnimGfx.clear()
    for (const wf of this.artworks.waterfallZones) {
      for (let py = 0; py < wf.h; py += 2) {
        const yOff = (py + step) % wf.h
        const xOff = (py + step) % Math.max(1, wf.w - 2)
        this.waterfallAnimGfx
          .rect(wf.x + 1 + xOff, wf.y + yOff, 1, 2)
          .fill({ color: 0xe6ffff, alpha: this.resonanceEnabled ? 0.72 : 0.45 })
      }
    }

    this.starAnimGfx.clear()
    for (const st of this.artworks.starPoints) {
      const pulse = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(this.timeSec * 2.8 + st.phase))
      this.starAnimGfx
        .rect(st.x, st.y, 1, 1)
        .fill({ color: 0xffffff, alpha: pulse * (this.resonanceEnabled ? 0.95 : 0.55) })
    }
    if (this.resonanceEnabled) {
      for (let i = 0; i < 10; i++) {
        const mx = 42 + ((i * 19 + Math.floor(this.timeSec * 3)) % 36)
        const my = 154 - ((Math.floor(this.timeSec * 6) + i * 11) % 34)
        this.starAnimGfx.rect(mx, my, 1, 1).fill({ color: 0xffe88c, alpha: 0.75 })
      }
    }

    this.westAnimGfx.clear()
    for (const pt of this.artworks.westShimmerPoints) {
      const tw = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(this.timeSec * 3.1 + pt.phase))
      this.westAnimGfx.rect(pt.x, pt.y, 1, 1).fill({ color: pt.color, alpha: tw * 0.8 })
    }

    this.eastAnimGfx.clear()
    for (const em of this.artworks.eastEmberPoints) {
      const rise = (Math.floor(this.timeSec * 6) + Math.floor(em.phase * 10)) % 18
      const ey = Math.max(24, em.y - rise)
      const alpha = 0.35 + 0.55 * (1 - rise / 18)
      this.eastAnimGfx.rect(em.x, ey, 1, 1).fill({ color: 0xffe38f, alpha })
    }

    // 3. Subtle Volumetric Breathing & Sconce Flicker across Layered Beams
    const breath = 0.92 + Math.sin(this.timeSec * 1.45) * 0.08
    const resSkyMul = this.resonanceEnabled ? 1.45 : 1.0
    for (let i = 0; i < this.backSkylightRays.length; i++) {
      const shaftWave = 0.9 + Math.sin(this.timeSec * 1.8 + i * 0.7) * 0.1
      this.backSkylightRays[i].alpha = Math.min(
        0.95,
        this.preset.skylightAlpha * 0.58 * resSkyMul * breath * shaftWave,
      )
      this.frontSkylightRays[i].alpha = Math.min(
        0.75,
        this.preset.skylightAlpha * 0.24 * resSkyMul * breath * shaftWave,
      )
    }

    const dimMul = this.lightsDimmed ? 0.35 : 1.0
    for (let i = 0; i < this.spotGlints.length; i++) {
      this.spotGlints[i].alpha = (0.72 + Math.sin(this.timeSec * 2.4 + i) * 0.14) * dimMul
    }
    for (let i = 0; i < this.sconceGlowSprites.length; i++) {
      const flicker = 0.54 + Math.sin(this.timeSec * 3.1 + i * 1.7) * 0.05 + Math.sin(this.timeSec * 7.3 + i) * 0.02
      this.sconceGlowSprites[i].alpha = this.preset.sconceAlpha * flicker * dimMul
    }

    // 3b. Gentle Organic Foliage Breeze & Animated Gallery Devices
    this.updatePlantSway()
    this.updateEquipmentAnimations(dimMul)
    if (this.entranceGateContainer.visible) {
      this.redrawGateAnimatedIndicators()
    }

    // 4. Light-Field Reactive Floating Dust Motes
    for (const p of this.dustParticles) {
      p.x += (p.vx + Math.sin(this.timeSec * 0.8 + p.phase) * 3) * dt
      p.y += p.vy * (this.resonanceEnabled ? 1.55 : 1.0) * dt
      if (p.y < 18) {
        p.y = 315
        p.x = 30 + ((p.x * 1.37) % (WORLD_WIDTH - 60))
      }
      if (p.x < 16) p.x = WORLD_WIDTH - 16
      if (p.x > WORLD_WIDTH - 16) p.x = 16

      const fieldLum = this.sampleLightFieldIntensity(p.x, p.y)
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.timeSec * 2.2 + p.phase))
      const inAtrium = SKYLIGHT_CENTERS.some((cx) => Math.abs(p.x - cx) < 90)
      p.sprite.position.set(Math.round(p.x), Math.round(p.y))
      p.sprite.tint = this.resonanceEnabled && inAtrium ? 0x9ef7ff : this.preset.dustColor
      p.sprite.alpha = Math.min(1, p.baseAlpha * tw * fieldLum * (this.resonanceEnabled ? 1.25 : 1))
    }

    // 5. Foreground Out-of-Focus Bokeh Orbs
    for (const b of this.bokehParticles) {
      const ox = Math.sin(this.timeSec * 0.45 + b.phase) * 14
      const oy = Math.cos(this.timeSec * 0.38 + b.phase) * 4
      const pulse = 0.65 + 0.35 * Math.sin(this.timeSec * 1.2 + b.phase)
      b.sprite.position.set(b.baseX + ox, b.baseY + oy)
      b.sprite.tint = b.isWarm ? this.preset.sconceColor : this.preset.skylightColor
      b.sprite.alpha = b.baseAlpha * pulse * dimMul
    }

    // 5b. Subterranean Prologue "Sleepless Branches" Growth & Pruning Animation
    const showPrologue = mode === 'prologue' || this.cameraY > 195
    this.prologueLayer.visible = showPrologue
    if (showPrologue) {
      if (mode === 'prologue') {
        this.prologueElapsedSec += dt
      }
      this.drawPrologueTreeAnimation(this.prologueElapsedSec, this.timeSec)
    }

    // 6. Update Tilt-Shift DoF RenderTexture (~30fps)
    if (this.timeSec - this.lastDofUpdate >= 1 / 30) {
      this.lastDofUpdate = this.timeSec
      renderer.render({ container: this.worldLayer, target: this.dofRenderTex, clear: true })
    }
  }

  private updatePlantSway(): void {
    const t = this.timeSec
    for (const tree of this.animatedTrees) {
      const airCurrent = Math.sin(t * 0.52 - tree.anchorX * 0.0045)
      const trunkWave =
        Math.sin(t * 1.15 + tree.phase) * 0.68 +
        Math.sin(t * 1.95 + tree.phase * 1.45) * 0.22 +
        airCurrent * 0.25
      const canopyLag =
        Math.sin(t * 1.15 + tree.phase - 0.52) * 0.72 +
        Math.sin(t * 2.25 + tree.phase * 1.7 - 0.3) * 0.28 +
        airCurrent * 0.3
      const amp = tree.isSecondFloor ? 0.78 : 1.0

      tree.trunkSprite.rotation = trunkWave * 0.015 * amp
      tree.canopySprite.rotation = canopyLag * 0.025 * amp
      tree.canopySprite.skew.x = -Math.sin(t * 1.65 + tree.phase * 1.1) * 0.014 * amp
      tree.canopySprite.scale.y = 1 + Math.sin(t * 2.1 + tree.phase + 0.8) * 0.012 * amp
    }
  }

  private updateEquipmentAnimations(dimMul: number): void {
    const g = this.deviceAnimGfx
    g.clear()
    const t = this.timeSec
    // Illuminated digital devices retain crisp readability even when hall ambiance is dimmed
    const devVis = 0.72 + 0.28 * dimMul

    // 1. Self-Service Ticket Kiosk (x=459..489, y=186..272)
    const crownX = 468 + (Math.floor(t * 6) % 10)
    g.rect(crownX, 190, 3, 1).fill({ color: 0xe6fcff, alpha: 0.82 * devVis })
    g.rect(481, 197, 1, 2).fill({ color: 0xb0ffff, alpha: (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 4.4))) * devVis })

    const kioskTiles: Array<[number, number, number, number]> = [
      [465, 202, 8, 8],
      [475, 202, 8, 8],
      [465, 212, 8, 7],
      [475, 212, 8, 7],
    ]
    const activeTile = Math.floor(t * 0.75) % kioskTiles.length
    const [tx, ty, tw, th] = kioskTiles[activeTile]
    const tilePulse = 0.5 + 0.5 * Math.sin(t * 5.2)
    g.rect(tx, ty, tw, th).fill({ color: 0xaef2ff, alpha: (0.2 + 0.14 * tilePulse) * devVis })
    g.rect(tx, ty, tw, 1).fill({ color: 0xffffff, alpha: (0.45 + 0.3 * tilePulse) * devVis })

    const kioskScanY = 196 + (Math.floor(t * 9) % 27)
    g.rect(465, kioskScanY, 18, 1).fill({ color: 0xe2fbff, alpha: 0.16 * devVis })

    const ctaX = 465 + (Math.floor(t * 8) % 16)
    g.rect(ctaX, 220, 3, 2).fill({ color: 0xeafffa, alpha: 0.52 * devVis })

    const laserY = 232 + Math.round((0.5 + 0.5 * Math.sin(t * 3.8)) * 5)
    g.rect(465, 231, 9, 7).fill({ color: 0xff4f6c, alpha: (0.06 + 0.08 * Math.sin(t * 7.6)) * devVis })
    g.rect(466, laserY, 7, 1).fill({ color: 0xff6e84, alpha: 0.92 * devVis })
    g.rect(468, laserY, 3, 1).fill({ color: 0xffe6eb, alpha: 0.85 * devVis })

    const nfcPulse = 0.5 + 0.5 * Math.sin(t * 3.2)
    g.rect(479, 232, 3, 3).fill({ color: 0xc2fff5, alpha: (0.16 + 0.36 * nfcPulse) * devVis })
    g.rect(479, 237, 1, 1).fill({ color: 0x8effeb, alpha: (0.3 + 0.65 * (0.5 + 0.5 * Math.sin(t * 6.4))) * devVis })
    g.rect(480, 245, 1, 1).fill({ color: 0x7effd4, alpha: (0.25 + 0.65 * nfcPulse) * devVis })
    g.rect(471, 247, 5, 1).fill({ color: 0xfff8de, alpha: (0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * 2.1))) * devVis })

    // 2. Reception Desk Workstation, Scanner, Banker Lamp & Cove Strip
    const lampShimmer = 0.5 + 0.5 * Math.sin(t * 4.2)
    g.rect(78, 208, 10, 2).fill({ color: 0xfff9df, alpha: (0.14 + 0.16 * lampShimmer) * devVis })

    // Workstation monitor telemetry bars, status ticker & subtle CRT sweep
    const barOffsets = [0, 1.3, 2.5, 3.8]
    for (let bi = 0; bi < barOffsets.length; bi++) {
      const bh = 1 + Math.round((0.5 + 0.5 * Math.sin(t * 3.8 + barOffsets[bi])) * 4)
      g.rect(124 + bi * 2, 216 - bh, 1, bh).fill({ color: 0x88e6ff, alpha: 0.84 * devVis })
    }
    const tickerX = 113 + (Math.floor(t * 5) % 7)
    g.rect(tickerX, 214, 2, 1).fill({ color: 0xfff1c6, alpha: 0.82 * devVis })
    g.rect(130, 206, 1, 1).fill({ color: 0x90ffd9, alpha: (0.35 + 0.6 * (0.5 + 0.5 * Math.sin(t * 5.0))) * devVis })
    const monScanY = 206 + (Math.floor(t * 7) % 11)
    g.rect(112, monScanY, 20, 1).fill({ color: 0xd4f4ff, alpha: 0.13 * devVis })

    // Countertop QR/NFC scanner sweep + heartbeat LED
    const deskScanX = 147 + Math.round((0.5 + 0.5 * Math.sin(t * 3.1)) * 4)
    g.rect(deskScanX, 217, 2, 1).fill({ color: 0xd6ffff, alpha: 0.9 * devVis })
    g.rect(153, 220, 1, 1).fill({
      color: 0xffffff,
      alpha: (0.2 + 0.72 * (0.5 + 0.5 * Math.sin(t * 3.6))) * devVis,
    })

    // Under-counter amber cove light wave
    const coveX = 62 + Math.round((0.5 + 0.5 * Math.sin(t * 0.95)) * 108)
    g.rect(coveX, 228, 18, 2).fill({ color: 0xfff3d0, alpha: 0.24 * devVis })
    g.rect(coveX + 6, 228, 6, 1).fill({ color: 0xffffff, alpha: 0.34 * devVis })

    // 3. Suspended Overhead Guidance Signboard (animated rightward arrow progression)
    const arrowStage = (t * 2.2) % 3
    const glowAtStage = (target: number) => {
      const dist = Math.min(Math.abs(arrowStage - target), 3 - Math.abs(arrowStage - target))
      return Math.max(0, 1 - dist * 1.15)
    }
    const s0 = glowAtStage(0)
    const s1 = glowAtStage(1)
    const s2 = glowAtStage(2)
    if (s0 > 0.05) g.rect(357, 111, 5, 2).fill({ color: 0xfff4cc, alpha: s0 * 0.72 * devVis })
    if (s1 > 0.05) g.rect(363, 109, 2, 6).fill({ color: 0xfff4cc, alpha: s1 * 0.78 * devVis })
    if (s2 > 0.05) g.rect(365, 110, 2, 4).fill({ color: 0xffffff, alpha: s2 * 0.84 * devVis })
    g.rect(286, 110, 4, 4).fill({
      color: 0xffeeb0,
      alpha: (0.14 + 0.24 * (0.5 + 0.5 * Math.sin(t * 2.0))) * devVis,
    })
    const brassGlintX = 252 + (Math.floor(t * 14) % 126)
    g.rect(brassGlintX, 100, 10, 1).fill({ color: 0xfff5d4, alpha: 0.45 * devVis })

    // 3b. First Hall Main Visual "Growing Algorithmic Tree" Node & Seed Pulse (x = 518..574, y = 138..224)
    const seedPulse = 0.5 + 0.5 * Math.sin(t * 3.0)
    g.rect(544, 204, 4, 4).fill({ color: 0xffe89e, alpha: (0.35 + 0.55 * seedPulse) * devVis })
    const bfsNodes: Array<[number, number, number, number]> = [
      [545, 195, 0xf2c977, 0.0],
      [545, 185, 0x94c4a2, 0.8],
      [535, 185, 0xf2c977, 1.5],
      [554, 185, 0x94c4a2, 2.1],
      [535, 175, 0xffe89e, 2.8],
      [554, 175, 0xffe89e, 3.4],
      [545, 145, 0xfff8de, 4.1],
    ]
    for (const [nx, ny, col, phase] of bfsNodes) {
      const a = (0.2 + 0.68 * (0.5 + 0.5 * Math.sin(t * 3.4 - phase))) * devVis
      g.rect(nx, ny, 2, 2).fill({ color: col, alpha: a })
    }
    // Pruned red state blink indicators
    const pruneBlink = (0.18 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2 + 1.2))) * devVis
    g.rect(530, 190, 2, 2).fill({ color: 0xd45848, alpha: pruneBlink })
    g.rect(560, 187, 2, 2).fill({ color: 0xd45848, alpha: pruneBlink })

    // 4. Wing OLED Exhibition Display Plaques
    for (let i = 0; i < SIDE_BAY_CENTERS.length; i++) {
      const cx = SIDE_BAY_CENTERS[i]
      if (cx >= 640) {
        const qx0 = cx - 40
        const mirrorLeft = i % 2 === 0
        const thumbX = mirrorLeft ? qx0 + 2 : qx0 + 50
        const textX = mirrorLeft ? qx0 + 34 : qx0 + 4

        const sy = 231 + (Math.floor(t * 6 + i * 2) % 13)
        g.rect(qx0 - 1, sy, 82, 1).fill({ color: 0xc2ecff, alpha: 0.14 * devVis })

        const curAlpha = (0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 4.2 + i * 1.1))) * devVis
        g.rect(textX + 26, 233, 2, 2).fill({ color: 0xbcf4ff, alpha: curAlpha })

        for (let b = 0; b < 3; b++) {
          const h = 1 + Math.round((0.5 + 0.5 * Math.sin(t * 4.0 + i + b * 1.4)) * 2)
          g.rect(textX + 36 + b * 2, 242 - h, 1, h).fill({ color: 0x8ee2ff, alpha: 0.72 * devVis })
        }

        const sheenX = thumbX + (Math.floor(t * 5 + i * 3) % 24)
        g.rect(sheenX, 232, 3, 11).fill({ color: 0xe6f8ff, alpha: 0.1 * devVis })
      }
      if (this.plaqueGlowSprites[i]) {
        const shimmer = 0.92 + Math.sin(t * 2.5 + i * 0.9) * 0.08
        this.plaqueGlowSprites[i].alpha = 0.68 * shimmer * dimMul
      }
      if (this.plaqueFloorPools[i]) {
        const shimmer = 0.92 + Math.sin(t * 2.5 + i * 0.9) * 0.08
        this.plaqueFloorPools[i].alpha = 0.26 * shimmer * dimMul
      }
    }

    // 5. Central Wing Lighting Console Indicators (x=1475..1485, y=228..250)
    const warmPulse = this.lightsDimmed ? 0.25 : 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2.6))
    g.rect(1478, 232, 4, 4).fill({ color: 0xffe4aa, alpha: warmPulse * devVis })
    const resSpeed = this.resonanceEnabled ? 6.2 : 2.1
    const resAlpha = (this.resonanceEnabled ? 0.62 : 0.24) + 0.35 * (0.5 + 0.5 * Math.sin(t * resSpeed))
    g.rect(1478, 239, 4, 4).fill({ color: 0xc2f6ff, alpha: resAlpha * devVis })

    // 6. Central Exhibition Plinth Amber LED Channels
    for (let i = 0; i < PLINTH_CENTERS.length; i++) {
      const p = PLINTH_CENTERS[i]
      const span = p.halfW * 2 - 22
      const pos = p.x - p.halfW + 2 + Math.round((0.5 + 0.5 * Math.sin(t * 0.9 + i * 2.1)) * span)
      g.rect(pos, 265, 18, 2).fill({ color: 0xffebb8, alpha: 0.26 * devVis })
      g.rect(pos + 7, 265, 4, 1).fill({ color: 0xffffff, alpha: 0.42 * devVis })
    }

    // 7. Entrance Device Halo Glow Synchronization
    if (this.deskLampGlowSprite) {
      this.deskLampGlowSprite.alpha = (0.68 + Math.sin(t * 4.2) * 0.06) * dimMul
    }
    if (this.kioskGlowSprite) {
      this.kioskGlowSprite.alpha = (0.52 + Math.sin(t * 3.1 + 0.6) * 0.07) * (0.5 + 0.5 * dimMul)
    }
    if (this.signHaloSprite) {
      this.signHaloSprite.alpha = (0.3 + Math.sin(t * 2.2) * 0.04) * dimMul
    }
  }

  private drawPrologueTreeAnimation(elapsed: number, t: number): void {
    const g = this.prologueAnimGfx
    g.clear()

    const cx = this.prologueTreeX
    const baseY = 656
    const p = Math.max(0, Math.min(1, elapsed / 13.5))
    const seg = (start: number, end: number) => Math.max(0, Math.min(1, (p - start) / (end - start)))

    // Stage 1: Seed awakening & discrete square wave ripples (0.0 .. 0.24)
    const seedAlpha = Math.min(1, elapsed / 0.8)
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.4)
    for (let r = 0; r < 2; r++) {
      const wave = ((elapsed * 0.45 + r * 0.5) % 1)
      const rad = Math.round(10 + wave * 34)
      const wa = (1 - wave) * 0.28 * seedAlpha
      g.rect(cx - rad, baseY - Math.round(rad * 0.35), rad * 2, 1).fill({ color: 0xf2c977, alpha: wa })
    }
    // Root tendrils spreading left & right
    const rootSpan = Math.round(seg(0.02, 0.25) * 44)
    if (rootSpan > 0) {
      g.rect(cx - rootSpan, baseY + 2, rootSpan * 2, 2).fill({ color: 0x4d6b57, alpha: 0.75 * seedAlpha })
      g.rect(cx - Math.round(rootSpan * 0.65), baseY + 5, Math.round(rootSpan * 1.3), 1).fill({
        color: 0x3b5243,
        alpha: 0.65 * seedAlpha,
      })
    }
    // Glowing pixel seed core
    g.rect(cx - 5, baseY - 6, 10, 8).fill({ color: 0xf2c977, alpha: (0.2 + 0.18 * pulse) * seedAlpha })
    g.rect(cx - 3, baseY - 4, 6, 5).fill({ color: 0x6e987c, alpha: seedAlpha })
    g.rect(cx - 2, baseY - 3, 4, 3).fill({ color: 0xffe89e, alpha: seedAlpha })

    // Stage 2: Trunk & BFS branch growth (0.14 .. 0.58)
    const trunkGrow = seg(0.12, 0.38)
    if (trunkGrow > 0) {
      const th = Math.round(trunkGrow * 66)
      g.rect(cx - 2, baseY - 4 - th, 4, th).fill({ color: 0x6e987c, alpha: 0.92 })
      g.rect(cx - 1, baseY - 4 - th, 1, th).fill({ color: 0xf2c977, alpha: 0.85 })
    }

    // Primary bifurcation at y = baseY - 70
    const b1 = seg(0.32, 0.54)
    if (b1 > 0) {
      const span1 = Math.round(b1 * 38)
      const rise1 = Math.round(b1 * 48)
      g.rect(cx - span1, baseY - 70, span1 * 2, 2).fill({ color: 0x6e987c, alpha: 0.9 })
      // Highlighted optimal path climbing up left-center branch
      g.rect(cx - span1, baseY - 70, span1, 2).fill({ color: 0xf2c977, alpha: 0.85 })
      if (rise1 > 0) {
        g.rect(cx - span1, baseY - 70 - rise1, 2, rise1).fill({ color: 0xf2c977, alpha: 0.9 })
        g.rect(cx + span1 - 2, baseY - 70 - rise1, 2, rise1).fill({ color: 0x8ab898, alpha: 0.88 })
      }
    }

    // Upper crown bridge & sub-branches (0.50 .. 0.74)
    const b2 = seg(0.48, 0.72)
    if (b2 > 0) {
      const span2 = Math.round(b2 * 56)
      const rise2 = Math.round(b2 * 38)
      g.rect(cx - 38 - Math.round(b2 * 18), baseY - 118, Math.round(b2 * 38), 2).fill({
        color: 0x94c4a2,
        alpha: 0.9,
      })
      g.rect(cx + 38 - Math.round(b2 * 18), baseY - 118, Math.round(b2 * 38), 2).fill({
        color: 0x94c4a2,
        alpha: 0.9,
      })
      if (rise2 > 0) {
        g.rect(cx - 24, baseY - 118 - rise2, 2, rise2).fill({ color: 0xf2c977, alpha: 0.92 })
        g.rect(cx + 22, baseY - 118 - rise2, 2, rise2).fill({ color: 0x8ab898, alpha: 0.88 })
        g.rect(cx - Math.round(span2 * 0.42), baseY - 118 - rise2, Math.round(span2 * 0.84), 2).fill({
          color: 0xf2c977,
          alpha: 0.72,
        })
      }
    }

    // Stage 3: Pruned dead-end branches turning dark red and dissolving into quiet negative space (0.38 .. 0.82)
    const pruneSpawn = seg(0.36, 0.56)
    const pruneFade = seg(0.58, 0.86)
    const pruneAlpha = pruneSpawn * (1 - pruneFade * 0.76)
    if (pruneAlpha > 0.02) {
      const prunedOffsets: Array<[number, number, number]> = [
        [-32, -46, -18],
        [24, -54, 22],
        [-58, -94, -20],
        [54, -98, 22],
        [-14, -96, -10],
      ]
      for (const [ox, oy, dx] of prunedOffsets) {
        const bx = cx + (dx > 0 ? Math.abs(ox) - dx : ox)
        const by = baseY + oy
        const len = Math.round(Math.abs(dx) * pruneSpawn)
        g.rect(bx, by, len, 2).fill({ color: 0xa83c32, alpha: pruneAlpha * 0.88 })
        // Hollow pruned node at tip + drifting cut embers
        const tipX = dx > 0 ? bx + len : bx - 3
        g.rect(tipX, by - 1, 4, 4).fill({ color: 0xd45848, alpha: pruneAlpha })
        g.rect(tipX + 1, by, 2, 2).fill({ color: 0x16110e, alpha: pruneAlpha })
        if (pruneFade > 0.05) {
          const driftY = by - Math.round(pruneFade * 16)
          g.rect(tipX + 1, driftY, 2, 2).fill({ color: 0xe07a6d, alpha: (1 - pruneFade) * 0.8 })
        }
      }
    }

    // State-space square nodes along cultivated path
    const nodes: Array<[number, number, number, number]> = [
      [cx, baseY - 36, 0.25, 0xf2c977],
      [cx, baseY - 70, 0.36, 0xf2c977],
      [cx - 38, baseY - 70, 0.45, 0xffe89e],
      [cx + 38, baseY - 70, 0.48, 0x94c4a2],
      [cx - 38, baseY - 118, 0.56, 0xffe89e],
      [cx + 38, baseY - 118, 0.6, 0x94c4a2],
      [cx - 24, baseY - 156, 0.7, 0xffe89e],
      [cx + 22, baseY - 156, 0.72, 0xf4efe2],
    ]
    for (const [nx, ny, threshold, col] of nodes) {
      const na = seg(threshold, threshold + 0.1)
      if (na > 0) {
        g.rect(nx - 3, ny - 3, 6, 6).fill({ color: col, alpha: na * 0.92 })
        g.rect(nx - 1, ny - 1, 2, 2).fill({ color: 0xfff9e6, alpha: na })
      }
    }

    // Stage 4: Blooming algorithmic blossoms & rising starlight spores (0.68 .. 1.0)
    const bloom = seg(0.66, 0.95)
    if (bloom > 0) {
      const blossoms: Array<[number, number, number, number]> = [
        [cx - 24, baseY - 160, 0xf2c977, 0.0],
        [cx + 22, baseY - 160, 0xf4efe2, 0.9],
        [cx, baseY - 172, 0xffe89e, 1.7],
        [cx - 50, baseY - 124, 0xd45848, 2.4],
        [cx + 50, baseY - 124, 0x94c4a2, 3.1],
      ]
      for (const [fx, fy, petalCol, ph] of blossoms) {
        const s = Math.max(1, Math.round(bloom * 4))
        const glow = (0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.8 + ph))) * bloom
        g.rect(fx - s - 2, fy - s - 2, (s + 2) * 2, (s + 2) * 2).fill({ color: petalCol, alpha: glow * 0.25 })
        g.rect(fx - s, fy - 1, s * 2 + 1, 3).fill({ color: petalCol, alpha: bloom * 0.92 })
        g.rect(fx - 1, fy - s, 3, s * 2 + 1).fill({ color: petalCol, alpha: bloom * 0.92 })
        g.rect(fx - 1, fy - 1, 3, 3).fill({ color: 0xfff9e6, alpha: bloom })
      }

      // Gently ascending luminous spores drifting toward the gallery floor above
      for (let i = 0; i < 16; i++) {
        const cycle = (t * 0.18 + i * 0.137) % 1
        const sx = cx + Math.round(Math.sin(i * 2.7 + t * 0.9) * 58)
        const sy = Math.round(baseY - 40 - cycle * 195)
        const sa = Math.sin(cycle * Math.PI) * bloom * 0.72
        const col = i % 3 === 0 ? 0xffe89e : i % 3 === 1 ? 0x94c4a2 : 0xf4efe2
        g.rect(sx, sy, 2, 2).fill({ color: col, alpha: sa })
      }
    }
  }

  public destroy(): void {
    this.dofRenderTex.destroy(true)
    this.root.destroy({ children: true })
  }
}
