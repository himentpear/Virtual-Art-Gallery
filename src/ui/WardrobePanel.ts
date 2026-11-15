import type { CompiledPack } from '@pixelsyn/schema'
import { DEFAULT_WARDROBE, getAccessoryIconDataUrl, type VisualAccessoryId } from '../character/HeroController'
import {
  type PartThumbSlot,
  renderPartThumbnail,
  renderSuitThumbnail,
} from '../character/WardrobeThumbnails'
import type {
  BackgearId,
  BadgePropId,
  GarmentDyeId,
  HairDyeId,
  HeadwearId,
  ScarfDyeId,
  WardrobeSelection,
} from '../types'

export type SuitSeriesId = 'all' | 'gallery' | 'ranger' | 'atelier'
export type WardrobePrimaryTab = 'suits' | 'parts' | 'accessories' | 'dyes'

export interface PresetConfig {
  id: string
  name: string
  tag: string
  series: Exclude<SuitSeriesId, 'all'>
  selection: WardrobeSelection
}

export interface SubmenuOption {
  id: string
  label: string
}

export interface PartChoiceOption {
  value: string
  label: string
  origin: string
}

export interface PartSlotGroup {
  key: PartThumbSlot
  title: string
  choices: PartChoiceOption[]
}

export const PRIMARY_WARDROBE_TABS: Array<{ id: WardrobePrimaryTab; label: string }> = [
  { id: 'suits', label: '套装' },
  { id: 'parts', label: '部件' },
  { id: 'accessories', label: '饰品' },
  { id: 'dyes', label: '染色' },
]

export const SUIT_SERIES: Array<{ id: SuitSeriesId; label: string }> = [
  { id: 'all', label: '全部套装' },
  { id: 'gallery', label: '经典馆藏' },
  { id: 'atelier', label: '日常工坊' },
  { id: 'ranger', label: '旅人巡游' },
]

export const HEADWEAR_CHOICES: Array<{ id: HeadwearId; name: string; desc: string }> = [
  { id: 'none', name: '无头饰', desc: '素颜发式' },
  { id: 'halo_star', name: '星辉光环', desc: '浮空星环' },
  { id: 'crown_laurel', name: '缪斯月桂冠', desc: '鎏金桂冠' },
  { id: 'beret_artist', name: '画师贝雷帽', desc: '绯绒画帽' },
  { id: 'visor_holo', name: '全息目镜', desc: '流光视镜' },
]

export const BACKGEAR_CHOICES: Array<{ id: BackgearId; name: string; desc: string }> = [
  { id: 'none', name: '无背饰', desc: '轻装上阵' },
  { id: 'butterfly_star', name: '星蝶随从', desc: '伴飞星蝶' },
  { id: 'wings_astral', name: '星芒光翼', desc: '透光羽翼' },
  { id: 'cape_royal', name: '丝绒披风', desc: '礼宾大氅' },
  { id: 'lantern_float', name: '浮空引路灯', desc: '暖光悬灯' },
]

export const BADGE_CHOICES: Array<{ id: BadgePropId; name: string; desc: string }> = [
  { id: 'none', name: '无挂饰', desc: '简洁风衣' },
  { id: 'badge_vip', name: '黄金铭牌', desc: '贵宾勋章' },
  { id: 'scroll_guide', name: '典藏卷轴', desc: '腰间导览' },
  { id: 'rose_brooch', name: '绯月胸针', desc: '玫瑰襟花' },
]

