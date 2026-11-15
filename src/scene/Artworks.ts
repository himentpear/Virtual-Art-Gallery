import type { ArtworkId, ArtworkInspectionData } from '../types'
import { bayer4, createPixelSurface, lerpColor, mulberry32, px } from './PixelCanvasBuilder'

export interface GeneratedArtworks {
  centerCanvas: HTMLCanvasElement
  leftCanvas: HTMLCanvasElement
  rightCanvas: HTMLCanvasElement
  westCenterCanvas: HTMLCanvasElement
  westLeftCanvas: HTMLCanvasElement
  westRightCanvas: HTMLCanvasElement
  eastCenterCanvas: HTMLCanvasElement
  eastLeftCanvas: HTMLCanvasElement
  eastRightCanvas: HTMLCanvasElement
  waterfallZones: Array<{ x: number; y: number; w: number; h: number }>
  starPoints: Array<{ x: number; y: number; phase: number; color: string }>
  westShimmerPoints: Array<{ x: number; y: number; phase: number; color: string }>
  eastEmberPoints: Array<{ x: number; y: number; phase: number }>
  inspections: Record<ArtworkId, ArtworkInspectionData>
}

function paintCenterMasterpiece(): {
  canvas: HTMLCanvasElement
  waterfallZones: Array<{ x: number; y: number; w: number; h: number }>
  starPoints: Array<{ x: number; y: number; phase: number; color: string }>
} {
  const W = 114
  const H = 184
  const surf = createPixelSurface(W, H)
  const { ctx } = surf
  const rand = mulberry32(4207)

  // 1. Dithered twilight night sky gradient
  const skyTop: [number, number, number] = [14, 21, 56]
  const skyMid: [number, number, number] = [34, 49, 118]
  const skyLow: [number, number, number] = [74, 65, 146]
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    const c =
      t < 0.55
        ? lerpColor(skyTop, skyMid, t / 0.55)
        : lerpColor(skyMid, skyLow, (t - 0.55) / 0.45)
    for (let x = 0; x < W; x++) {
      const d = bayer4(x, y) * 0.06
      const tt = Math.min(1, t + d)
      const col =
        tt < 0.55
          ? lerpColor(skyTop, skyMid, tt / 0.55)
          : lerpColor(skyMid, skyLow, (tt - 0.55) / 0.45)
      px(ctx, x, y, 1, 1, col || c)
    }
  }

  // 2. Stars
  const starPoints: Array<{ x: number; y: number; phase: number; color: string }> = []
  for (let i = 0; i < 68; i++) {
    const sx = Math.floor(rand() * W)
    const sy = Math.floor(rand() * 88)
    const col = rand() > 0.7 ? '#ffdff7' : rand() > 0.4 ? '#c5dcff' : '#8da9ec'
    px(ctx, sx, sy, 1, 1, col)
    if (i % 5 === 0) {
      starPoints.push({ x: sx, y: sy, phase: rand() * Math.PI * 2, color: col })
    }
  }

  // 3. Pink-lavender glowing full moon at upper right
  const mx = 86
  const my = 26
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const dist = Math.hypot(dx, dy)
      if (dist <= 5.2) {
        const core = dist < 3.6 ? '#ffe4f2' : '#f4a8d2'
        px(ctx, mx + dx, my + dy, 1, 1, core)
      } else if (dist <= 11 && bayer4(mx + dx, my + dy) > (dist - 5.2) / 6.2) {
        px(ctx, mx + dx, my + dy, 1, 1, dist < 7.8 ? '#a464ad' : '#584c9c')
      }
    }
  }

  // 4. Distant tiny floating isle far right
  px(ctx, 88, 57, 10, 3, '#3c407c')
  px(ctx, 90, 60, 6, 3, '#272959')
  px(ctx, 92, 54, 3, 3, '#574e8e')

  // 5. Billowing pink/violet/indigo pixel clouds around the floating castles
  const cloudPuffs: Array<[number, number, number, string, string]> = [
    [16, 48, 12, '#7d6cb8', '#44468a'],
    [28, 58, 14, '#c38bc4', '#6d5c9f'],
    [18, 72, 16, '#dda2ce', '#7c65a5'],
    [94, 72, 15, '#c689bf', '#675398'],
    [82, 82, 14, '#e5a4cf', '#7f62a5'],
    [12, 108, 15, '#c78ec6', '#5c5296'],
    [98, 112, 16, '#b782bd', '#554d91'],
    [24, 144, 18, '#dca4d0', '#6d5da0'],
    [88, 148, 17, '#c791c8', '#5e5599'],
    [42, 162, 16, '#e2abd2', '#7d69aa'],
  ]
  for (const [cx, cy, r, lit, mid] of cloudPuffs) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx * 0.85, dy * 1.15) / r
        if (d > 1 - rand() * 0.22) continue
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || x >= W || y < 0 || y >= H) continue
        const isLit = dy < -r * 0.15 || (dy < r * 0.2 && bayer4(x, y) > 0.45)
        px(ctx, x, y, 1, 1, isLit ? lit : mid)
      }
    }
  }

  // 6. Central Floating Castle & Rock Island (y = 38..94)
  // Rock island underside
  for (let row = 0; row < 20; row++) {
    const halfW = Math.max(2, Math.round(23 * (1 - row / 21) + Math.sin(row * 0.7) * 2))
    const y = 70 + row
    for (let dx = -halfW; dx <= halfW; dx++) {
      const shade = dx < -halfW * 0.35 ? '#5b4b7a' : dx > halfW * 0.3 ? '#1e2046' : '#353160'
      px(ctx, 56 + dx, y, 1, 1, shade)
    }
  }
  // Island grassy top plateau
  px(ctx, 32, 68, 48, 3, '#679c7b')
  px(ctx, 35, 67, 42, 2, '#92c987')

  // Main Castle spires (rose-gold & twilight purple)
  const castleParts: Array<[number, number, number, number, string, string]> = [
    [40, 56, 8, 12, '#d89ab4', '#6d568c'],
    [42, 50, 4, 6, '#f2b8c6', '#8d689d'],
    [50, 46, 12, 22, '#e6a5bc', '#735a93'],
    [53, 39, 6, 7, '#f8cad0', '#966ea2'],
    [55, 34, 2, 5, '#ffe1dc', '#b47ca9'], // tallest spire
    [62, 52, 9, 16, '#d99bb5', '#685088'],
    [64, 46, 5, 6, '#f0b6c5', '#876398'],
    [46, 59, 20, 9, '#f2b8c6', '#695289'],
  ]
  for (const [bx, by, bw, bh, litCol, shadowCol] of castleParts) {
    px(ctx, bx, by, bw, bh, shadowCol)
    px(ctx, bx, by, Math.max(1, Math.floor(bw * 0.55)), bh, litCol)
    // Castle warm lit windows
    if (bw >= 6 && bh >= 8) {
      px(ctx, bx + Math.floor(bw / 2) - 1, by + 4, 1, 2, '#ffe8a4')
    }
  }

  // 7. Secondary Side Floating Islands & Ruins (Left & Right)
  // Left island (x ~ 22, y ~ 98)
  for (let r = 0; r < 14; r++) {
    const hw = Math.max(2, Math.round(14 * (1 - r / 15)))
    px(ctx, 22 - hw, 98 + r, hw * 2, 1, r < 4 ? '#3f4578' : '#242952')
  }
  px(ctx, 9, 96, 26, 3, '#538e7f')
  px(ctx, 14, 88, 6, 8, '#9378a8')
  px(ctx, 15, 84, 3, 4, '#d89ab4')

  // Right island (x ~ 92, y ~ 94)
  for (let r = 0; r < 15; r++) {
    const hw = Math.max(2, Math.round(15 * (1 - r / 16)))
    px(ctx, 92 - hw, 94 + r, hw * 2, 1, r < 4 ? '#3d4172' : '#23274e')
  }
  px(ctx, 78, 92, 28, 3, '#54897a')
  px(ctx, 88, 80, 8, 12, '#8b71a2')
  px(ctx, 90, 74, 4, 6, '#e0a0b8')

  // 8. Mid-chasm dark rocky cliffs behind waterfalls (y = 104..160)
  for (let y = 106; y < 164; y++) {
    const lw = Math.round(28 + Math.sin(y * 0.2) * 4)
    const rw = Math.round(26 + Math.cos(y * 0.18) * 4)
    px(ctx, 0, y, lw, 1, y < 126 ? '#2b325c' : '#1b2242')
    px(ctx, W - rw, y, rw, 1, y < 126 ? '#2a3058' : '#19203f')
  }
  // Central chasm cliff wall
  px(ctx, 36, 112, 42, 46, '#23325b')
  px(ctx, 44, 116, 26, 40, '#1c284e')

  // 9. Luminous Waterfalls plunging down!
  const waterfallZones = [
    { x: 46, y: 88, w: 6, h: 48 },
    { x: 56, y: 90, w: 7, h: 52 },
    { x: 24, y: 100, w: 5, h: 46 },
    { x: 84, y: 96, w: 5, h: 50 },
    { x: 38, y: 122, w: 4, h: 40 },
    { x: 70, y: 120, w: 5, h: 44 },
  ]
  for (const wf of waterfallZones) {
    for (let dy = 0; dy < wf.h; dy++) {
      for (let dx = 0; dx < wf.w; dx++) {
        const edge = dx === 0 || dx === wf.w - 1
        const col = edge ? '#4d98d4' : (dy + dx) % 3 === 0 ? '#d8fbff' : '#85d8f2'
        px(ctx, wf.x + dx, wf.y + dy, 1, 1, col)
      }
    }
    // Misty splash pool at waterfall base
    px(ctx, wf.x - 2, wf.y + wf.h - 2, wf.w + 4, 3, '#b8f3ff')
  }

  // 10. Lower Foreground Emerald Cliff & Radiant World Tree (y = 136..184)
  // Radiant golden-green aura behind World Tree
  const treeX = 59
  const treeY = 148
  for (let dy = -26; dy <= 16; dy++) {
    for (let dx = -28; dx <= 28; dx++) {
      const d = Math.hypot(dx * 0.85, dy)
      if (d < 24 && bayer4(treeX + dx, treeY + dy) > d / 24) {
        px(ctx, treeX + dx, treeY + dy, 1, 1, d < 12 ? '#ffe588' : '#7ac898')
      }
    }
  }

  // Lower grassy foreground cliff (right & center-bottom)
  for (let y = 152; y < H; y++) {
    const startX = Math.max(0, Math.round(44 - (y - 152) * 1.4))
    px(ctx, startX, y, W - startX, 1, y < 158 ? '#3e7f5a' : '#1b3540')
  }
  // Highlight mossy cliff top
  px(ctx, 44, 152, 70, 3, '#72c973')
  px(ctx, 50, 150, 42, 3, '#a4e87c')
  // Lower left cliff ledge with small waterfall
  px(ctx, 0, 162, 34, 22, '#1f2e4f')
  px(ctx, 0, 160, 28, 3, '#57987c')
  px(ctx, 20, 164, 5, 20, '#85d8f2')

  // World Tree trunk & gnarled roots
  px(ctx, treeX - 2, treeY + 2, 5, 11, '#4c3228')
  px(ctx, treeX - 1, treeY + 2, 2, 10, '#82583d')
  px(ctx, treeX - 5, treeY + 11, 11, 3, '#3b251e')

  // Radiant golden-emerald World Tree canopy
  const treePuffs: Array<[number, number, number]> = [
    [treeX, treeY - 7, 13],
    [treeX - 10, treeY - 3, 9],
    [treeX + 10, treeY - 3, 9],
    [treeX - 5, treeY - 12, 8],
    [treeX + 6, treeY - 11, 8],
  ]
  for (const [cx, cy, r] of treePuffs) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx * 0.9, dy * 1.1) / r
        if (d > 1 - rand() * 0.25) continue
        const col =
          dy < -r * 0.25
            ? '#fff29c'
            : dy < r * 0.2
              ? '#b4e86a'
              : d < 0.7
                ? '#4ea854'
                : '#236342'
        px(ctx, cx + dx, cy + dy, 1, 1, col)
      }
    }
  }

  return { canvas: surf.canvas, waterfallZones, starPoints }
}

