import { resolveColors, spritePixels } from '@pixelsyn/compiler'
import { Character } from '@pixelsyn/core'
import type { DrawInstruction } from '@pixelsyn/core'
import type { Appearance, CompiledPack, SpriteDefinition } from '@pixelsyn/schema'
import type { WardrobeSelection } from '../types'
import { buildAppearanceFromSelection } from './HeroController'

export type PartThumbSlot =
  | 'head'
  | 'ponytail'
  | 'torso'
  | 'waist'
  | 'arms'
  | 'legs'
  | 'scarfMode'

const thumbDataUrlCache = new Map<string, string>()

function spriteToCanvas(
  sprite: SpriteDefinition,
  colors: string[],
  hiddenRegions: string[],
  silhouetteOnly = false,
): HTMLCanvasElement {
  const rgba = spritePixels(sprite, colors, hiddenRegions)
  const canvas = document.createElement('canvas')
  canvas.width = sprite.width
  canvas.height = sprite.height
  const ctx = canvas.getContext('2d')!
  const out = new Uint8ClampedArray(rgba)
  if (silhouetteOnly) {
    // Muted cool silhouette tone so the highlighted part pops clearly against the body mannequin
    for (let i = 0; i < out.length; i += 4) {
      if (out[i + 3] === 0) continue
      out[i] = 112
      out[i + 1] = 128
      out[i + 2] = 160
      out[i + 3] = Math.round(out[i + 3] * 0.28)
    }
  }
  ctx.putImageData(new ImageData(out, sprite.width, sprite.height), 0, 0)
  return canvas
}

function drawInstructionsOntoCanvas(
  pack: CompiledPack,
  appearance: Appearance,
  draws: DrawInstruction[],
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  silhouetteOnly: boolean,
): void {
  const spriteMap = new Map(pack.project.sprites.map((s) => [s.id, s]))
  for (const draw of draws) {
    const source = spriteMap.get(draw.spriteId)
    if (!source) continue
    const colors = resolveColors(pack.project, appearance, source, draw.paletteChannel)
    const spriteCanvas = spriteToCanvas(source, colors, draw.hiddenRegions, silhouetteOnly)
    const [a, b, c, d, x, y] = draw.matrix
    const tx = x + a * -draw.pivot[0] + c * -draw.pivot[1]
    const ty = y + b * -draw.pivot[0] + d * -draw.pivot[1]
    ctx.save()
    ctx.setTransform(a, b, c, d, ox + tx, oy + ty)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(spriteCanvas, 0, 0)
    ctx.restore()
  }
}

