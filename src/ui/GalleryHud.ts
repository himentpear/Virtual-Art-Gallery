import type {
  ActiveMode,
  CorridorWingId,
  HeroTelemetry,
  Hotspot,
  VisitorProfile,
} from '../types'

export interface HudCallbacks {
  onToggleWardrobe: () => void
  onOpenRegistration: () => void
  onOpenPrologue: () => void
  onClosePrologue: () => void
  onUnlockGateAndExplore: () => void
  onToggleAlwaysRun: () => void
  onSelectWing: (wing: CorridorWingId) => void
  onTogglePatrol: () => void
}

export class GalleryHud {
  readonly root = document.createElement('div')
  private topBar: HTMLElement
  private wingNav: HTMLElement
  private bottomBar: HTMLElement
  private promptPill: HTMLElement
  private topPromptBanner: HTMLElement
  private topPromptTextEl: HTMLElement
  private prologueModalEl: HTMLElement
  private sitBanner: HTMLElement
  private toastEl: HTMLElement
  private runToggleBtn: HTMLButtonElement
  private patrolBtn: HTMLButtonElement
  private wingBtns: Record<CorridorWingId, HTMLButtonElement>
  private stateTagEl: HTMLElement
  private visitorChipEl: HTMLElement
  private topRevealZone: HTMLElement
  private callbacks: HudCallbacks
  private toastTimer?: number
  private topMenuHideTimer?: number
  private prologueTimers: number[] = []
  private prologueAwaitingContinue = false
  private topMenuVisible = true
  private isPointerInTopArea = false
  private lastPromptHotspotId: string | null = null
  private promptTypeStartMs = 0