function paintLeftBridgePainting(): HTMLCanvasElement {
  const W = 56
  const H = 34
  const surf = createPixelSurface(W, H)
  const { ctx } = surf
  const rand = mulberry32(8123)

  // Deep forest night sky & mountain ridge
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    const c = lerpColor([16, 28, 56], [46, 76, 112], t)
    px(ctx, 0, y, W, 1, c)
  }
  // Distant mountain silhouette
  for (let x = 0; x < W; x++) {
    const mh = Math.round(11 + Math.sin(x * 0.14) * 4 + Math.cos(x * 0.27) * 2)
    px(ctx, x, mh, 1, H - mh, '#1a2f4d')
  }
  // Misty canyon glow behind arch bridge
  for (let dy = -9; dy <= 9; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const d = Math.hypot(dx * 0.7, dy)
      if (d < 10 && bayer4(28 + dx, 18 + dy) > d / 10) {
        px(ctx, 28 + dx, 18 + dy, 1, 1, '#5897b8')
      }
    }
  }
  // Stone arch bridge
  px(ctx, 8, 17, 40, 4, '#2f3d52')
  px(ctx, 8, 16, 40, 1, '#607a96')
  // Arch cutout showing glowing misty water
  for (let dx = -9; dx <= 9; dx++) {
    const archY = 20 + Math.round(Math.sqrt(Math.max(0, 81 - dx * dx)) * 0.5)
    px(ctx, 28 + dx, 20, 1, archY - 19, '#5ca8c4')
  }
  // River below
  for (let y = 24; y < H; y++) {
    px(ctx, 0, y, W, 1, y < 28 ? '#27536e' : '#163047')
    if (rand() > 0.4) px(ctx, 18 + Math.floor(rand() * 20), y, 3, 1, '#85d6e6')
  }
  // Framing dark pine silhouettes left and right
  for (let i = 0; i < 6; i++) {
    px(ctx, i * 3, 8 + (i % 3) * 3, 4, H - 8, '#102030')
    px(ctx, W - 4 - i * 3, 9 + (i % 2) * 4, 4, H - 9, '#102030')
  }

  return surf.canvas
}

