import type { CompiledPack } from '@pixelsyn/schema'
import type { VisitorGenderId, VisitorProfile, WardrobeSelection } from '../types'
import {
  applyPresetPreservingAccessories,
  BACKGEAR_CHOICES,
  BADGE_CHOICES,
  createRandomWardrobeSelection,
  getDefaultSubmenuId,
  HEADWEAR_CHOICES,
  renderWardrobeBodyContentHtml,
  renderWardrobeNavHtml,
  WARDROBE_PRESETS,
  type WardrobePrimaryTab,
  wireSubmenuSlider,
} from './WardrobePanel'

const VISITOR_STORAGE_KEY = 'hall.visitor.v1'

const GENDER_OPTIONS: Array<{ id: VisitorGenderId; label: string }> = [
  { id: 'undisclosed', label: '不透露' },
  { id: 'female', label: '女' },
  { id: 'male', label: '男' },
  { id: 'nonbinary', label: '多元' },
]

const TITLE_OPTIONS = ['算法策展人', '关卡栽培师', '剪枝观察者', '像素旅人', '特邀贵宾']

const INTEREST_TAGS = ['程序化生成', '算法美学', '益智解谜', '关卡设计', '像素艺术']

const RANDOM_NAMES = [
  '算法观察者',
  '种子栽培师',
  '剪枝漫游者',
  '像素策展人',
  '影戏旅人',
  '发条研究员',
  '花园访客',
]