export const PART_SLOT_GROUPS: PartSlotGroup[] = [
  {
    key: 'head',
    title: '头部发式',
    choices: [
      { value: 'head.teal', label: 'miku 少女', origin: 'miku' },
      { value: 'head.teto', label: 'Teto 发夹', origin: 'Teto' },
      { value: 'head.doubao', label: '豆包短发', origin: '豆包' },
      { value: 'head.naiwa', label: '奶蛙鸭嘴', origin: '奶蛙' },
      { value: 'head.copper', label: '暮铜风帽', origin: '暮铜游侠' },
      { value: 'head.hoodie', label: '卫衣素颜', origin: '日常卫衣' },
      { value: 'head.uniform', label: '学院素颜', origin: '学院制服' },
      { value: 'head.traveler', label: '旅行素颜', origin: '旅行夹克' },
      { value: 'head.original', label: '原始短发', origin: '原始人物' },
    ],
  },
  {
    key: 'ponytail',
    title: '发型 / 马尾',
    choices: [
      { value: 'tail.both', label: 'miku 双马尾', origin: 'miku' },
      { value: 'tail.back', label: 'miku 单马尾', origin: 'miku' },
      { value: 'tail.teto', label: '双螺旋钻', origin: 'Teto' },
      { value: 'wardrobe.hair.short', label: '短碎发', origin: '日常卫衣' },
      { value: 'wardrobe.hair.bob', label: '齐耳波波', origin: '学院制服' },
      { value: 'wardrobe.hair.ponytail', label: '高马尾', origin: '旅行夹克' },
      { value: 'wardrobe.hair.long', label: '披肩长发', origin: '百搭发型' },
      { value: 'none', label: '收起发型', origin: '隐藏' },
    ],
  },
  {
    key: 'torso',
    title: '上装胸甲',
    choices: [
      { value: 'torso.teal', label: '水手领衣', origin: 'miku' },
      { value: 'torso.teto', label: '灰红制服', origin: 'Teto' },
      { value: 'torso.doubao', label: '炭灰短袖', origin: '豆包' },
      { value: 'torso.naiwa', label: '奶蛙圆肚', origin: '奶蛙' },
      { value: 'torso.copper', label: '游侠胸甲', origin: '暮铜游侠' },
      { value: 'torso.hoodie', label: '连帽卫衣', origin: '日常卫衣' },
      { value: 'torso.uniform', label: '海军学院', origin: '学院制服' },
      { value: 'torso.traveler', label: '橄榄夹克', origin: '旅行夹克' },
      { value: 'torso.original', label: '原始轻甲', origin: '原始人物' },
    ],
  },
  {
    key: 'waist',
    title: '腰裙饰品',
    choices: [
      { value: 'waist.skirt', label: 'miku 百褶裙', origin: 'miku' },
      { value: 'waist.teto', label: 'Teto 百褶裙', origin: 'Teto' },
      { value: 'none', label: '无裙摆', origin: '简洁' },
    ],
  },
  {
    key: 'arms',
    title: '护臂袖口',
    choices: [
      { value: 'arms.teal', label: 'miku 白袖', origin: 'miku' },
      { value: 'arms.teto', label: '红黑军袖', origin: 'Teto' },
      { value: 'arms.doubao', label: '豆包短袖', origin: '豆包' },
      { value: 'arms.naiwa', label: '奶蛙短手', origin: '奶蛙' },
      { value: 'arms.copper', label: '暮铜臂甲', origin: '暮铜游侠' },
      { value: 'arms.hoodie', label: '卫衣长袖', origin: '日常卫衣' },
      { value: 'arms.uniform', label: '衬衫长袖', origin: '学院制服' },
      { value: 'arms.traveler', label: '夹克袖口', origin: '旅行夹克' },
      { value: 'arms.original', label: '皮革护腕', origin: '原始人物' },
    ],
  },
  {
    key: 'legs',
    title: '下装战靴',
    choices: [
      { value: 'legs.teal', label: '长袜短靴', origin: 'miku' },
      { value: 'legs.teto', label: '绑带战靴', origin: 'Teto' },
      { value: 'legs.doubao', label: '阔腿白鞋', origin: '豆包' },
      { value: 'legs.naiwa', label: '奶蛙短足', origin: '奶蛙' },
      { value: 'legs.copper', label: '重装长靴', origin: '暮铜游侠' },
      { value: 'legs.hoodie', label: '米白运动裤', origin: '日常卫衣' },
      { value: 'legs.uniform', label: '学院长裤', origin: '学院制服' },
      { value: 'legs.traveler', label: '工装短靴', origin: '旅行夹克' },
      { value: 'legs.original', label: '行军皮靴', origin: '原始人物' },
    ],
  },
  {
    key: 'scarfMode',
    title: '颈部披挂',
    choices: [
      { value: 'none', label: '无围巾', origin: '收起' },
      { value: 'doubao', label: '针织红围巾', origin: '豆包' },
      { value: 'both', label: '双层流云', origin: '红巾套' },
      { value: 'front', label: '前领巾', origin: '红巾套' },
      { value: 'back', label: '后披巾', origin: '红巾套' },
    ],
  },
]