function paintRightDuskPainting(): HTMLCanvasElement {
  const W = 56
  const H = 34
  const surf = createPixelSurface(W, H)
  const { ctx } = surf
  const rand = mulberry32(9341)

  // Violet -> rose -> warm amber dusk sky
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    const c =
      t < 0.48
        ? lerpColor([42, 34, 84], [148, 76, 128], t / 0.48)
        : lerpColor([148, 76, 128], [228, 146, 108], (t - 0.48) / 0.52)
    px(ctx, 0, y, W, 1, c)
  }

  // Wispy dusk clouds
  for (let i = 0; i < 16; i++) {
    const cx = Math.floor(rand() * 44) + 4
    const cy = Math.floor(rand() * 14) + 3
    px(ctx, cx, cy, 7 + Math.floor(rand() * 7), 1, '#f4b8c4')
  }

  // Far ridge (purple)
  for (let x = 0; x < W; x++) {
    const h = Math.round(16 + Math.sin(x * 0.11 + 1.2) * 3 + Math.cos(x * 0.25) * 2)
    px(ctx, x, h, 1, H - h, '#5b396c')
  }
  // Mid ridge (deep violet)
  for (let x = 0; x < W; x++) {
    const h = Math.round(21 + Math.cos(x * 0.14) * 3)
    px(ctx, x, h, 1, H - h, '#39264d')
  }
  // Foreground dark citadel / spire silhouette on right
  px(ctx, 0, 27, W, 7, '#1d1630')
  px(ctx, 35, 19, 15, 10, '#231938')
  px(ctx, 41, 10, 4, 15, '#2b1e42')
  px(ctx, 42, 6, 2, 5, '#3b2852')
  // Tiny warm city lights
  px(ctx, 38, 22, 1, 1, '#ffd485')
  px(ctx, 42, 15, 1, 1, '#ffd485')
  px(ctx, 46, 23, 1, 1, '#ff9f6b')

  return surf.canvas
}

