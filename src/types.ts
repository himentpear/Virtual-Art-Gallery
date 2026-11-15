import type { Appearance } from '@pixelsyn/schema'

export type LightingPresetId = 'night_gallery' | 'starlight_dream' | 'amber_evening'

export interface LightingPreset {
  id: LightingPresetId
  name: string
  subtitle: string
  ambientTint: number
  ambientAlpha: number
  skylightColor: number
  skylightAlpha: number
  spotColor: number
  spotAlpha: number
  sconceColor: number
  sconceAlpha: number
  plinthColor: number
  plinthAlpha: number
  dustColor: number
}

export type WardrobeSlotId = 'head' | 'ponytail' | 'torso' | 'waist' | 'arms' | 'legs'
export type ScarfModeId = 'none' | 'doubao' | 'both' | 'front' | 'back'
export type HairDyeId =
  | 'original'
  | 'teal'
  | 'brown'
  | 'black'
  | 'sakura'
  | 'violet'
  | 'amber'
  | 'silver'
  | 'crimson'
export type GarmentDyeId = 'classic' | 'navy' | 'obsidian' | 'emerald' | 'wine'
export type ScarfDyeId = 'crimson' | 'ivory' | 'azure' | 'gold' | 'shadow'

export type HeadwearId = 'none' | 'halo_star' | 'crown_laurel' | 'beret_artist' | 'visor_holo'
export type BackgearId = 'none' | 'wings_astral' | 'cape_royal' | 'lantern_float' | 'butterfly_star'
export type BadgePropId = 'none' | 'badge_vip' | 'scroll_guide' | 'rose_brooch'

export interface AccessorySelection {
  headwear: HeadwearId
  backgear: BackgearId
  badge: BadgePropId
}

export interface WardrobeSelection {
  head:
    | 'head.teal'
    | 'head.teto'
    | 'head.doubao'
    | 'head.naiwa'
    | 'head.copper'
    | 'head.hoodie'
    | 'head.uniform'
    | 'head.traveler'
    | 'head.original'
  ponytail:
    | 'none'
    | 'tail.both'
    | 'tail.back'
    | 'tail.teto'
    | 'wardrobe.hair.short'
    | 'wardrobe.hair.bob'
    | 'wardrobe.hair.ponytail'
    | 'wardrobe.hair.long'
  torso:
    | 'torso.teal'
    | 'torso.teto'
    | 'torso.doubao'
    | 'torso.naiwa'
    | 'torso.copper'
    | 'torso.hoodie'
    | 'torso.uniform'
    | 'torso.traveler'
    | 'torso.original'
  waist: 'none' | 'waist.skirt' | 'waist.teto'
  arms:
    | 'arms.teal'
    | 'arms.teto'
    | 'arms.doubao'
    | 'arms.naiwa'
    | 'arms.copper'
    | 'arms.hoodie'
    | 'arms.uniform'
    | 'arms.traveler'
    | 'arms.original'
  legs:
    | 'legs.teal'
    | 'legs.teto'
    | 'legs.doubao'
    | 'legs.naiwa'
    | 'legs.copper'
    | 'legs.hoodie'
    | 'legs.uniform'
    | 'legs.traveler'
    | 'legs.original'
  scarfMode: ScarfModeId
  hairDye: HairDyeId
  garmentDye: GarmentDyeId
  scarfDye: ScarfDyeId
  headwear: HeadwearId
  backgear: BackgearId
  badge: BadgePropId
}

export type VisitorGenderId = 'undisclosed' | 'female' | 'male' | 'nonbinary'

export interface VisitorProfile {
  passId: string
  name: string
  gender: VisitorGenderId
  title: string
  bio: string
  tags: string[]
  registeredAt: string
}

export type CorridorWingId = 'entrance' | 'west' | 'center' | 'east'

export type ArtworkId =
  | 'center_painting'
  | 'left_plaque'
  | 'right_plaque'
  | 'west_center_painting'
  | 'west_left_plaque'
  | 'west_right_plaque'
  | 'east_center_painting'
  | 'east_left_plaque'
  | 'east_right_plaque'

export type HotspotId =
  | ArtworkId
  | 'entrance_reception'
  | 'entrance_kiosk'
  | 'left_bench'
  | 'right_bench'
  | 'west_bench'
  | 'east_bench'
  | 'lighting_console'
  | 'wardrobe_mirror'

export interface Hotspot {
  id: HotspotId
  label: string
  promptText: string
  x: number
  y: number
  radius: number
  hintY: number
  wing: CorridorWingId
}

export interface ArtworkInspectionData {
  id: ArtworkId
  title: string
  englishTitle: string
  artist: string
  era: string
  medium: string
  dimensions: string
  description: string
  curatorialNote: string
  canvasDataUrl: string
  accentColor: string
}

export interface CharacterLightSample {
  bodyTint: number
  reflectionTint: number
  rimColor: number
  rimAlpha: number
  backLightIntensity: number
  backLightDirX: number
  shadowOffsetX: number
  shadowStretchY: number
  shadowSkewX: number
  shadowScaleY: number
  shadowAlpha: number
  secondaryShadowSkewX: number
  secondaryShadowScaleY: number
  secondaryShadowAlpha: number
}

export type ActiveMode =
  | 'register'
  | 'explore'
  | 'gaze_center'
  | 'inspect_artwork'
  | 'sit_bench'
  | 'wardrobe'

export interface HeroTelemetry {
  x: number
  floorY: number
  jumpZ: number
  facing: 'left' | 'right'
  clipId: string
  isRunning: boolean
  isGrounded: boolean
  isBacklit?: boolean
}

export type WardrobeAppearanceBuilder = (sel: WardrobeSelection, bodyId: string) => Appearance
