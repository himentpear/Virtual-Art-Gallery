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

    const meditative = mode === 'sit_bench'
    this.topBar.classList.toggle('dimmed', meditative)
    this.wingNav.classList.toggle('dimmed', meditative)
    this.bottomBar.classList.toggle('dimmed', meditative)
    this.sitBanner.classList.toggle('hidden', !meditative)
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

  public showPrologueModal(
    treeDataUrl: string,
    bannerDataUrl: string,
    profile: VisitorProfile,
    gateOpen: boolean,
  ): void {
    const visitorName = profile.name.trim() || '匿名旅人'
    this.prologueModalEl.innerHTML = `
      <div class="prologue-card">
        <aside class="prologue-visual-col">
          <div class="prologue-visual-frame">
            <img src="${treeDataUrl}" alt="生长中的算法树" class="prologue-tree-img" />
            <div class="prologue-visual-caption">
              <span>主视觉 · 《生长中的算法树》</span>
              <span class="caption-en">The Growing Algorithmic Tree</span>
            </div>
          </div>

          <div class="prologue-banner-card">
            <img src="${bannerDataUrl}" alt="从种子到花园演化图谱" class="prologue-banner-img" />
            <div class="prologue-banner-labels">
              <span>I. 播种</span>
              <span>II. 修剪</span>
              <span>III. 栽培</span>
              <span>IV. 开花</span>
            </div>
          </div>

          <div class="prologue-palette-legend">
            <div class="legend-title">展览视觉编码与色彩系统</div>
            <div class="legend-grid">
              <div class="legend-item">
                <span class="swatch" style="background:#f2c977"></span>
                <div><strong>暖黄 · 规则之种</strong><span>初始种子、最优解路径与互动提示</span></div>
              </div>
              <div class="legend-item">
                <span class="swatch" style="background:#6e987c"></span>
                <div><strong>灰绿 · 栽培生长</strong><span>可行状态扩展、关卡编辑与社区花园</span></div>
              </div>
              <div class="legend-item">
                <span class="swatch" style="background:#a83c32"></span>
                <div><strong>暗红 · 算法剪枝</strong><span>BFS 排除无效/重复状态与机械装置</span></div>
              </div>
              <div class="legend-item">
                <span class="swatch" style="background:#f4efe2;border-color:#261c16"></span>
                <div><strong>米白 × 墨黑 · 空间结构</strong><span>展签底衬、离散棋盘与影戏几何</span></div>
              </div>
            </div>
          </div>
        </aside>

        <section class="prologue-content-col">
          <div class="prologue-header">
            <div class="prologue-eyebrow">
              <span class="unit-badge">HALL 01 · 种子大厅 (A区 · 序章与展览导览)</span>
              <span class="credit-pill">通行证 ${profile.passId} · 初始栽培值 Credit +100</span>
            </div>
            <h2>栽培与剪枝：程序化生成到算法美学</h2>
            <div class="prologue-en">Cultivation &amp; Pruning: From Procedural Generation to Algorithmic Aesthetics</div>
          </div>

          <blockquote class="prologue-proposition">
            <div class="prop-label">核心策展命题 · CORE PROPOSITION</div>
            <p>“当算法能够自动生成和验证关卡时，谁来决定一个游戏是否值得被游玩？”</p>
            <div class="prop-pillars">
              <span>① 规则生成可能性</span>
              <span>② 算法验证可能性</span>
              <span>③ 人类赋予可能性以价值</span>
            </div>
          </blockquote>

          <div class="prologue-statement">
            <p>
              随着生成式技术与计算艺术的发展，算法已从辅助计算的工具演变为数字作品的生成机制。本展览以自主开发的两款 H5 益智游戏<strong>《咔哒！全体出发》</strong>（多主体同步控制）与<strong>《啪嗒！影子剧院》</strong>（空间投影与连锁消除）为媒介，将抽象的<strong>程序化生成（PCG）</strong>与<strong>广度优先搜索（BFS）</strong>转化为可观看、可游玩、可共同创作的互动艺术体验。
            </p>
          </div>

          <div class="prologue-dual-concepts">
            <div class="concept-box cultivate">
              <div class="concept-head">
                <span class="concept-dot"></span>
                <strong>栽培 · CULTIVATION</strong>
                <span class="concept-tag">规则 × 随机 × 创造力</span>
              </div>
              <p>程序化生成器依据规则孕育关卡初稿，观众借助关卡编辑器调整地图、机关与目标条件。<strong>每一关都是一颗具有生长可能性的种子。</strong></p>
            </div>
            <div class="concept-box prune">
              <div class="concept-head">
                <span class="concept-dot"></span>
                <strong>剪枝 · PRUNING</strong>
                <span class="concept-tag">计算筛选 × 审美判断</span>
              </div>
              <p>BFS 求解器排除重复或无解状态并计算最短通关路径；玩家社区则通过游玩、评分与反馈，在计算可行性之上作出<strong>人类审美与体验价值判断</strong>。</p>
            </div>
          </div>

          <div class="prologue-units">
            <div class="units-header">从种子到花园 · 四大展览单元动线</div>
            <div class="units-grid">
              <div class="unit-item">
                <span class="u-num">01 · 播种</span>
                <strong>机械苗圃 &amp; 影子温室</strong>
                <p>体验两款核心 H5 游戏，探索简单规则如何生成复杂策略空间。</p>
              </div>
              <div class="unit-item">
                <span class="u-num">02 · 修剪</span>
                <strong>修剪实验室</strong>
                <p>《可能性之树》BFS 状态空间展开与《算法剪枝台》自动验证。</p>
              </div>
              <div class="unit-item">
                <span class="u-num">03 · 栽培</span>
                <strong>关卡栽培台 &amp; 种子档案</strong>
                <p>自由创作或程序辅助生成原创关卡，生成可复现数字种子档案。</p>
              </div>
              <div class="unit-item">
                <span class="u-num">04 · 开花</span>
                <strong>公共关卡花园</strong>
                <p>社区游玩评分、主客观指标对照与《共同生长的美术馆》生成景观。</p>
              </div>
            </div>
          </div>

          <div class="prologue-footer">
            <div class="prologue-epigraph">
              <span>欢迎你，<strong>${visitorName}</strong>（${profile.title}）—— 规则赋予它生长的可能，算法修剪它的枝杈，而你决定它是否值得开花。</span>
            </div>
            <div class="prologue-actions">
              <button type="button" class="prologue-primary-btn" data-action="unlock-gate-explore">
                ${gateOpen ? '步入展厅 · 开始探索 [Enter]' : '核验通行证 · 开启展厅闸门 [Enter]'}
              </button>
              <button type="button" class="prologue-ghost-btn" data-action="close-prologue">
                留在本厅观览 [E / Esc]
              </button>
            </div>
          </div>
        </section>
      </div>
    `
    this.prologueModalEl.classList.remove('hidden')
  }

  public hidePrologueModal(): void {
    this.prologueModalEl.classList.add('hidden')
  }
}