function toUpscaledDataUrl(canvas: HTMLCanvasElement, factor = 4): string {
  const up = document.createElement('canvas')
  up.width = canvas.width * factor
  up.height = canvas.height * factor
  const ctx = up.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, 0, 0, up.width, up.height)
  return up.toDataURL('image/png')
}

function paintWestObservatoryMasterpiece(): {
  canvas: HTMLCanvasElement
  shimmerPoints: Array<{ x: number; y: number; phase: number; color: string }>
} {
  const W = 96
  const H = 168
  const surf = createPixelSurface(W, H)
  const { ctx } = surf
  const rand = mulberry32(6142)

  // Deep indigo-cyan night sky
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    for (let x = 0; x < W; x++) {
      const d = bayer4(x, y) * 0.05
      const tt = Math.min(1, t + d)
      const col =
        tt < 0.62
          ? lerpColor([9, 17, 46], [24, 52, 98], tt / 0.62)
          : lerpColor([24, 52, 98], [16, 40, 74], (tt - 0.62) / 0.38)
      px(ctx, x, y, 1, 1, col)
    }
  }

  const shimmerPoints: Array<{ x: number; y: number; phase: number; color: string }> = []
  for (let i = 0; i < 64; i++) {
    const sx = Math.floor(rand() * W)
    const sy = Math.floor(rand() * 102)
    const col = rand() > 0.65 ? '#e6fbff' : rand() > 0.35 ? '#9cd8ff' : '#6fa0d6'
    px(ctx, sx, sy, 1, 1, col)
    if (i % 4 === 0) {
      shimmerPoints.push({ x: sx, y: sy, phase: rand() * Math.PI * 2, color: '#fff3c4' })
    }
  }

  // Golden celestial astrolabe rings behind clocktower
  const acx = 48
  const acy = 58
  for (let angle = 0; angle < 360; angle += 2) {
    const rad = (angle * Math.PI) / 180
    for (const r of [24, 32, 37]) {
      const rx = Math.round(acx + Math.cos(rad) * r)
      const ry = Math.round(acy + Math.sin(rad) * r * 0.92)
      if (rx >= 0 && rx < W && ry >= 0 && ry < 118) {
        const col = r === 32 ? '#ffd982' : r === 37 ? '#a38249' : '#c99f54'
        px(ctx, rx, ry, 1, 1, col)
      }
    }
    if (angle % 30 === 0) {
      const sx = Math.round(acx + Math.cos(rad) * 32)
      const sy = Math.round(acy + Math.sin(rad) * 29)
      if (sx >= 1 && sx < W - 1 && sy >= 1 && sy < 118) {
        px(ctx, sx, sy, 2, 2, '#fff0b3')
        shimmerPoints.push({ x: sx, y: sy, phase: angle * 0.08, color: '#ffe594' })
      }
    }
  }
  // Diagonal celestial orbit arc
  for (let i = -40; i <= 40; i++) {
    const ox = acx + i
    const oy = Math.round(acy + i * 0.36 - Math.cos(i * 0.05) * 6)
    if (ox >= 0 && ox < W && oy >= 0 && oy < 110) {
      px(ctx, ox, oy, 1, 1, '#9be8ff')
    }
  }

  // Sea stack cliff rising from tidal sea (y = 84..144)
  for (let y = 84; y < 146; y++) {
    const row = y - 84
    const hw = Math.round(14 + row * 0.34 + Math.sin(row * 0.35) * 2)
    for (let dx = -hw; dx <= hw; dx++) {
      const col = dx < -hw * 0.2 ? '#29395e' : dx > hw * 0.3 ? '#101830' : '#1b2647'
      px(ctx, 48 + dx, y, 1, 1, col)
    }
  }

  // Gothic Clocktower on sea stack (x = 37..59, y = 28..96)
  px(ctx, 40, 50, 16, 46, '#233154')
  px(ctx, 40, 50, 7, 46, '#394f7a')
  px(ctx, 37, 46, 22, 5, '#19223d')
  // Tower pointed spire & turrets
  for (let i = 0; i < 20; i++) {
    const hw = Math.max(1, Math.round(10 * (1 - i / 20)))
    px(ctx, 48 - hw, 46 - i, hw * 2, 1, i > 12 ? '#809ec4' : '#2a3a61')
  }
  px(ctx, 47, 22, 2, 6, '#ffe596')
  // Glowing golden clockface
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const d = Math.hypot(dx, dy)
      if (d <= 5.2) {
        px(ctx, 48 + dx, 60 + dy, 1, 1, d > 3.8 ? '#c79748' : d < 1.5 ? '#ffffff' : '#ffdf88')
      }
    }
  }
  px(ctx, 48, 57, 1, 3, '#2b2438')
  px(ctx, 48, 60, 3, 1, '#2b2438')
  // Warm arched windows along lower tower
  for (const wy of [72, 82]) {
    px(ctx, 46, wy, 4, 5, '#ffd478')
  }

  // Bioluminescent tidal waves at bottom (y = 128..168)
  for (let y = 128; y < H; y++) {
    const t = (y - 128) / (H - 128)
    for (let x = 0; x < W; x++) {
      const wave = Math.sin(x * 0.14 + y * 0.35) * 0.5 + 0.5
      const col =
        wave > 0.78 && t > 0.2
          ? '#8bf5ff'
          : wave > 0.58
            ? lerpColor([20, 68, 108], [52, 152, 178], t)
            : lerpColor([10, 28, 58], [14, 42, 82], t)
      px(ctx, x, y, 1, 1, col)
      if (wave > 0.88 && (x + y) % 9 === 0) {
        shimmerPoints.push({ x, y, phase: (x + y) * 0.25, color: '#b8ffff' })
      }
    }
  }
  // Sea foam spray around cliff base
  px(ctx, 24, 140, 48, 3, '#aef9ff')
  px(ctx, 28, 143, 40, 2, '#5cc6e3')

  return { canvas: surf.canvas, shimmerPoints }
}

