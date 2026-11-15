import { Texture } from 'pixi.js'

export interface PixelSurface {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
}

export function createPixelSurface(width: number, height: number): PixelSurface {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx, width, height }
}

export function surfaceToNearestTexture(surface: PixelSurface | HTMLCanvasElement): Texture {
  const tex = Texture.from(surface instanceof HTMLCanvasElement ? surface : surface.canvas)
  tex.source.style.scaleMode = 'nearest'
  return tex
}

export function createLinearTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx, width, height)
  const tex = Texture.from(canvas)
  tex.source.style.scaleMode = 'linear'
  return tex
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash2d(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)
  h = (h ^ (h >>> 13)) | 0
  h = Math.imul(h, 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  const u = Math.max(0, Math.min(1, t))
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * u)
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * u)
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * u)
  return `rgb(${r},${g},${b})`
}

export function bayer4(x: number, y: number): number {
  const m = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ]
  return m[y & 3][x & 3] / 16
}

export function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export interface TreePalette {
  trunkDark: string
  trunkLight: string
  leafDeep: string
  leafMid: string
  leafLit: string
  leafHighlight: string
  potDark: string
  potMid: string
  potRim: string
  potGlow?: string
}

export interface TreeSwayParts {
  trunkCanvas: HTMLCanvasElement
  canopyCanvas: HTMLCanvasElement
  width: number
  height: number
  pivotX: number
  pivotY: number
  potY: number
}

/** Draw only the stone planter pot & base glow strip of a gallery tree. */
export function drawPixelTreePotOnly(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  palette: TreePalette,
): { potX: number; potY: number; potW: number; potH: number } {
  const potW = Math.round(14 * scale)
  const potH = Math.round(14 * scale)
  const potX = Math.round(cx - potW / 2)
  const potY = Math.round(baseY - potH)

  // Stone planter pot with beveled rim and recessed face
  px(ctx, potX, potY, potW, potH, palette.potDark)
  px(ctx, potX + 1, potY + 1, potW - 2, potH - 2, palette.potMid)
  if (potW >= 8 && potH >= 8) {
    px(ctx, potX + 2, potY + 4, potW - 4, potH - 7, palette.potDark)
    px(ctx, potX + 3, potY + 5, potW - 6, potH - 9, palette.potMid)
  }
  px(ctx, potX - 1, potY, potW + 2, Math.max(2, Math.round(2 * scale)), palette.potRim)
  px(ctx, potX, potY + Math.max(2, Math.round(2 * scale)), potW, 1, palette.potDark)
  if (palette.potGlow) {
    // Bottom LED base glow strip under the planter pot
    px(ctx, potX, potY + potH - 2, potW, 2, palette.potGlow)
  }

  return { potX, potY, potW, potH }
}

/** Draw the lower trunk segment anchored into a planter (used behind 2F balcony rails). */
export function drawPixelTreeTrunkBase(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  palette: TreePalette,
  seed: number,
  maxRows = 8,
): void {
  const potH = Math.round(14 * scale)
  const potY = Math.round(baseY - potH)
  const trunkH = Math.min(maxRows, Math.round(38 * scale))
  const wideThreshold = 12 * scale
  for (let i = 0; i < trunkH; i++) {
    const yy = potY - i
    const sway = Math.round(Math.sin(i * 0.12 + seed) * 1.4 * scale)
    const w = i < wideThreshold ? Math.max(2, Math.round(3 * scale)) : Math.max(1, Math.round(2 * scale))
    px(ctx, cx - w / 2 + sway, yy, w, 1, palette.trunkDark)
    if (w >= 2) {
      px(ctx, cx + sway, yy, 1, 1, palette.trunkLight)
    }
  }
}