  constructor(callbacks: HudCallbacks) {
    this.callbacks = callbacks
    this.root.className = 'hud-overlay'
    this.root.innerHTML = `
      <div class="top-reveal-zone" data-role="top-reveal-zone" title="移动鼠标至顶部显示菜单">
        <span class="top-reveal-pill">◆ 菜单</span>
      </div>
      <header class="hud-topbar">
        <div class="hud-brand">
          <div class="brand-crest">◆</div>
          <div>
            <div class="brand-title">栽培与剪枝 · CULTIVATION & PRUNING</div>
            <div class="brand-sub">算法美学线上互动展厅</div>
          </div>
        </div>
        <div class="hud-actions">
          <span class="visitor-chip" data-role="visitor-chip" title="已签发电子通行证">访客 · 未登记</span>
          <span class="state-chip" data-role="hero-state">待机 · IDLE</span>
          <button class="hud-btn" data-action="open-prologue" title="查看第一展厅序章导言与主视觉 [I]">序章导言 [I]</button>
          <button class="hud-btn" data-action="open-register" title="打开访客登记与形象定制 [U]">访客登记 [U]</button>
          <button class="hud-btn" data-action="toggle-run" title="切换常驻奔跑/行走">步行模式</button>
          <button class="hud-btn gold" data-action="toggle-wardrobe" title="打开幻装衣橱 [C]">幻装衣橱 [C]</button>
        </div>
      </header>

      <nav class="wing-nav" aria-label="展厅长廊分区与运镜">
        <button class="wing-pill" data-action="wing-entrance">种子大厅</button>
        <button class="wing-pill" data-action="wing-west">机械苗圃</button>
        <button class="wing-pill active" data-action="wing-center">修剪实验室</button>
        <button class="wing-pill" data-action="wing-east">影子温室</button>
        <span class="wing-divider"></span>
        <button class="wing-pill" data-action="toggle-patrol" title="长廊自动巡礼镜头 [P]">长廊巡礼 [P]</button>
      </nav>

      <div class="top-prompt-banner hidden" data-role="top-prompt-banner">
        <span class="top-prompt-ornament" aria-hidden="true"></span>
        <span class="top-prompt-text" data-role="top-prompt-text"></span>
        <span class="top-prompt-ornament" aria-hidden="true"></span>
      </div>

      <div class="world-prompt hidden" data-role="prompt-pill">
        <span class="prompt-key">E</span>
      </div>

      <div class="prologue-modal hidden" data-role="prologue-modal"></div>

      <div class="sit-banner hidden" data-role="sit-banner">
        <span>静坐观展中 · 沉浸感受像素光影与地面倒影</span>
        <span class="sit-hint">按 [E] 或任意移动键起身</span>
      </div>

      <div class="hud-toast hidden" data-role="toast"></div>

      <footer class="hud-bottombar">
        <div class="key-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 漫步</div>
        <div class="key-hint"><kbd>Shift</kbd> 奔跑</div>
        <div class="key-hint"><kbd>Space</kbd> 跳跃</div>
        <div class="key-hint"><kbd>K</kbd> 冲刺 · <kbd>L</kbd> 滑铲</div>
        <div class="key-hint"><kbd>Q</kbd><kbd>R</kbd> 移镜 · <kbd>P</kbd> 巡礼 · <kbd>滚轮</kbd> 缩放</div>
        <div class="key-hint"><kbd>E</kbd> 互动 · <kbd>I</kbd> 导言 · <kbd>C</kbd> 换装</div>
      </footer>
    `

    this.topBar = this.root.querySelector('.hud-topbar')!
    this.wingNav = this.root.querySelector('.wing-nav')!
    this.bottomBar = this.root.querySelector('.hud-bottombar')!
    this.promptPill = this.root.querySelector('[data-role="prompt-pill"]')!
    this.topPromptBanner = this.root.querySelector('[data-role="top-prompt-banner"]')!
    this.topPromptTextEl = this.root.querySelector('[data-role="top-prompt-text"]')!
    this.prologueModalEl = this.root.querySelector('[data-role="prologue-modal"]')!
    this.sitBanner = this.root.querySelector('[data-role="sit-banner"]')!
    this.toastEl = this.root.querySelector('[data-role="toast"]')!
    this.runToggleBtn = this.root.querySelector('[data-action="toggle-run"]')!
    this.patrolBtn = this.root.querySelector('[data-action="toggle-patrol"]')!
    this.wingBtns = {
      entrance: this.root.querySelector('[data-action="wing-entrance"]')!,
      west: this.root.querySelector('[data-action="wing-west"]')!,
      center: this.root.querySelector('[data-action="wing-center"]')!,
      east: this.root.querySelector('[data-action="wing-east"]')!,
    }
    this.stateTagEl = this.root.querySelector('[data-role="hero-state"]')!
    this.visitorChipEl = this.root.querySelector('[data-role="visitor-chip"]')!
    this.topRevealZone = this.root.querySelector('[data-role="top-reveal-zone"]')!

    this.setupTopMenuAutoHide()

    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')
      if (!btn) return
      const act = btn.dataset.action
      if (act === 'toggle-wardrobe') this.callbacks.onToggleWardrobe()
      else if (act === 'open-register') this.callbacks.onOpenRegistration()
      else if (act === 'open-prologue') this.callbacks.onOpenPrologue()
      else if (act === 'close-prologue') this.callbacks.onClosePrologue()
      else if (act === 'unlock-gate-explore') this.callbacks.onUnlockGateAndExplore()
      else if (act === 'toggle-run') this.callbacks.onToggleAlwaysRun()
      else if (act === 'toggle-patrol') this.callbacks.onTogglePatrol()
      else if (act === 'wing-entrance') this.callbacks.onSelectWing('entrance')
      else if (act === 'wing-west') this.callbacks.onSelectWing('west')
      else if (act === 'wing-center') this.callbacks.onSelectWing('center')
      else if (act === 'wing-east') this.callbacks.onSelectWing('east')
    })
  }

  private setupTopMenuAutoHide(): void {
    const showTopMenu = () => {
      if (this.topMenuHideTimer) {
        window.clearTimeout(this.topMenuHideTimer)
        this.topMenuHideTimer = undefined
      }
      if (!this.topMenuVisible) {
        this.topMenuVisible = true
        this.root.classList.remove('top-menu-hidden')
      }
    }

    const scheduleHideTopMenu = (delayMs = 1400) => {
      if (this.topMenuHideTimer) window.clearTimeout(this.topMenuHideTimer)
      this.topMenuHideTimer = window.setTimeout(() => {
        if (this.isPointerInTopArea) return
        this.topMenuVisible = false
        this.root.classList.add('top-menu-hidden')
      }, delayMs)
    }

    window.addEventListener('mousemove', (e) => {
      const inTopZone = e.clientY <= 116
      if (inTopZone) {
        this.isPointerInTopArea = true
        showTopMenu()
      } else if (this.isPointerInTopArea) {
        this.isPointerInTopArea = false
        scheduleHideTopMenu(1100)
      }
    })

    window.addEventListener('mouseleave', () => {
      this.isPointerInTopArea = false
      scheduleHideTopMenu(900)
    })

    const onMenuEnter = () => {
      this.isPointerInTopArea = true
      showTopMenu()
    }
    const onMenuLeave = () => {
      this.isPointerInTopArea = false
      scheduleHideTopMenu(1100)
    }

    this.topBar.addEventListener('mouseenter', onMenuEnter)
    this.topBar.addEventListener('mouseleave', onMenuLeave)
    this.wingNav.addEventListener('mouseenter', onMenuEnter)
    this.wingNav.addEventListener('mouseleave', onMenuLeave)
    this.topRevealZone.addEventListener('mouseenter', onMenuEnter)
    this.topRevealZone.addEventListener('click', onMenuEnter)

    // Initially keep top menu visible briefly, then auto-hide
    scheduleHideTopMenu(2600)
  }

  public setVisible(visible: boolean): void {
    this.root.classList.toggle('hud-hidden', !visible)
    if (visible) {
      this.topMenuVisible = true
      this.root.classList.remove('top-menu-hidden')
      if (this.topMenuHideTimer) window.clearTimeout(this.topMenuHideTimer)
      this.topMenuHideTimer = window.setTimeout(() => {
        if (!this.isPointerInTopArea) {
          this.topMenuVisible = false
          this.root.classList.add('top-menu-hidden')
        }
      }, 2600)
    }
  }

  public setVisitorProfile(profile: VisitorProfile): void {
    const label = profile.name.trim() || '匿名旅人'
    this.visitorChipEl.textContent = `${profile.title} · ${label}`
    this.visitorChipEl.title = `通行证 ${profile.passId}${profile.bio ? `\n${profile.bio}` : ''}`
  }

  public showToast(msg: string): void {
    this.toastEl.textContent = msg
    this.toastEl.classList.remove('hidden')
    if (this.toastTimer) window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.add('hidden')
    }, 2400)
  }

  public syncState(
    mode: ActiveMode,
    alwaysRun: boolean,
    currentWing: CorridorWingId,
    patrolActive: boolean,
    telemetry: HeroTelemetry,
  ): void {
    this.runToggleBtn.classList.toggle('active', alwaysRun)
    this.runToggleBtn.textContent = alwaysRun ? '常驻奔跑' : '步行模式'

    this.wingBtns.entrance.classList.toggle('active', currentWing === 'entrance')
    this.wingBtns.west.classList.toggle('active', currentWing === 'west')
    this.wingBtns.center.classList.toggle('active', currentWing === 'center')
    this.wingBtns.east.classList.toggle('active', currentWing === 'east')
    this.patrolBtn.classList.toggle('active', patrolActive)
    this.patrolBtn.textContent = patrolActive ? '巡礼中 · 停止 [P]' : '长廊巡礼 [P]'

    const clipNames: Record<string, string> = {
      idle: '待机',
      idle_turn: '转身',
      walk: '漫步',
      walk_turn: '折返',
      run: '奔跑',
      run_turn: '疾转',
      run_to_idle: '急停',
      jump: '跃起',
      fall: '下落',
      fall_loop: '滞空',
      dash: '冲刺',
      slide: '滑铲',
    }
    const clipLabel = `${clipNames[telemetry.clipId] ?? telemetry.clipId} · ${telemetry.facing === 'right' ? '右向' : '左向'}`
    this.stateTagEl.textContent = telemetry.isBacklit ? `${clipLabel} · 柔光散射` : clipLabel
    this.stateTagEl.classList.toggle('backlit', Boolean(telemetry.isBacklit))

    const meditative = mode === 'sit_bench' || mode === 'prologue'
    this.root.classList.toggle('immersive-prologue', mode === 'prologue')
    this.topBar.classList.toggle('dimmed', meditative)
    this.wingNav.classList.toggle('dimmed', meditative)
    this.bottomBar.classList.toggle('dimmed', meditative)
    this.sitBanner.classList.toggle('hidden', mode !== 'sit_bench')
  }

  public updatePromptPosition(
    hotspot: Hotspot | null,
    mode: ActiveMode,
    canvasRect: DOMRect,
    cameraX: number,
    cameraY: number,
    cameraZoom: number,
  ): void {
    if (!hotspot || mode !== 'explore') {
      this.promptPill.classList.add('hidden')
      this.topPromptBanner.classList.add('hidden')
      this.lastPromptHotspotId = null
      return
    }
    const now = performance.now()
    if (this.lastPromptHotspotId !== hotspot.id) {
      this.lastPromptHotspotId = hotspot.id
      this.promptTypeStartMs = now
    }

    this.promptPill.classList.remove('hidden')
    this.topPromptBanner.classList.remove('hidden')

    const fullText = `${hotspot.promptText.replace('[E] ', '')} · ${hotspot.label}`
    const elapsed = Math.max(0, now - this.promptTypeStartMs)
    const charCount = Math.min(fullText.length, Math.floor(elapsed / 32) + 1)
    const isTyping = charCount < fullText.length
    this.topPromptTextEl.textContent = fullText.slice(0, charCount)
    this.topPromptTextEl.classList.toggle('typing', isTyping)

    const sx = (hotspot.x - cameraX) * cameraZoom + 320
    const sy = (hotspot.hintY - cameraY) * cameraZoom + 180
    const cssX = canvasRect.left + (sx / 640) * canvasRect.width
    const cssY = canvasRect.top + (sy / 360) * canvasRect.height
    this.promptPill.style.left = `${Math.round(cssX)}px`
    this.promptPill.style.top = `${Math.round(cssY - 6)}px`
  }

  private clearPrologueTimers(): void {
    for (const id of this.prologueTimers) {
      window.clearTimeout(id)
    }
    this.prologueTimers = []
  }

  public isPrologueAwaitingContinue(): boolean {
    return this.prologueAwaitingContinue
  }

  public showPrologueModal(
    _treeDataUrl: string,
    _bannerDataUrl: string,
    profile: VisitorProfile,
    _gateOpen: boolean,
  ): void {
    this.clearPrologueTimers()
    this.prologueAwaitingContinue = false
    const visitorName = profile.name.trim() || '旅人'

    this.prologueModalEl.innerHTML = `
      <div class="prologue-floating-stage" data-role="prologue-stage">
        <div class="prologue-floating-poem">
          <div class="pf-title-block pf-beat" data-beat="0">
            <div class="pf-eyebrow">序章 · 栽培与剪枝</div>
            <h2>未眠的枝桠</h2>
            <div class="pf-sub">Cultivation &amp; Pruning · 算法美学序言</div>
          </div>

          <p class="pf-line pf-lead pf-beat" data-beat="1">
            凌晨四点醒来，看见计算的荒原上，有一粒种子尚未眠去。
          </p>

          <p class="pf-line pf-beat" data-beat="2">
            规则不过是几行沉默的刻度——左与右，进与退，光与影的投射。然而当第一声“咔哒”在寂静中响起，万千条可能的枝桠便在黑暗里悄然抽芽。
          </p>

          <p class="pf-line pf-beat" data-beat="3">
            机器是不知疲倦的园丁。它沿着每一条分叉摸索，在没有出口的迷途上轻轻落剪。那些被剪去的枝条并未真正消失，它们化作树冠间安静的留白，让唯一通向终点的光亮得以浮现。
          </p>

          <p class="pf-line pf-question pf-beat" data-beat="4">
            可是，一条走得通的路，便值得长久地驻足吗？
          </p>

          <p class="pf-line pf-beat" data-beat="5">
            纸偶的影子在幕布上交叠又离散，发条的脚步在方格间叩问回音。算法能丈量最短的步数，却无法替一次偶遇的心动命名。
          </p>

          <p class="pf-line pf-coda pf-beat" data-beat="6">
            每一关都是一粒微小的种子。<br />
            规则予它生长的形骸，算法修剪它繁芜的歧路；<br />
            唯有当你俯身走入其中，那些原本冰冷的节点，才会在人类的凝视里，开出第一朵花。
          </p>

          <div class="pf-dedication pf-beat" data-beat="7">
            <span>致驻足者 ${visitorName} · ${profile.passId}</span>
            <span class="pf-progress-bar"><i></i></span>
          </div>

          <div class="pf-continue-prompt" data-role="prologue-continue">
            <span class="pf-caret">▸</span>
            <span>按任意键或点击屏幕继续 · 回正镜头</span>
          </div>
        </div>

        <button type="button" class="pf-skip-hint" data-action="unlock-gate-explore">
          [E / Esc / Enter] 跳过序章
        </button>
      </div>
    `

    this.prologueModalEl.classList.remove('hidden')
    const stageEl = this.prologueModalEl.querySelector<HTMLElement>('[data-role="prologue-stage"]')
    const beats = Array.from(this.prologueModalEl.querySelectorAll<HTMLElement>('.pf-beat'))
    const scheduleMs = [450, 1400, 3400, 5800, 8200, 10100, 12100, 13200]

    beats.forEach((el, idx) => {
      const delay = scheduleMs[idx] ?? idx * 1800
      const tid = window.setTimeout(() => {
        el.classList.add('visible')
      }, delay)
      this.prologueTimers.push(tid)
    })

    // Once all lines are displayed, pause in an "awaiting any key / click to continue" state
    this.prologueTimers.push(
      window.setTimeout(() => {
        this.prologueAwaitingContinue = true
        stageEl?.classList.add('ready-to-continue')
      }, 14200),
    )

    stageEl?.addEventListener('click', (e) => {
      if (!this.prologueAwaitingContinue) return
      if ((e.target as HTMLElement).closest('[data-action="unlock-gate-explore"]')) return
      this.callbacks.onUnlockGateAndExplore()
    })
  }

  public hidePrologueModal(): void {
    this.clearPrologueTimers()
    this.prologueAwaitingContinue = false
    this.prologueModalEl.classList.add('hidden')
    this.prologueModalEl.innerHTML = ''
  }
}