function paintWestForestSidePainting(): HTMLCanvasElement {
  const W = 56
  const H = 34
  const surf = createPixelSurface(W, H)
  const { ctx } = surf
  const rand = mulberry32(3190)

  // Emerald-teal deep forest backdrop
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    px(ctx, 0, y, W, 1, lerpColor([12, 34, 38], [26, 70, 66], t))
  }
  // Slanted forest sunbeams
  for (let y = 0; y < H; y++) {
    const bx = 22 + Math.floor(y * 0.35)
    for (let dx = -6; dx <= 6; dx++) {
      if (bx + dx >= 0 && bx + dx < W && bayer4(bx + dx, y) > Math.abs(dx) / 7) {
        px(ctx, bx + dx, y, 1, 1, '#5fb89c')
      }
    }
  }
  // Ancient tree trunks left & right
  for (const [tx, tw] of [
    [2, 5],
    [11, 3],
    [41, 4],
    [49, 6],
  ]) {
    px(ctx, tx, 0, tw, H - 6, '#122124')
    px(ctx, tx + 1, 0, 1, H - 6, '#264446')
  }
  // Canopy foliage dots
  for (let i = 0; i < 42; i++) {
    const lx = Math.floor(rand() * W)
    const ly = Math.floor(rand() * 14)
    px(ctx, lx, ly, 3, 2, rand() > 0.5 ? '#22594f' : '#3a8770')
  }
  // Forest pool & moss bank
  px(ctx, 0, 26, W, 8, '#173836')
  px(ctx, 14, 28, 28, 5, '#2b6b70')
  px(ctx, 18, 29, 18, 2, '#7ce6da')
  // Luminous silver-white stag standing near pool (center-right)
  px(ctx, 30, 21, 7, 4, '#d9f2f2') // body
  px(ctx, 30, 25, 1, 3, '#b8d9db')
  px(ctx, 32, 25, 1, 3, '#b8d9db')
  px(ctx, 35, 25, 1, 3, '#b8d9db')
  px(ctx, 28, 17, 3, 5, '#e8ffff') // neck & head
  px(ctx, 27, 17, 2, 1, '#ffffff')
  // Antlers
  px(ctx, 29, 14, 1, 3, '#fff0c2')
  px(ctx, 27, 13, 2, 1, '#fff0c2')
  px(ctx, 30, 13, 2, 1, '#fff0c2')

  return surf.canvas
}

function paintWestAuroraSidePainting(): HTMLCanvasElement {
  const W = 56
  const H = 34
  const surf = createPixelSurface(W, H)
  const { ctx } = surf

  for (let y = 0; y < H; y++) {
    px(ctx, 0, y, W, 1, lerpColor([10, 14, 38], [22, 32, 68], y / H))
  }
  // Emerald & violet aurora ribbons
  for (let x = 0; x < W; x++) {
    const waveY = Math.round(8 + Math.sin(x * 0.16) * 3)
    for (let dy = 0; dy < 8; dy++) {
      const col = dy < 3 ? '#c47dff' : dy < 6 ? '#5ef2c0' : '#2a8f88'
      if (bayer4(x, waveY + dy) > dy / 9) {
        px(ctx, x, waveY + dy, 1, 1, col)
      }
    }
  }
  // Snowy mountain peaks
  for (let x = 0; x < W; x++) {
    const mh = Math.round(18 + Math.abs(Math.sin(x * 0.12)) * 5 - Math.cos(x * 0.22) * 3)
    px(ctx, x, mh, 1, H - mh, '#1c2b4a')
    if (mh < 19) px(ctx, x, mh, 1, 2, '#d4ebff')
  }
  // Mirror fjord water at bottom
  for (let y = 25; y < H; y++) {
    px(ctx, 0, y, W, 1, '#11223d')
    for (let x = 6; x < W - 6; x += 5) {
      if ((x + y) % 2 === 0) px(ctx, x, y, 2, 1, y < 29 ? '#4cd4ac' : '#7365bd')
    }
  }
  return surf.canvas
}