export const WARDROBE_PRESETS: PresetConfig[] = [
  {
    id: 'teal',
    name: 'miku',
    tag: '馆藏少女',
    series: 'gallery',
    selection: { ...DEFAULT_WARDROBE, headwear: 'none', backgear: 'none', badge: 'none' },
  },
  {
    id: 'teto',
    name: 'Teto · 灰红制服',
    tag: '双螺旋钻',
    series: 'gallery',
    selection: {
      head: 'head.teto',
      ponytail: 'tail.teto',
      torso: 'torso.teto',
      waist: 'waist.teto',
      arms: 'arms.teto',
      legs: 'legs.teto',
      scarfMode: 'none',
      hairDye: 'original',
      garmentDye: 'classic',
      scarfDye: 'crimson',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'doubao',
    name: '豆包 · 红围巾',
    tag: '针织围巾',
    series: 'gallery',
    selection: {
      head: 'head.doubao',
      ponytail: 'none',
      torso: 'torso.doubao',
      waist: 'none',
      arms: 'arms.doubao',
      legs: 'legs.doubao',
      scarfMode: 'doubao',
      hairDye: 'original',
      garmentDye: 'classic',
      scarfDye: 'crimson',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'naiwa',
    name: '奶蛙',
    tag: '呆萌鸭嘴',
    series: 'gallery',
    selection: {
      head: 'head.naiwa',
      ponytail: 'none',
      torso: 'torso.naiwa',
      waist: 'none',
      arms: 'arms.naiwa',
      legs: 'legs.naiwa',
      scarfMode: 'none',
      hairDye: 'original',
      garmentDye: 'classic',
      scarfDye: 'crimson',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'hoodie',
    name: '日常卫衣',
    tag: '短碎发套装',
    series: 'atelier',
    selection: {
      head: 'head.hoodie',
      ponytail: 'wardrobe.hair.short',
      torso: 'torso.hoodie',
      waist: 'none',
      arms: 'arms.hoodie',
      legs: 'legs.hoodie',
      scarfMode: 'none',
      hairDye: 'brown',
      garmentDye: 'classic',
      scarfDye: 'crimson',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'uniform',
    name: '学院制服',
    tag: '齐耳波波',
    series: 'atelier',
    selection: {
      head: 'head.uniform',
      ponytail: 'wardrobe.hair.bob',
      torso: 'torso.uniform',
      waist: 'none',
      arms: 'arms.uniform',
      legs: 'legs.uniform',
      scarfMode: 'none',
      hairDye: 'brown',
      garmentDye: 'classic',
      scarfDye: 'crimson',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'traveler',
    name: '旅行夹克',
    tag: '高马尾套装',
    series: 'atelier',
    selection: {
      head: 'head.traveler',
      ponytail: 'wardrobe.hair.ponytail',
      torso: 'torso.traveler',
      waist: 'none',
      arms: 'arms.traveler',
      legs: 'legs.traveler',
      scarfMode: 'none',
      hairDye: 'brown',
      garmentDye: 'classic',
      scarfDye: 'crimson',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'starlight',
    name: '星夜学徒',
    tag: '混搭紫韵',
    series: 'atelier',
    selection: {
      head: 'head.teal',
      ponytail: 'tail.both',
      torso: 'torso.teal',
      waist: 'waist.skirt',
      arms: 'arms.copper',
      legs: 'legs.teal',
      scarfMode: 'front',
      hairDye: 'violet',
      garmentDye: 'navy',
      scarfDye: 'azure',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'copper',
    name: '暮铜游侠',
    tag: '冷甲旅装',
    series: 'ranger',
    selection: {
      head: 'head.copper',
      ponytail: 'none',
      torso: 'torso.copper',
      waist: 'none',
      arms: 'arms.copper',
      legs: 'legs.copper',
      scarfMode: 'none',
      hairDye: 'original',
      garmentDye: 'classic',
      scarfDye: 'crimson',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'original',
    name: '原始人物',
    tag: '原始原型',
    series: 'ranger',
    selection: {
      head: 'head.original',
      ponytail: 'none',
      torso: 'torso.original',
      waist: 'none',
      arms: 'arms.original',
      legs: 'legs.original',
      scarfMode: 'none',
      hairDye: 'original',
      garmentDye: 'classic',
      scarfDye: 'crimson',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'redscarf',
    name: '流风红巾',
    tag: '双层披巾',
    series: 'ranger',
    selection: {
      head: 'head.teal',
      ponytail: 'tail.back',
      torso: 'torso.original',
      waist: 'none',
      arms: 'arms.original',
      legs: 'legs.original',
      scarfMode: 'both',
      hairDye: 'silver',
      garmentDye: 'obsidian',
      scarfDye: 'crimson',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
  {
    id: 'aurora',
    name: '极光巡林',
    tag: '流金翠影',
    series: 'ranger',
    selection: {
      head: 'head.copper',
      ponytail: 'tail.back',
      torso: 'torso.copper',
      waist: 'none',
      arms: 'arms.teal',
      legs: 'legs.copper',
      scarfMode: 'back',
      hairDye: 'amber',
      garmentDye: 'emerald',
      scarfDye: 'gold',
      headwear: 'none',
      backgear: 'none',
      badge: 'none',
    },
  },
]

export const HAIR_DYES: Array<{ id: HairDyeId; name: string; color: string }> = [
  { id: 'original', name: '角色原色', color: '#c48374' },
  { id: 'teal', name: '青葱薄荷', color: '#45b8b4' },
  { id: 'brown', name: '栗棕', color: '#a9653a' },
  { id: 'black', name: '自然黑', color: '#363f4b' },
  { id: 'sakura', name: '落樱绯粉', color: '#f086a8' },
  { id: 'violet', name: '星夜幽紫', color: '#9c78de' },
  { id: 'amber', name: '亚麻流金', color: '#e5aa4e' },
  { id: 'silver', name: '霜月银灰', color: '#cad7e6' },
  { id: 'crimson', name: '赤焰绯红', color: '#d84f5c' },
]

export const GARMENT_DYES: Array<{ id: GarmentDyeId; name: string; color: string }> = [
  { id: 'classic', name: '经典原色', color: '#6b7e96' },
  { id: 'navy', name: '深海绀青', color: '#33589c' },
  { id: 'obsidian', name: '暗夜黑金', color: '#2b2d38' },
  { id: 'emerald', name: '森之翠绿', color: '#368a5e' },
  { id: 'wine', name: '蔷薇酒红', color: '#8f344d' },
]

export const SCARF_DYES: Array<{ id: ScarfDyeId; name: string; color: string }> = [
  { id: 'crimson', name: '绯红赤焰', color: '#cf346e' },
  { id: 'ivory', name: '月华纯白', color: '#e3e8f0' },
  { id: 'azure', name: '星海苍蓝', color: '#3f84d6' },
  { id: 'gold', name: '流金琥珀', color: '#dea03c' },
  { id: 'shadow', name: '暗影玄黑', color: '#2c3140' },
]

export function getSubmenuItems(primaryTab: WardrobePrimaryTab): SubmenuOption[] {
  switch (primaryTab) {
    case 'suits':
      return SUIT_SERIES.map((s) => ({ id: s.id, label: s.label }))
    case 'parts':
      return [
        { id: 'all', label: '全部部件' },
        ...PART_SLOT_GROUPS.map((g) => ({ id: g.key, label: g.title })),
      ]
    case 'accessories':
      return [
        { id: 'all', label: '全部饰品' },
        { id: 'headwear', label: '头部冠饰' },
        { id: 'backgear', label: '背部灵饰' },
        { id: 'badge', label: '随身徽饰' },
      ]
    case 'dyes':
      return [
        { id: 'all', label: '全部染色' },
        { id: 'hairDye', label: '发色工坊' },
        { id: 'garmentDye', label: '服饰染色' },
        { id: 'scarfDye', label: '围巾染色' },
      ]
  }
}

export function getDefaultSubmenuId(_primaryTab: WardrobePrimaryTab): string {
  return 'all'
}

export function isSuitMatch(preset: PresetConfig, sel: WardrobeSelection): boolean {
  const s = preset.selection
  return (
    s.head === sel.head &&
    s.ponytail === sel.ponytail &&
    s.torso === sel.torso &&
    s.waist === sel.waist &&
    s.arms === sel.arms &&
    s.legs === sel.legs &&
    s.scarfMode === sel.scarfMode &&
    s.hairDye === sel.hairDye &&
    s.garmentDye === sel.garmentDye &&
    s.scarfDye === sel.scarfDye
  )
}

export function applyPresetPreservingAccessories(
  preset: PresetConfig,
  current: WardrobeSelection,
): WardrobeSelection {
  return {
    ...preset.selection,
    headwear: current.headwear,
    backgear: current.backgear,
    badge: current.badge,
  }
}

export function createRandomWardrobeSelection(keepAccessories = true, current?: WardrobeSelection): WardrobeSelection {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
  return {
    head: pick([
      'head.teal',
      'head.teto',
      'head.doubao',
      'head.naiwa',
      'head.copper',
      'head.hoodie',
      'head.uniform',
      'head.traveler',
      'head.original',
    ]),
    ponytail: pick([
      'none',
      'tail.both',
      'tail.back',
      'tail.teto',
      'wardrobe.hair.short',
      'wardrobe.hair.bob',
      'wardrobe.hair.ponytail',
      'wardrobe.hair.long',
    ]),
    torso: pick([
      'torso.teal',
      'torso.teto',
      'torso.doubao',
      'torso.naiwa',
      'torso.copper',
      'torso.hoodie',
      'torso.uniform',
      'torso.traveler',
      'torso.original',
    ]),
    waist: pick(['none', 'waist.skirt', 'waist.teto']),
    arms: pick([
      'arms.teal',
      'arms.teto',
      'arms.doubao',
      'arms.naiwa',
      'arms.copper',
      'arms.hoodie',
      'arms.uniform',
      'arms.traveler',
      'arms.original',
    ]),
    legs: pick([
      'legs.teal',
      'legs.teto',
      'legs.doubao',
      'legs.naiwa',
      'legs.copper',
      'legs.hoodie',
      'legs.uniform',
      'legs.traveler',
      'legs.original',
    ]),
    scarfMode: pick(['none', 'doubao', 'both', 'front', 'back']),
    hairDye: pick(HAIR_DYES).id,
    garmentDye: pick(GARMENT_DYES).id,
    scarfDye: pick(SCARF_DYES).id,
    headwear: keepAccessories && current ? current.headwear : 'none',
    backgear: keepAccessories && current ? current.backgear : 'none',
    badge: keepAccessories && current ? current.badge : 'none',
  }
}

export function renderAccessoryCardsHtml(
  title: string,
  slot: 'headwear' | 'backgear' | 'badge',
  activeId: VisualAccessoryId,
  choices: Array<{ id: VisualAccessoryId; name: string; desc: string }>,
): string {
  const cards = choices
    .map(
      (c) => `
      <button
        type="button"
        class="acc-card ${activeId === c.id ? 'active' : ''}"
        data-slot="${slot}"
        data-val="${c.id}"
        title="${c.name} · ${c.desc}"
      >
        <span class="acc-thumb"><img src="${getAccessoryIconDataUrl(c.id)}" alt="${c.name}" /></span>
        <span class="acc-meta">
          <span class="acc-name">${c.name}</span>
          <span class="acc-desc">${c.desc}</span>
        </span>
      </button>`,
    )
    .join('')
  return `
    <div class="part-group">
      <div class="part-title">${title}</div>
      <div class="acc-grid">${cards}</div>
    </div>
  `
}

export function renderWardrobeNavHtml(
  primaryTab: WardrobePrimaryTab,
  subTab: string,
): string {
  const primaryBtns = PRIMARY_WARDROBE_TABS.map(
    (t) => `
    <button
      type="button"
      class="wtab-btn ${primaryTab === t.id ? 'active' : ''}"
      data-wtab="${t.id}"
    >${t.label}</button>`,
  ).join('')

  const subItems = getSubmenuItems(primaryTab)
  const subBtns = subItems
    .map(
      (s) => `
    <button
      type="button"
      class="submenu-pill ${subTab === s.id ? 'active' : ''}"
      data-wsub="${s.id}"
    >${s.label}</button>`,
    )
    .join('')

  return `
    <div class="wtab-bar">${primaryBtns}</div>
    <div class="submenu-slider" data-role="submenu-slider">
      <button type="button" class="submenu-arrow" data-slide="-1" aria-label="向左滑动二级菜单">‹</button>
      <div class="submenu-track" data-role="submenu-track">${subBtns}</div>
      <button type="button" class="submenu-arrow" data-slide="1" aria-label="向右滑动二级菜单">›</button>
    </div>
  `
}

export function renderWardrobeBodyContentHtml(
  pack: CompiledPack,
  selection: WardrobeSelection,
  primaryTab: WardrobePrimaryTab,
  subTab: string,
): string {
  if (primaryTab === 'suits') {
    const filtered =
      subTab === 'all'
        ? WARDROBE_PRESETS
        : WARDROBE_PRESETS.filter((p) => p.series === subTab)
    const cards = filtered
      .map((p) => {
        const active = isSuitMatch(p, selection)
        const thumbUrl = renderSuitThumbnail(pack, p.selection)
        return `
          <button
            type="button"
            class="suit-vis-card ${active ? 'active' : ''}"
            data-preset="${p.id}"
            title="${p.name} · ${p.tag}"
          >
            <span class="suit-thumb-box">
              <img class="suit-thumb" src="${thumbUrl}" alt="${p.name}" />
            </span>
            <span class="suit-info">
              <span class="preset-name">${p.name}</span>
              <span class="preset-tag">${p.tag}</span>
            </span>
          </button>`
      })
      .join('')
    const activeSeriesLabel =
      SUIT_SERIES.find((s) => s.id === subTab)?.label ?? '全部套装'
    return `
      <section class="wardrobe-section">
        <div class="section-heading">${activeSeriesLabel}（点击即换装 · 不影响已选饰品）</div>
        <div class="suit-vis-grid">${cards}</div>
      </section>
    `
  }

  if (primaryTab === 'parts') {
    const groups =
      subTab === 'all'
        ? PART_SLOT_GROUPS
        : PART_SLOT_GROUPS.filter((g) => g.key === subTab)
    const blocks = groups
      .map((g) => {
        const cards = g.choices
          .map((c) => {
            const active = selection[g.key] === c.value
            const thumbUrl = renderPartThumbnail(pack, g.key, c.value, selection)
            return `
              <button
                type="button"
                class="part-vis-card ${active ? 'active' : ''}"
                data-slot="${g.key}"
                data-val="${c.value}"
                title="${g.title} · ${c.label}"
              >
                <span class="part-thumb-box">
                  <img class="part-thumb" src="${thumbUrl}" alt="${c.label}" />
                </span>
                <span class="part-meta">
                  <span class="part-name">${c.label}</span>
                  <span class="part-origin">${c.origin}</span>
                </span>
              </button>`
          })
          .join('')
        return `
          <div class="part-group">
            <div class="part-title">${g.title}</div>
            <div class="part-vis-grid">${cards}</div>
          </div>
        `
      })
      .join('')
    return `
      <section class="wardrobe-section">
        <div class="section-heading">部件可视化混搭（已隐藏武器图层）</div>
        ${blocks}
      </section>
    `
  }

  if (primaryTab === 'accessories') {
    const blocks: string[] = []
    if (subTab === 'all' || subTab === 'headwear') {
      blocks.push(
        renderAccessoryCardsHtml('头部冠饰', 'headwear', selection.headwear, HEADWEAR_CHOICES),
      )
    }
    if (subTab === 'all' || subTab === 'backgear') {
      blocks.push(
        renderAccessoryCardsHtml('背部灵饰', 'backgear', selection.backgear, BACKGEAR_CHOICES),
      )
    }
    if (subTab === 'all' || subTab === 'badge') {
      blocks.push(
        renderAccessoryCardsHtml('随身徽饰', 'badge', selection.badge, BADGE_CHOICES),
      )
    }
    return `
      <section class="wardrobe-section">
        <div class="section-heading">自由选择视觉装饰（默认无饰品）</div>
        ${blocks.join('')}
      </section>
    `
  }

  // 'dyes'
  const swatchRow = <K extends 'hairDye' | 'garmentDye' | 'scarfDye'>(
    title: string,
    key: K,
    swatches: Array<{ id: WardrobeSelection[K]; name: string; color: string }>,
  ) => {
    const items = swatches
      .map(
        (s) => `
        <button
          type="button"
          class="swatch-btn ${selection[key] === s.id ? 'active' : ''}"
          data-slot="${key}"
          data-val="${String(s.id)}"
          title="${s.name}"
        >
          <span class="swatch-dot" style="background:${s.color}"></span>
          <span class="swatch-name">${s.name}</span>
        </button>`,
      )
      .join('')
    return `
      <div class="part-group">
        <div class="part-title">${title}</div>
        <div class="swatch-grid">${items}</div>
      </div>
    `
  }

  const dyeBlocks: string[] = []
  if (subTab === 'all' || subTab === 'hairDye') {
    dyeBlocks.push(swatchRow('发色工坊', 'hairDye', HAIR_DYES))
  }
  if (subTab === 'all' || subTab === 'garmentDye') {
    dyeBlocks.push(swatchRow('服饰染色', 'garmentDye', GARMENT_DYES))
  }
  if (subTab === 'all' || subTab === 'scarfDye') {
    dyeBlocks.push(swatchRow('围巾染色', 'scarfDye', SCARF_DYES))
  }
  return `
    <section class="wardrobe-section">
      <div class="section-heading">无损调色板染色</div>
      ${dyeBlocks.join('')}
    </section>
  `
}

/** Wires horizontal arrow buttons, mouse-wheel, and pointer drag-sliding onto a submenu bar. */
export function wireSubmenuSlider(container: HTMLElement): void {
  const track = container.querySelector<HTMLElement>('[data-role="submenu-track"]')
  if (!track) return
  const prevBtn = container.querySelector<HTMLButtonElement>('[data-slide="-1"]')
  const nextBtn = container.querySelector<HTMLButtonElement>('[data-slide="1"]')

  const syncArrowStates = () => {
    if (!prevBtn || !nextBtn) return
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth)
    prevBtn.disabled = track.scrollLeft <= 1
    nextBtn.disabled = track.scrollLeft >= maxScroll - 1
  }

  prevBtn?.addEventListener('click', () => {
    track.scrollBy({ left: -140, behavior: 'smooth' })
  })
  nextBtn?.addEventListener('click', () => {
    track.scrollBy({ left: 140, behavior: 'smooth' })
  })

  track.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        track.scrollLeft += e.deltaY
      }
    },
    { passive: false },
  )

  let dragging = false
  let moved = false
  let startX = 0
  let startScrollLeft = 0

  track.addEventListener('pointerdown', (e) => {
    dragging = true
    moved = false
    startX = e.clientX
    startScrollLeft = track.scrollLeft
  })
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return
    const dx = e.clientX - startX
    if (Math.abs(dx) > 4) moved = true
    if (moved) track.scrollLeft = startScrollLeft - dx
  })
  window.addEventListener('pointerup', () => {
    dragging = false
  })
  track.addEventListener(
    'click',
    (e) => {
      if (moved) {
        e.stopPropagation()
        e.preventDefault()
        moved = false
      }
    },
    true,
  )

  track.addEventListener('scroll', syncArrowStates)
  requestAnimationFrame(syncArrowStates)
}

export interface WardrobePanelCallbacks {
  onChange: (next: WardrobeSelection) => Promise<void>
  onPreviewAction: (clipId: 'idle' | 'walk' | 'run' | 'jump') => void
  onFlipFacing: () => void
  onClose: () => void
}

export class WardrobePanel {
  readonly element: HTMLElement
  private pack: CompiledPack
  private current: WardrobeSelection
  private callbacks: WardrobePanelCallbacks
  private primaryTab: WardrobePrimaryTab = 'suits'
  private subTab = 'all'
  private navEl!: HTMLElement
  private bodyEl!: HTMLElement
  private busy = false

  constructor(pack: CompiledPack, initial: WardrobeSelection, callbacks: WardrobePanelCallbacks) {
    this.pack = pack
    this.current = structuredClone(initial)
    this.callbacks = callbacks
    this.element = document.createElement('aside')
    this.element.className = 'wardrobe-drawer hidden'
    this.renderShell()
    this.renderNavAndBody()
  }

  public open(selection: WardrobeSelection): void {
    this.current = structuredClone(selection)
    this.renderNavAndBody()
    this.element.classList.remove('hidden')
  }

  public close(): void {
    this.element.classList.add('hidden')
  }

  public isOpen(): boolean {
    return !this.element.classList.contains('hidden')
  }

  private renderShell(): void {
    this.element.innerHTML = `
      <div class="wardrobe-header">
        <div>
          <div class="wardrobe-eyebrow">PIXELSYN ATELIER</div>
          <h2>幻装衣橱工坊</h2>
        </div>
        <button class="icon-btn" data-action="close" title="关闭换装 (Esc / C)">✕</button>
      </div>
      <div class="wardrobe-preview-bar">
        <span class="preview-label">姿态预览</span>
        <div class="preview-actions">
          <button class="mini-btn" data-clip="idle">待机</button>
          <button class="mini-btn" data-clip="walk">行走</button>
          <button class="mini-btn" data-clip="run">奔跑</button>
          <button class="mini-btn" data-clip="jump">跳跃</button>
          <button class="mini-btn" data-action="flip">转身</button>
        </div>
      </div>
      <div class="wardrobe-nav" data-role="wardrobe-nav"></div>
      <div class="wardrobe-scroll"></div>
      <div class="wardrobe-footer">
        <button class="ghost-btn" data-action="randomize">随机混搭</button>
        <button class="ghost-btn" data-action="reset">恢复默认</button>
        <button class="primary-btn" data-action="close">完成换装</button>
      </div>
    `
    this.navEl = this.element.querySelector('[data-role="wardrobe-nav"]')!
    this.bodyEl = this.element.querySelector('.wardrobe-scroll')!

    this.element.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-action],[data-clip],[data-wtab],[data-wsub]',
      )
      if (!target) return
      const wtab = target.dataset.wtab as WardrobePrimaryTab | undefined
      if (wtab) {
        this.primaryTab = wtab
        this.subTab = getDefaultSubmenuId(wtab)
        this.renderNavAndBody()
        return
      }
      const wsub = target.dataset.wsub
      if (wsub) {
        this.subTab = wsub
        this.renderNavAndBody({ preserveSubScroll: true, centerActiveSub: true })
        return
      }
      const action = target.dataset.action
      const clip = target.dataset.clip as 'idle' | 'walk' | 'run' | 'jump' | undefined
      if (clip) {
        this.callbacks.onPreviewAction(clip)
        return
      }
      if (action === 'close') this.callbacks.onClose()
      else if (action === 'flip') this.callbacks.onFlipFacing()
      else if (action === 'reset') void this.applyNext({ ...DEFAULT_WARDROBE })
      else if (action === 'randomize') {
        void this.applyNext(createRandomWardrobeSelection(true, this.current))
      }
    })
  }

  private async applyNext(next: WardrobeSelection): Promise<void> {
    if (this.busy) return
    this.busy = true
    const scrollTop = this.bodyEl.scrollTop
    const subScroll =
      this.navEl.querySelector<HTMLElement>('[data-role="submenu-track"]')?.scrollLeft ?? 0
    this.current = structuredClone(next)
    this.renderNavAndBody({ preserveSubScroll: true, customSubScrollLeft: subScroll })
    this.bodyEl.scrollTop = scrollTop
    try {
      await this.callbacks.onChange(this.current)
    } finally {
      this.busy = false
    }
  }

  private renderNavAndBody(opts?: {
    preserveSubScroll?: boolean
    centerActiveSub?: boolean
    customSubScrollLeft?: number
  }): void {
    const prevTrack = this.navEl.querySelector<HTMLElement>('[data-role="submenu-track"]')
    const prevScrollLeft = opts?.customSubScrollLeft ?? prevTrack?.scrollLeft ?? 0

    this.navEl.innerHTML = renderWardrobeNavHtml(this.primaryTab, this.subTab)
    wireSubmenuSlider(this.navEl)

    const nextTrack = this.navEl.querySelector<HTMLElement>('[data-role="submenu-track"]')
    if (nextTrack && opts?.preserveSubScroll) {
      nextTrack.scrollLeft = prevScrollLeft
    }
    if (opts?.centerActiveSub) {
      const activeBtn = nextTrack?.querySelector<HTMLElement>('.submenu-pill.active')
      activeBtn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }

    this.bodyEl.innerHTML = renderWardrobeBodyContentHtml(
      this.pack,
      this.current,
      this.primaryTab,
      this.subTab,
    )

    this.bodyEl.querySelectorAll<HTMLElement>('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = WARDROBE_PRESETS.find((p) => p.id === btn.dataset.preset)
        if (found) void this.applyNext(applyPresetPreservingAccessories(found, this.current))
      })
    })

    this.bodyEl.querySelectorAll<HTMLElement>('[data-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot as keyof WardrobeSelection
        const val = btn.dataset.val as never
        const next = { ...this.current, [slot]: val }
        void this.applyNext(next)
      })
    })
  }
}