function paintTreeUpperParts(
  trunkCtx: CanvasRenderingContext2D,
  canopyCtx: CanvasRenderingContext2D,
  cx: number,
  potY: number,
  scale: number,
  palette: TreePalette,
  seed: number,
): void {
  const rand = mulberry32(seed)

  // Slender branching trunk
  const trunkH = Math.round(38 * scale)
  const trunkTopY = potY - trunkH
  for (let i = 0; i < trunkH; i++) {
    const yy = potY - i
    const sway = Math.round(Math.sin(i * 0.12 + seed) * 1.4 * scale)
    const w = i < 12 * scale ? Math.max(2, Math.round(3 * scale)) : Math.max(1, Math.round(2 * scale))
    px(trunkCtx, cx - w / 2 + sway, yy, w, 1, palette.trunkDark)
    if (w >= 2) {
      px(trunkCtx, cx + sway, yy, 1, 1, palette.trunkLight)
    }
  }

  // Secondary branches
  const branches: Array<[number, number, number, number]> = [
    [cx, trunkTopY + Math.round(20 * scale), cx - Math.round(16 * scale), trunkTopY + Math.round(8 * scale)],
    [cx, trunkTopY + Math.round(16 * scale), cx + Math.round(16 * scale), trunkTopY + Math.round(5 * scale)],
    [cx, trunkTopY + Math.round(10 * scale), cx - Math.round(10 * scale), trunkTopY - Math.round(2 * scale)],
    [cx, trunkTopY + Math.round(8 * scale), cx + Math.round(11 * scale), trunkTopY - Math.round(4 * scale)],
  ]
  for (const [x0, y0, x1, y1] of branches) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let s = 0; s <= steps; s++) {
      const t = s / Math.max(1, steps)
      const bx = Math.round(x0 + (x1 - x0) * t)
      const by = Math.round(y0 + (y1 - y0) * t)
      px(trunkCtx, bx, by, 1, 1, palette.trunkDark)
    }
  }

  // Leaf canopy clusters with dithered inner lit highlights
  const clusters: Array<[number, number, number]> = [
    [cx, trunkTopY - Math.round(4 * scale), Math.round(13 * scale)],
    [cx - Math.round(14 * scale), trunkTopY + Math.round(5 * scale), Math.round(11 * scale)],
    [cx + Math.round(15 * scale), trunkTopY + Math.round(3 * scale), Math.round(11 * scale)],
    [cx - Math.round(8 * scale), trunkTopY - Math.round(12 * scale), Math.round(10 * scale)],
    [cx + Math.round(9 * scale), trunkTopY - Math.round(11 * scale), Math.round(10 * scale)],
    [cx - Math.round(17 * scale), trunkTopY + Math.round(12 * scale), Math.round(8 * scale)],
    [cx + Math.round(18 * scale), trunkTopY + Math.round(10 * scale), Math.round(8 * scale)],
  ]

  const sameTarget = trunkCtx === canopyCtx
  for (let cIdx = 0; cIdx < clusters.length; cIdx++) {
    const [ccx, ccy, rad] = clusters[cIdx]
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const dist = Math.hypot(dx * 0.9, dy * 1.1) / rad
        if (dist > 1.0 - rand() * 0.35) continue
        if (rand() < 0.18 && dist > 0.65) continue
        const pxX = Math.round(ccx + dx)
        const pxY = Math.round(ccy + dy)
        const lightFromTopOrBottom = palette.potGlow
          ? dy > 0 && Math.abs(dx) < rad * 0.7
          : dy < -rad * 0.25
        let col = palette.leafDeep
        if (dist < 0.75) col = palette.leafMid
        if (lightFromTopOrBottom && dist < 0.8) col = palette.leafLit
        if (palette.potGlow && dy > rad * 0.2 && Math.abs(dx) < rad * 0.55 && rand() > 0.35) {
          col = palette.leafHighlight
        } else if (!palette.potGlow && dy < -rad * 0.4 && rand() > 0.5) {
          col = palette.leafHighlight
        }
        if (sameTarget) {
          px(trunkCtx, pxX, pxY, 1, 1, col)
        } else if (dist < 0.48 && cIdx < 3) {
          // Core crown sits on trunk surface so inner foliage stays bridged cleanly while swaying
          px(trunkCtx, pxX, pxY, 1, 1, col)
        } else {
          px(canopyCtx, pxX, pxY, 1, 1, col)
        }
      }
    }
  }
}

/** Build separate trunk + outer canopy canvases pivoted at pot rim for layered breeze sway. */
export function createTreeSwayParts(
  scale: number,
  palette: TreePalette,
  seed: number,
  baseY: number,
): TreeSwayParts {
  const halfW = Math.ceil(30 * scale) + 4
  const padTop = Math.ceil(66 * scale) + 4
  const width = halfW * 2
  const height = padTop + 4
  const potH = Math.round(14 * scale)
  const potY = Math.round(baseY - potH)

  const trunkSurf = createPixelSurface(width, height)
  const canopySurf = createPixelSurface(width, height)
  paintTreeUpperParts(trunkSurf.ctx, canopySurf.ctx, halfW, padTop, scale, palette, seed)

  return {
    trunkCanvas: trunkSurf.canvas,
    canopyCanvas: canopySurf.canvas,
    width,
    height,
    pivotX: halfW,
    pivotY: padTop,
    potY,
  }
}

/** Draw an organic pixel-art ornamental gallery tree inside a rectangular area. */
export function drawPixelTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale: number,
  palette: TreePalette,
  seed: number,
): void {
  const { potY } = drawPixelTreePotOnly(ctx, cx, baseY, scale, palette)
  paintTreeUpperParts(ctx, ctx, cx, potY, scale, palette, seed)
}