function paintEastSanctuaryMasterpiece(): {
  canvas: HTMLCanvasElement
  emberPoints: Array<{ x: number; y: number; phase: number }>
} {
  const W = 96
  const H = 168
  const surf = createPixelSurface(W, H)
  const { ctx } = surf
  const rand = mulberry32(9512)

  // Crimson-violet-amber twilight sky
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1)
    for (let x = 0; x < W; x++) {
      const d = bayer4(x, y) * 0.06
      const tt = Math.min(1, t + d)
      const col =
        tt < 0.5
          ? lerpColor([28, 12, 34], [86, 28, 58], tt / 0.5)
          : lerpColor([86, 28, 58], [156, 74, 58], (tt - 0.5) / 0.5)
      px(ctx, x, y, 1, 1, col)
    }
  }

  // Crimson-gold eclipse moon (upper center-left)
  const mx = 34
  const my = 32
  for (let dy = -16; dy <= 16; dy++) {
    for (let dx = -16; dx <= 16; dx++) {
      const d = Math.hypot(dx, dy)
      if (d <= 9) {
        px(ctx, mx + dx, my + dy, 1, 1, d < 6.4 ? '#2b1224' : '#ffbb6e')
      } else if (d <= 15 && bayer4(mx + dx, my + dy) > (d - 9) / 6.5) {
        px(ctx, mx + dx, my + dy, 1, 1, d < 12 ? '#e66c63' : '#8c354c')
      }
    }
  }

  // Distant violet clouds
  for (let i = 0; i < 8; i++) {
    const cx = 10 + i * 11
    const cy = 62 + (i % 3) * 14
    px(ctx, cx, cy, 18, 4, '#b85a6a')
    px(ctx, cx + 3, cy + 3, 14, 3, '#692a4c')
  }

  // Floating Sanctuary Cathedral & Rose-Gold Arches (center y = 44..114)
  for (let r = 0; r < 18; r++) {
    const hw = Math.max(2, Math.round(20 * (1 - r / 19)))
    px(ctx, 56 - hw, 102 + r, hw * 2, 1, r < 6 ? '#5e324a' : '#2a162a')
  }
  px(ctx, 35, 99, 42, 4, '#d18d69')
  // Sanctuary arches and spires
  px(ctx, 42, 66, 28, 34, '#7d445c')
  px(ctx, 42, 66, 12, 34, '#c7777e')
  px(ctx, 49, 50, 14, 49, '#9e5466')
  px(ctx, 49, 50, 6, 49, '#eab08d')
  px(ctx, 53, 38, 6, 12, '#ffd6a3')
  px(ctx, 55, 30, 2, 8, '#fff0cf')
  // Glowing stained-glass lancet windows
  px(ctx, 53, 62, 6, 14, '#ffe194')
  px(ctx, 54, 64, 4, 10, '#fff7d4')
  px(ctx, 45, 78, 4, 9, '#ffbf70')
  px(ctx, 63, 78, 4, 9, '#ffbf70')

  // Ascending floating marble stairways (y = 114..168)
  for (let s = 0; s < 14; s++) {
    const sx = 18 + s * 4
    const sy = 158 - s * 4
    px(ctx, sx, sy, 22, 3, '#f2c199')
    px(ctx, sx, sy + 3, 22, 3, '#633249')
    if (s % 3 === 0) {
      // Glowing brazier / lantern on stairway balustrade
      px(ctx, sx + 2, sy - 4, 2, 4, '#472536')
      px(ctx, sx + 2, sy - 6, 2, 2, '#ffe58c')
    }
  }
  // Foreground warm abyssal stone terraces
  px(ctx, 0, 148, 34, 20, '#2e1627')
  px(ctx, 58, 136, 38, 32, '#281322')

  const emberPoints: Array<{ x: number; y: number; phase: number }> = []
  for (let i = 0; i < 24; i++) {
    const ex = Math.floor(rand() * (W - 12)) + 6
    const ey = Math.floor(rand() * (H - 20)) + 14
    px(ctx, ex, ey, 1, 1, '#ffde8a')
    emberPoints.push({ x: ex, y: ey, phase: rand() * Math.PI * 2 })
  }

  return { canvas: surf.canvas, emberPoints }
}

function paintEastHarvestSidePainting(): HTMLCanvasElement {
  const W = 56
  const H = 34
  const surf = createPixelSurface(W, H)
  const { ctx } = surf

  // Warm sunset sky
  for (let y = 0; y < 22; y++) {
    px(ctx, 0, y, W, 1, lerpColor([92, 52, 86], [242, 166, 94], y / 21))
  }
  // Glowing setting sun
  px(ctx, 36, 10, 6, 6, '#ffe59c')
  px(ctx, 37, 11, 4, 4, '#ffffff')
  // Distant skyship silhouette
  px(ctx, 14, 8, 9, 2, '#4a2b46')
  px(ctx, 16, 6, 5, 2, '#d18782')
  // Golden wheat hills
  for (let x = 0; x < W; x++) {
    const hy1 = Math.round(18 + Math.sin(x * 0.1) * 2)
    const hy2 = Math.round(24 + Math.cos(x * 0.14) * 2)
    px(ctx, x, hy1, 1, H - hy1, '#b87639')
    px(ctx, x, hy2, 1, H - hy2, '#e6b253')
    if (x % 3 === 0) px(ctx, x, hy2 + 2, 1, 2, '#ffe082')
  }
  return surf.canvas
}