function generatePassId(): string {
  const num = 1000 + Math.floor(Math.random() * 9000)
  return `CP-2026-${num}`
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function createDefaultVisitorProfile(): VisitorProfile {
  return {
    passId: generatePassId(),
    name: '',
    gender: 'undisclosed',
    title: TITLE_OPTIONS[0],
    bio: '',
    tags: ['程序化生成', '算法美学'],
    registeredAt: '',
  }
}

export function loadVisitorProfile(): VisitorProfile {
  try {
    const raw = localStorage.getItem(VISITOR_STORAGE_KEY)
    if (!raw) return createDefaultVisitorProfile()
    const parsed = JSON.parse(raw) as Partial<VisitorProfile>
    return {
      ...createDefaultVisitorProfile(),
      ...parsed,
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['程序化生成', '算法美学'],
    }
  } catch {
    return createDefaultVisitorProfile()
  }
}

export function saveVisitorProfile(profile: VisitorProfile): void {
  try {
    localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // ignore storage quota errors
  }
}

export interface RegistrationCallbacks {
  onWardrobeChange: (next: WardrobeSelection) => Promise<void>
  onPreviewAction: (clipId: 'idle' | 'walk' | 'run' | 'jump') => void
  onFlipFacing: () => void
  onComplete: (profile: VisitorProfile) => void
}

export class RegistrationOverlay {
  readonly element = document.createElement('section')
  private pack: CompiledPack
  private wardrobe: WardrobeSelection
  private profile: VisitorProfile
  private callbacks: RegistrationCallbacks
  private primaryTab: WardrobePrimaryTab = 'suits'
  private subTab = 'all'
  private busyWardrobe = false
  private fadeTimer?: number

  private leftNavEl!: HTMLElement
  private leftBodyEl!: HTMLElement
  private centerTitleEl!: HTMLElement
  private centerAccessoriesEl!: HTMLElement
  private passPreviewEl!: HTMLElement
  private nameInputEl!: HTMLInputElement
  private bioInputEl!: HTMLTextAreaElement
  private bioCountEl!: HTMLElement

  constructor(
    pack: CompiledPack,
    initialWardrobe: WardrobeSelection,
    initialProfile: VisitorProfile,
    callbacks: RegistrationCallbacks,
  ) {
    this.pack = pack
    this.wardrobe = structuredClone(initialWardrobe)
    this.profile = structuredClone(initialProfile)
    this.callbacks = callbacks
    this.element.className = 'registration-overlay'
    this.renderShell()
    this.renderLeftBody()
    this.syncProfileUi()
  }

  public open(wardrobe: WardrobeSelection, profile: VisitorProfile): void {
    if (this.fadeTimer) {
      window.clearTimeout(this.fadeTimer)
      this.fadeTimer = undefined
    }
    this.wardrobe = structuredClone(wardrobe)
    this.profile = structuredClone(profile)
    this.element.classList.remove('hidden', 'fading-out')
    this.renderLeftBody()
    this.syncRightControlsFromState()
    this.syncProfileUi()
  }

  public closeWithFade(): void {
    this.element.classList.add('fading-out')
    if (this.fadeTimer) window.clearTimeout(this.fadeTimer)
    this.fadeTimer = window.setTimeout(() => {
      this.element.classList.add('hidden')
      this.element.classList.remove('fading-out')
    }, 650)
  }

  public isOpen(): boolean {
    return (
      !this.element.classList.contains('hidden') &&
      !this.element.classList.contains('fading-out')
    )
  }

  private renderShell(): void {
    const genderButtons = GENDER_OPTIONS.map(
      (g) => `<button type="button" class="reg-chip" data-gender="${g.id}">${g.label}</button>`,
    ).join('')

    const titleButtons = TITLE_OPTIONS.map(
      (t) => `<button type="button" class="reg-chip" data-title="${t}">${t}</button>`,
    ).join('')

    const tagButtons = INTEREST_TAGS.map(
      (tag) => `<button type="button" class="reg-tag-chip" data-tag="${tag}">${tag}</button>`,
    ).join('')

    this.element.innerHTML = `
      <header class="reg-topbar">
        <div class="reg-brand">
          <span class="reg-crest">◆</span>
          <div>
            <div class="reg-brand-title">栽培与剪枝 · 访客登记与形象工坊</div>
            <div class="reg-brand-sub">CULTIVATION & PRUNING · 种子大厅访客定制台</div>
          </div>
        </div>
        <div class="reg-step-pill">STEP 01 / 形象定制 · 访客电子通行证签发</div>
      </header>

      <div class="reg-stage-grid">
        <!-- Left Floating Panel: Outfits, Visual Decorations & Parts -->
        <aside class="reg-panel reg-left">
          <div class="reg-panel-head">
            <div>
              <div class="reg-eyebrow">CHARACTER ATELIER</div>
              <h3>角色与装饰定制</h3>
            </div>
            <span class="opt-pill">二级滑窗目录</span>
          </div>
          <div class="wardrobe-nav" data-role="left-nav"></div>
          <div class="reg-scroll" data-role="left-scroll"></div>
        </aside>

        <!-- Center Stage: Open Corridor Frame around Live Pixel Character -->
        <div class="reg-center">
          <div class="reg-center-plaque">
            <span class="plaque-live-dot"></span>
            <span data-role="center-title">夜幕漫游者 · 匿名旅人</span>
            <span class="plaque-acc-summary" data-role="center-accessories"></span>
          </div>

          <div class="reg-character-window" aria-hidden="true"></div>

          <div class="reg-preview-dock">
            <button type="button" class="reg-dock-btn" data-clip="idle">待机</button>
            <button type="button" class="reg-dock-btn" data-clip="walk">漫步</button>
            <button type="button" class="reg-dock-btn" data-clip="run">奔跑</button>
            <button type="button" class="reg-dock-btn" data-clip="jump">跳跃</button>
            <span class="dock-sep"></span>
            <button type="button" class="reg-dock-btn" data-action="flip">转身</button>
            <button type="button" class="reg-dock-btn accent" data-action="randomize">✦ 随机搭配</button>
          </div>
        </div>

        <!-- Right Floating Panel: Visitor Registration Form & Live Pass -->
        <aside class="reg-panel reg-right">
          <div class="reg-panel-head">
            <div>
              <div class="reg-eyebrow">VISITOR REGISTRY</div>
              <h3>访客资料登记</h3>
            </div>
            <span class="pass-id-badge">${this.profile.passId}</span>
          </div>

          <div class="reg-scroll reg-form-scroll">
            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label" for="reg-name-input">访客名称 <span class="opt-pill">展示于通行证</span></label>
                <button type="button" class="inline-mini-btn" data-action="random-name">✦ 随机雅号</button>
              </div>
              <input
                id="reg-name-input"
                type="text"
                class="reg-input"
                maxlength="20"
                placeholder="请输入您的称呼（留空默认旅人雅号）"
                value="${escapeHtml(this.profile.name)}"
              />
            </div>

            <div class="form-field">
              <div class="form-label-row">
                <span class="form-label">性别 <span class="opt-pill">可不透露</span></span>
              </div>
              <div class="reg-chip-row">${genderButtons}</div>
            </div>

            <div class="form-field">
              <div class="form-label-row">
                <span class="form-label">观展身份头衔</span>
              </div>
              <div class="reg-chip-row">${titleButtons}</div>
            </div>

            <div class="form-field">
              <div class="form-label-row">
                <span class="form-label">兴趣偏好 <span class="opt-pill">选填 · 可多选</span></span>
              </div>
              <div class="reg-chip-row">${tagButtons}</div>
            </div>

            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label" for="reg-bio-input">个人资料 <span class="opt-pill">选填</span></label>
                <span class="bio-counter" data-role="bio-count">0 / 120</span>
              </div>
              <textarea
                id="reg-bio-input"
                class="reg-textarea"
                rows="3"
                maxlength="120"
                placeholder="选填：写下个人简介、艺术偏好或今夜观展寄语..."
              >${escapeHtml(this.profile.bio)}</textarea>
            </div>

            <div class="visitor-pass-card" data-role="pass-preview"></div>
          </div>

          <div class="reg-right-footer">
            <button type="button" class="reg-submit-btn" data-action="submit-reg">
              <span>签发通行证 · 步入展厅</span>
              <span class="submit-arrow">→</span>
            </button>
          </div>
        </aside>
      </div>
    `

    this.leftNavEl = this.element.querySelector('[data-role="left-nav"]')!
    this.leftBodyEl = this.element.querySelector('[data-role="left-scroll"]')!
    this.centerTitleEl = this.element.querySelector('[data-role="center-title"]')!
    this.centerAccessoriesEl = this.element.querySelector('[data-role="center-accessories"]')!
    this.passPreviewEl = this.element.querySelector('[data-role="pass-preview"]')!
    this.nameInputEl = this.element.querySelector('#reg-name-input')!
    this.bioInputEl = this.element.querySelector('#reg-bio-input')!
    this.bioCountEl = this.element.querySelector('[data-role="bio-count"]')!

    this.syncRightControlsFromState()

    this.nameInputEl.addEventListener('input', () => {
      this.profile.name = this.nameInputEl.value
      this.syncProfileUi()
    })

    this.bioInputEl.addEventListener('input', () => {
      this.profile.bio = this.bioInputEl.value
      this.syncProfileUi()
    })

    this.element.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        '[data-wtab],[data-wsub],[data-clip],[data-action],[data-gender],[data-title],[data-tag]',
      )
      if (!target) return

      const wtab = target.dataset.wtab as WardrobePrimaryTab | undefined
      if (wtab) {
        this.primaryTab = wtab
        this.subTab = getDefaultSubmenuId(wtab)
        this.renderLeftBody()
        return
      }

      const wsub = target.dataset.wsub
      if (wsub) {
        this.subTab = wsub
        this.renderLeftBody({ preserveSubScroll: true, centerActiveSub: true })
        return
      }

      const clip = target.dataset.clip as 'idle' | 'walk' | 'run' | 'jump' | undefined
      if (clip) {
        this.callbacks.onPreviewAction(clip)
        return
      }

      const gender = target.dataset.gender as VisitorGenderId | undefined
      if (gender) {
        this.profile.gender = gender
        this.syncRightControlsFromState()
        this.syncProfileUi()
        return
      }

      const title = target.dataset.title
      if (title) {
        this.profile.title = title
        this.syncRightControlsFromState()
        this.syncProfileUi()
        return
      }

      const tag = target.dataset.tag
      if (tag) {
        if (this.profile.tags.includes(tag)) {
          this.profile.tags = this.profile.tags.filter((x) => x !== tag)
        } else {
          this.profile.tags = [...this.profile.tags, tag]
        }
        this.syncRightControlsFromState()
        this.syncProfileUi()
        return
      }

      const action = target.dataset.action
      if (action === 'flip') {
        this.callbacks.onFlipFacing()
      } else if (action === 'randomize') {
        void this.applyWardrobe(createRandomWardrobeSelection(true, this.wardrobe))
      } else if (action === 'random-name') {
        const candidates = RANDOM_NAMES.filter((n) => n !== this.profile.name.trim())
        const picked = candidates[Math.floor(Math.random() * candidates.length)] ?? RANDOM_NAMES[0]
        this.profile.name = picked
        this.nameInputEl.value = picked
        this.syncProfileUi()
      } else if (action === 'submit-reg') {
        this.submitRegistration()
      }
    })
  }

  private submitRegistration(): void {
    const cleanName = this.profile.name.trim() || RANDOM_NAMES[0]
    const completed: VisitorProfile = {
      ...this.profile,
      name: cleanName,
      bio: this.profile.bio.trim(),
      registeredAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }
    this.profile = completed
    this.nameInputEl.value = cleanName
    saveVisitorProfile(completed)
    this.callbacks.onComplete(structuredClone(completed))
  }

  private async applyWardrobe(next: WardrobeSelection): Promise<void> {
    if (this.busyWardrobe) return
    this.busyWardrobe = true
    const scrollTop = this.leftBodyEl.scrollTop
    const subScroll =
      this.leftNavEl.querySelector<HTMLElement>('[data-role="submenu-track"]')?.scrollLeft ?? 0
    this.wardrobe = structuredClone(next)
    this.renderLeftBody({ preserveSubScroll: true, customSubScrollLeft: subScroll })
    this.leftBodyEl.scrollTop = scrollTop
    this.syncProfileUi()
    try {
      await this.callbacks.onWardrobeChange(this.wardrobe)
    } finally {
      this.busyWardrobe = false
    }
  }

  private renderLeftBody(opts?: {
    preserveSubScroll?: boolean
    centerActiveSub?: boolean
    customSubScrollLeft?: number
  }): void {
    const prevTrack = this.leftNavEl.querySelector<HTMLElement>('[data-role="submenu-track"]')
    const prevScrollLeft = opts?.customSubScrollLeft ?? prevTrack?.scrollLeft ?? 0

    this.leftNavEl.innerHTML = renderWardrobeNavHtml(this.primaryTab, this.subTab)
    wireSubmenuSlider(this.leftNavEl)

    const nextTrack = this.leftNavEl.querySelector<HTMLElement>('[data-role="submenu-track"]')
    if (nextTrack && opts?.preserveSubScroll) {
      nextTrack.scrollLeft = prevScrollLeft
    }
    if (opts?.centerActiveSub) {
      const activeBtn = nextTrack?.querySelector<HTMLElement>('.submenu-pill.active')
      activeBtn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }

    this.leftBodyEl.innerHTML = renderWardrobeBodyContentHtml(
      this.pack,
      this.wardrobe,
      this.primaryTab,
      this.subTab,
    )

    this.leftBodyEl.querySelectorAll<HTMLElement>('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const found = WARDROBE_PRESETS.find((p) => p.id === btn.dataset.preset)
        if (found) {
          void this.applyWardrobe(applyPresetPreservingAccessories(found, this.wardrobe))
        }
      })
    })

    this.leftBodyEl.querySelectorAll<HTMLElement>('[data-slot]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.dataset.slot as keyof WardrobeSelection
        const val = btn.dataset.val as never
        const next = { ...this.wardrobe, [slot]: val }
        void this.applyWardrobe(next)
      })
    })
  }

  private syncRightControlsFromState(): void {
    this.nameInputEl.value = this.profile.name
    this.bioInputEl.value = this.profile.bio
    this.element.querySelectorAll<HTMLElement>('[data-gender]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.gender === this.profile.gender)
    })
    this.element.querySelectorAll<HTMLElement>('[data-title]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.title === this.profile.title)
    })
    this.element.querySelectorAll<HTMLElement>('[data-tag]').forEach((btn) => {
      btn.classList.toggle('active', this.profile.tags.includes(btn.dataset.tag ?? ''))
    })
  }

  private syncProfileUi(): void {
    const displayName = this.profile.name.trim() || '未命名旅人'
    const genderLabel =
      GENDER_OPTIONS.find((g) => g.id === this.profile.gender)?.label ?? '不透露'

    const accNames: string[] = []
    if (this.wardrobe.headwear !== 'none') {
      accNames.push(HEADWEAR_CHOICES.find((h) => h.id === this.wardrobe.headwear)?.name ?? '')
    }
    if (this.wardrobe.backgear !== 'none') {
      accNames.push(BACKGEAR_CHOICES.find((b) => b.id === this.wardrobe.backgear)?.name ?? '')
    }
    if (this.wardrobe.badge !== 'none') {
      accNames.push(BADGE_CHOICES.find((d) => d.id === this.wardrobe.badge)?.name ?? '')
    }
    const accSummary = accNames.length > 0 ? accNames.join(' · ') : '未选择饰品'

    this.centerTitleEl.textContent = `${this.profile.title} · ${displayName}`
    this.centerAccessoriesEl.textContent = accSummary
    this.bioCountEl.textContent = `${this.profile.bio.length} / 120`

    const tagsHtml =
      this.profile.tags.length > 0
        ? this.profile.tags.map((t) => `<span class="pass-tag"># ${escapeHtml(t)}</span>`).join('')
        : '<span class="pass-tag muted">自由漫游</span>'

    const bioText = this.profile.bio.trim()
      ? escapeHtml(this.profile.bio.trim())
      : '未填写个人资料 · 将以电子通行证直入展厅'

    this.passPreviewEl.innerHTML = `
      <div class="pass-card-top">
        <span class="pass-card-brand">CULTIVATION & PRUNING · E-PASS</span>
        <span class="pass-card-status">待签发</span>
      </div>
      <div class="pass-card-main">
        <div class="pass-card-name">${escapeHtml(displayName)}</div>
        <div class="pass-card-meta">
          <span>头衔：${escapeHtml(this.profile.title)}</span>
          <span>·</span>
          <span>性别：${genderLabel}</span>
        </div>
        <div class="pass-card-acc">装饰：${escapeHtml(accSummary)}</div>
        <div class="pass-card-bio">${bioText}</div>
        <div class="pass-card-tags">${tagsHtml}</div>
      </div>
    `
  }
}