function finalizeCenteredThumbnail(
  scratch: HTMLCanvasElement,
  outW: number,
  outH: number,
  emptyBadge = false,
): string {
  const sCtx = scratch.getContext('2d')!
  const img = sCtx.getImageData(0, 0, scratch.width, scratch.height)
  const d = img.data
  let minX = scratch.width
  let minY = scratch.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < scratch.height; y++) {
    for (let x = 0; x < scratch.width; x++) {
      if (d[(y * scratch.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const oCtx = out.getContext('2d')!
  oCtx.imageSmoothingEnabled = false

  if (maxX >= minX && maxY >= minY) {
    const cw = maxX - minX + 1
    const ch = maxY - minY + 1
    const scale = Math.min(1, (outW - 4) / cw, (outH - 4) / ch)
    const dw = Math.max(1, Math.round(cw * scale))
    const dh = Math.max(1, Math.round(ch * scale))
    const dx = Math.floor((outW - dw) / 2)
    const dy = Math.max(2, outH - 3 - dh)
    oCtx.drawImage(scratch, minX, minY, cw, ch, dx, dy, dw, dh)
  }

  if (emptyBadge) {
    // Crisp small "none / clear" emblem on bottom-right corner
    const cx = outW - 8
    const cy = outH - 8
    oCtx.fillStyle = 'rgba(10, 14, 24, 0.85)'
    oCtx.fillRect(cx - 5, cy - 5, 10, 10)
    oCtx.strokeStyle = 'rgba(218, 184, 114, 0.82)'
    oCtx.lineWidth = 1.3
    oCtx.beginPath()
    oCtx.arc(cx, cy, 3.6, 0, Math.PI * 2)
    oCtx.moveTo(cx - 2.4, cy + 2.4)
    oCtx.lineTo(cx + 2.4, cy - 2.4)
    oCtx.stroke()
  }

  return out.toDataURL()
}

function isTargetPartDraw(draw: DrawInstruction, slot: PartThumbSlot): boolean {
  switch (slot) {
    case 'head':
      return draw.slotId === 'source.layer.10'
    case 'ponytail':
      return (
        draw.id.startsWith('mod.tail.') ||
        draw.slotId.startsWith('teto.drill.') ||
        draw.slotId.startsWith('wardrobe.hair.')
      )
    case 'torso':
      return draw.slotId === 'source.layer.8'
    case 'waist':
      return (
        draw.id === 'mod.waist.skirt' ||
        draw.id === 'mod.waist.teto' ||
        draw.slotId === 'teal.skirt.0' ||
        draw.slotId === 'teto.skirt'
      )
    case 'arms':
      return draw.slotId === 'source.layer.7' || draw.slotId === 'source.layer.9'
    case 'legs':
      return draw.slotId === 'source.layer.3' || draw.slotId === 'source.layer.4'
    case 'scarfMode':
      return (
        draw.slotId === 'source.layer.5' ||
        draw.slotId === 'source.layer.6' ||
        draw.slotId === 'doubao.scarf.back' ||
        draw.slotId === 'doubao.scarf.front'
      )
  }
}

/** Renders a full-body pixel portrait data URL for a costume preset or combination. */
export function renderSuitThumbnail(
  pack: CompiledPack,
  selection: WardrobeSelection,
): string {
  const cleanSel: WardrobeSelection = {
    ...selection,
    headwear: 'none',
    backgear: 'none',
    badge: 'none',
  }
  const cacheKey = `suit:${cleanSel.head}:${cleanSel.ponytail}:${cleanSel.torso}:${cleanSel.waist}:${cleanSel.arms}:${cleanSel.legs}:${cleanSel.scarfMode}:${cleanSel.hairDye}:${cleanSel.garmentDye}:${cleanSel.scarfDye}`
  const existing = thumbDataUrlCache.get(cacheKey)
  if (existing) return existing

  const bodyId = pack.project.bodies[0].id
  const appearance = buildAppearanceFromSelection(cleanSel, bodyId)
  const actor = new Character({ pack, appearance })
  actor.playBase('idle', { restart: true })
  actor.setFacing('right')
  const pose = actor.evaluate()
  const sorted = [...pose.draws].sort((a, b) => a.drawOrder - b.drawOrder)

  const scratch = document.createElement('canvas')
  scratch.width = 96
  scratch.height = 96
  const ctx = scratch.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  drawInstructionsOntoCanvas(pack, appearance, sorted, ctx, 48, 76, false)

  const url = finalizeCenteredThumbnail(scratch, 46, 54, false)
  thumbDataUrlCache.set(cacheKey, url)
  return url
}

/** Renders an isolated pixel preview of an individual part slot on a muted body silhouette. */
export function renderPartThumbnail(
  pack: CompiledPack,
  slot: PartThumbSlot,
  value: string,
  baseSelection: WardrobeSelection,
): string {
  const dyeKey =
    slot === 'head' || slot === 'ponytail'
      ? baseSelection.hairDye
      : slot === 'scarfMode'
        ? baseSelection.scarfDye
        : baseSelection.garmentDye
  const cacheKey = `part:${slot}:${value}:${dyeKey}`
  const existing = thumbDataUrlCache.get(cacheKey)
  if (existing) return existing

  const previewSel: WardrobeSelection = {
    head:
      slot === 'ponytail' && value.startsWith('wardrobe.hair.')
        ? 'head.hoodie'
        : slot === 'ponytail' && value === 'tail.teto'
          ? 'head.teto'
          : 'head.teal',
    ponytail: 'none',
    torso: 'torso.teal',
    waist: 'none',
    arms: 'arms.teal',
    legs: 'legs.teal',
    scarfMode: 'none',
    hairDye: baseSelection.hairDye,
    garmentDye: baseSelection.garmentDye,
    scarfDye: baseSelection.scarfDye,
    headwear: 'none',
    backgear: 'none',
    badge: 'none',
    [slot]: value,
  }

  const bodyId = pack.project.bodies[0].id
  const appearance = buildAppearanceFromSelection(previewSel, bodyId)
  const actor = new Character({ pack, appearance })
  actor.playBase('idle', { restart: true })
  actor.setFacing('right')
  const pose = actor.evaluate()
  const sorted = [...pose.draws].sort((a, b) => a.drawOrder - b.drawOrder)

  const bgDraws = sorted.filter((d) => !isTargetPartDraw(d, slot))
  const fgDraws = sorted.filter((d) => isTargetPartDraw(d, slot))

  const scratch = document.createElement('canvas')
  scratch.width = 96
  scratch.height = 96
  const ctx = scratch.getContext('2d')!
  ctx.imageSmoothingEnabled = false

  drawInstructionsOntoCanvas(pack, appearance, bgDraws, ctx, 48, 76, true)
  if (value !== 'none' && fgDraws.length > 0) {
    drawInstructionsOntoCanvas(pack, appearance, fgDraws, ctx, 48, 76, false)
  }

  const url = finalizeCenteredThumbnail(scratch, 40, 48, value === 'none')
  thumbDataUrlCache.set(cacheKey, url)
  return url
}