function paintEastAlchemySidePainting(): HTMLCanvasElement {
  const W = 56
  const H = 34
  const surf = createPixelSurface(W, H)
  const { ctx } = surf

  // Cozy candlelit workshop backdrop
  px(ctx, 0, 0, W, H, '#1f1621')
  // Arched starry window in center
  px(ctx, 21, 4, 14, 18, '#17284a')
  px(ctx, 25, 8, 1, 1, '#fff0b3')
  px(ctx, 30, 12, 1, 1, '#9be8ff')
  px(ctx, 20, 3, 16, 2, '#422d26')
  // Left & right wooden bookshelves
  for (const bx of [2, 40]) {
    px(ctx, bx, 4, 14, 22, '#33221c')
    for (let sy = 8; sy <= 20; sy += 6) {
      px(ctx, bx + 1, sy, 12, 1, '#54392c')
      px(ctx, bx + 2, sy - 3, 2, 3, '#c45b68')
      px(ctx, bx + 5, sy - 4, 2, 4, '#5fa8bd')
      px(ctx, bx + 8, sy - 3, 3, 3, '#d9a452')
    }
  }
  // Workbench & glowing cyan/amber alembics
  px(ctx, 0, 26, W, 8, '#2b1b16')
  px(ctx, 0, 25, W, 2, '#573b2c')
  px(ctx, 18, 20, 4, 5, '#6cf2e0') // cyan flask
  px(ctx, 32, 21, 5, 4, '#ffbd59') // amber flask
  px(ctx, 26, 22, 2, 3, '#fff6cc') // candle flame

  return surf.canvas
}

