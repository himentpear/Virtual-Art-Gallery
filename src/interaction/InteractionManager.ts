import { GALLERY_HOTSPOTS } from '../scene/GalleryScene'
import type { Hotspot } from '../types'

export class InteractionManager {
  private currentHotspot: Hotspot | null = null

  public findNearestHotspot(x: number, floorY: number): Hotspot | null {
    let best: Hotspot | null = null
    let bestDist = Infinity
    for (const spot of GALLERY_HOTSPOTS) {
      const dx = x - spot.x
      const dy = (floorY - spot.y) * 1.35
      const d = Math.hypot(dx, dy)
      if (d <= spot.radius && d < bestDist) {
        best = spot
        bestDist = d
      }
    }
    this.currentHotspot = best
    return best
  }

  public getCurrentHotspot(): Hotspot | null {
    return this.currentHotspot
  }
}