export function generateAllArtworks(): GeneratedArtworks {
  const center = paintCenterMasterpiece()
  const leftCanvas = paintLeftBridgePainting()
  const rightCanvas = paintRightDuskPainting()
  const westCenter = paintWestObservatoryMasterpiece()
  const westLeftCanvas = paintWestForestSidePainting()
  const westRightCanvas = paintWestAuroraSidePainting()
  const eastCenter = paintEastSanctuaryMasterpiece()
  const eastLeftCanvas = paintEastHarvestSidePainting()
  const eastRightCanvas = paintEastAlchemySidePainting()

  return {
    centerCanvas: center.canvas,
    leftCanvas,
    rightCanvas,
    westCenterCanvas: westCenter.canvas,
    westLeftCanvas,
    westRightCanvas,
    eastCenterCanvas: eastCenter.canvas,
    eastLeftCanvas,
    eastRightCanvas,
    waterfallZones: center.waterfallZones,
    starPoints: center.starPoints,
    westShimmerPoints: westCenter.shimmerPoints,
    eastEmberPoints: eastCenter.emberPoints,
    inspections: {
      center_painting: {
        id: 'center_painting',
        title: '《苍穹浮空城与世界树》',
        englishTitle: 'Citadel of the Astral Cascade & World Tree',
        artist: '索菲娅 · 艾尔温 (Sophia Elwin)',
        era: '星历 742 年 · 中庭主展画',
        medium: '夜光矿彩与星尘釉像素绘板',
        dimensions: '420 × 680 cm（中庭双层挑空主展墙）',
        description:
          '描绘悬浮于紫罗兰星海中的古代天空王都，粉月悬于天际，千道苍蓝瀑布自浮岛边缘倾泻而下，浇灌着崖顶沐浴圣光的金色世界树。',
        curatorialNote:
          '当展厅天窗的星辉倾泻而下，画作底座灯带会唤醒画中的像素水流与微光。点击下方「激活画境星辉共鸣」可唤醒全长廊星尘共振。',
        canvasDataUrl: toUpscaledDataUrl(center.canvas, 3),
        accentColor: '#7be0f5',
      },
      left_plaque: {
        id: 'left_plaque',
        title: '《幽谷古桥》',
        englishTitle: 'Moonlit Arch of the Whispering Ravine',
        artist: '莱恩哈特 · 维恩 (Leonhardt Vane)',
        era: '星历 738 年 · 中庭西偏廊画',
        medium: '群青冷釉木板像素画',
        dimensions: '165 × 105 cm（中庭左侧展位）',
        description:
          '群山环抱的静谧峡谷之中，古老的石拱桥横跨薄雾弥漫的月光溪流，松影摇曳，唯有流水与风声穿行其间。',
        curatorialNote:
          '顶部双层射灯以 3200K 暖金光束烘托冷色调山谷画作，在深色黑曜石地砖上投射出静谧的蓝金对比。',
        canvasDataUrl: toUpscaledDataUrl(leftCanvas, 6),
        accentColor: '#67b8de',
      },
      right_plaque: {
        id: 'right_plaque',
        title: '《暮光远山与孤塔》',
        englishTitle: 'Dusk Spire Beyond the Violet Ridges',
        artist: '伊莎贝拉 · 克洛斯 (Isabella Cross)',
        era: '星历 740 年 · 中庭东偏廊画',
        medium: '暮霞金粉像素油彩',
        dimensions: '165 × 105 cm（中庭右侧展位）',
        description:
          '晚霞将远方层叠的紫罗兰山脉染成琥珀与绛紫，山脊尽头的守望孤塔亮起微弱灯火，静待旅人归来。',
        curatorialNote:
          '东偏廊导览屏记录了画师对黄昏大气散射像素抖动技法的笔记，并与西偏廊《幽谷古桥》形成昼夜呼应。',
        canvasDataUrl: toUpscaledDataUrl(rightCanvas, 6),
        accentColor: '#f2a679',
      },
      west_center_painting: {
        id: 'west_center_painting',
        title: '《星轨钟楼与潮汐海》',
        englishTitle: 'Astral Clocktower Above the Bioluminescent Tide',
        artist: '奥利弗 · 赛勒斯 (Oliver Cyrus)',
        era: '星历 741 年 · 西翼主展画',
        medium: '深海青金石彩与金箔星轨绘板',
        dimensions: '360 × 620 cm（西翼星象大厅）',
        description:
          '耸立于海蚀孤岩之上的古老天文钟楼，背后悬浮着黄金星象仪轨道环，夜晚涨潮时的荧光浪花与星辉交相辉映。',
        curatorialNote:
          '西翼天窗专门调整了冷青色透光格栅，与钟楼表盘的琥珀余晖在地面石砖上形成锐利的水波倒影。',
        canvasDataUrl: toUpscaledDataUrl(westCenter.canvas, 3),
        accentColor: '#76e0ff',
      },
      west_left_plaque: {
        id: 'west_left_plaque',
        title: '《沉眠森域之鹿》',
        englishTitle: 'Silver Stag of the Slumbering Glade',
        artist: '菲娜 · 洛林 (Fina Lorin)',
        era: '星历 735 年 · 西翼林间展位',
        medium: '孔雀石绿釉像素木版',
        dimensions: '165 × 105 cm（西翼左侧）',
        description:
          '晨光穿透古木枝桠洒落在幽绿林泉边，传说中守护森林记忆的银角白鹿正驻足倾听水波声。',
        curatorialNote:
          '画框下方的光感导览屏模拟了林间苔藓与微光孢子的呼吸频率。',
        canvasDataUrl: toUpscaledDataUrl(westLeftCanvas, 6),
        accentColor: '#6be6c1',
      },
      west_right_plaque: {
        id: 'west_right_plaque',
        title: '《极光冰峡》',
        englishTitle: 'Aurora Curtain Over the Frozen Fjord',
        artist: '海因里希 · 诺德 (Heinrich Nord)',
        era: '星历 739 年 · 西翼极夜展位',
        medium: '寒境冰晶矿粉像素画',
        dimensions: '165 × 105 cm（西翼右侧）',
        description:
          '翠绿与紫罗兰交织的极光幕布悬于雪峰峡湾之上，冰面如同天然黑曜石镜面般映出天穹流光。',
        curatorialNote:
          '此画作的镜面海湾构图恰好与展厅地面黑曜石石砖的反光特性彼此映照。',
        canvasDataUrl: toUpscaledDataUrl(westRightCanvas, 6),
        accentColor: '#9b9eff',
      },
      east_center_painting: {
        id: 'east_center_painting',
        title: '《绯月圣堂与浮空阶梯》',
        englishTitle: 'Crimson Eclipse Sanctuary & Ascending Steps',
        artist: '卡珊德拉 · 维尔 (Cassandra Vale)',
        era: '星历 743 年 · 东翼主展画',
        medium: '赤铜绯晶彩与浮雕金粉',
        dimensions: '360 × 620 cm（东翼绯月大厅）',
        description:
          '日蚀绯月高悬天际，沿着悬浮汉白玉阶梯攀升至云端玫瑰金圣堂，沿途灯火如星火缓缓升腾。',
        curatorialNote:
          '东翼主画以暖金与赤紫为主调，底座暖光在夜间长廊尽头营造出宛若古老教堂般的庄严仪式感。',
        canvasDataUrl: toUpscaledDataUrl(eastCenter.canvas, 3),
        accentColor: '#ffad7a',
      },
      east_left_plaque: {
        id: 'east_left_plaque',
        title: '《黄金麦浪与远帆》',
        englishTitle: 'Golden Harvest Fields & Distant Skyships',
        artist: '米洛 · 哈特 (Milo Hart)',
        era: '星历 736 年 · 东翼夕照展位',
        medium: '琥珀金粉与木板油彩',
        dimensions: '165 × 105 cm（东翼左侧）',
        description:
          '落日余晖铺满层叠金色麦田，一艘旧式飞空艇正迎着晚霞与暮风驶向远方山巅港湾。',
        curatorialNote:
          '画面右侧暖橙高光呼应长廊分隔柱上的青铜壁灯，让走廊过渡更为温润柔和。',
        canvasDataUrl: toUpscaledDataUrl(eastLeftCanvas, 6),
        accentColor: '#ffd078',
      },
      east_right_plaque: {
        id: 'east_right_plaque',
        title: '《星辉炼金工坊》',
        englishTitle: 'The Starlight Alchemist’s Study',
        artist: '帕特里克 · 奥尔 (Patrick Orr)',
        era: '星历 740 年 · 东翼书斋展位',
        medium: '烛光矿彩像素精细绘',
        dimensions: '165 × 105 cm（东翼右侧）',
        description:
          '摆满古籍的深夜工坊内，青蓝星露与琥珀魔药在玻璃蒸馏器中微光流转，窗外星辰静默注视。',
        curatorialNote:
          '工坊窗景与中庭天窗同样使用了冷蓝与烛黄的双色冷暖对冲技法。',
        canvasDataUrl: toUpscaledDataUrl(eastRightCanvas, 6),
        accentColor: '#ffbe6e',
      },
    },
  }
}
