import './style.css'
import { Application } from 'pixi.js'
import { generateAllArtworks } from './scene/Artworks'
import {
  GalleryScene,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  WING_CENTERS,
} from './scene/GalleryScene'
import { HeroController } from './character/HeroController'
import { InteractionManager } from './interaction/InteractionManager'
import { GalleryHud } from './ui/GalleryHud'
import { WardrobePanel } from './ui/WardrobePanel'
import { loadVisitorProfile, RegistrationOverlay } from './ui/RegistrationOverlay'
import type { ActiveMode, CorridorWingId, Hotspot, VisitorProfile } from './types'

async function main() {
  const host = document.querySelector<HTMLElement>('#app')
  if (!host) throw new Error('Missing #app container')

  const loadingVeil = document.createElement('div')
  loadingVeil.className = 'loading-veil'
  loadingVeil.innerHTML = `
    <div class="loading-crest">◆</div>
    <div class="loading-title">栽培与剪枝 · CULTIVATION & PRUNING</div>
    <div class="loading-sub">正在构筑线上像素展厅与角色图层...</div>
  `

  const stageWrap = document.createElement('div')
  stageWrap.className = 'stage-wrap'
  host.append(stageWrap, loadingVeil)

  const app = new Application()
  await app.init({
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
    preference: 'webgl',
    antialias: false,
    background: '#05060a',
    resolution: 1,
  })
  stageWrap.appendChild(app.canvas)

  const fitCanvas = () => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const scale = Math.min(vw / SCENE_WIDTH, vh / SCENE_HEIGHT)
    // Snap down to integer factor if >= 2 and close, otherwise clean crisp 16:9 fill
    const w = Math.floor(SCENE_WIDTH * scale)
    const h = Math.floor(SCENE_HEIGHT * scale)
    app.canvas.style.width = `${w}px`
    app.canvas.style.height = `${h}px`
  }
  fitCanvas()
  window.addEventListener('resize', fitCanvas)

  const artworks = generateAllArtworks()
  const gallery = new GalleryScene(artworks)
  const hero = await HeroController.create()
  const interaction = new InteractionManager()

  gallery.depthSortedLayer.addChild(hero.characterRoot, hero.puffLayer)
  gallery.floorShadowLayer.addChild(hero.shadowRoot)
  gallery.benchShadowLayer.addChild(hero.benchShadowRoot)
  gallery.heroReflectionSlot.addChild(hero.reflectionView)
  app.stage.addChild(gallery.root)

  let mode: ActiveMode = 'register'
  let visitorProfile: VisitorProfile = loadVisitorProfile()
  let hasEnteredGallery = false

  const setMode = (nextMode: ActiveMode, hotspot: Hotspot | null = null) => {
    mode = nextMode
    hero.controlsLocked = nextMode !== 'explore'
    if (nextMode !== 'explore') hero.clearInputs()
    if (nextMode !== 'prologue') {
      hud.hidePrologueModal()
    }
    if (nextMode !== 'wardrobe' && wardrobePanel.isOpen()) {
      wardrobePanel.close()
    }
    if (nextMode !== 'register' && registrationOverlay.isOpen()) {
      registrationOverlay.closeWithFade()
    }
    gallery.setCameraFocus(nextMode, hotspot, hero.x)
  }

  const openPrologue = (spot: Hotspot | null = null) => {
    setMode('prologue', spot)
    hud.showPrologueModal(
      artworks.prologueTreeDataUrl,
      artworks.prologueBannerDataUrl,
      visitorProfile,
      gallery.isEntranceGateOpen(),
    )
  }

  const unlockGateAndExplore = () => {
    const wasOpen = gallery.isEntranceGateOpen()
    gallery.setEntranceGateOpen(true)
    setMode('explore')
    hero.playPreviewClip('idle')
    if (!wasOpen) {
      hud.showToast(`通行证 ${visitorProfile.passId} 已核验 · 初始栽培值 Credit +100 已激活 · 前方展厅闸门已开启`)
    } else {
      hud.showToast('已返回种子大厅 · 向右漫步即可进入后续展区')
    }
  }

  const toggleWardrobe = () => {
    if (mode === 'wardrobe') {
      setMode('explore')
      hero.playPreviewClip('idle')
    } else {
      setMode('wardrobe')
      wardrobePanel.open(hero.getWardrobe())
    }
  }

  const selectWing = (wing: CorridorWingId) => {
    if (mode !== 'explore') setMode('explore')
    gallery.stopPatrol()
    gallery.resetManualPan()
    const targetX = WING_CENTERS[wing]
    hero.facing = targetX >= hero.x ? 'right' : 'left'
    hero.actor.setFacing(hero.facing)
    hero.sitAt(targetX, 306, hero.facing)
    const wingNames: Record<CorridorWingId, string> = {
      entrance: '种子大厅',
      west: '机械苗圃',
      center: '修剪实验室',
      east: '影子温室',
    }
    hud.showToast(`镜头与角色已前往「${wingNames[wing]}」`)
  }

  const togglePatrol = () => {
    if (mode !== 'explore') setMode('explore')
    const active = gallery.togglePatrol()
    hud.showToast(
      active ? '已开启长廊自动巡礼镜头（移动角色或按 [P] 停止）' : '已结束长廊巡礼 · 镜头跟随角色',
    )
  }

  const openRegistration = () => {
    if (mode === 'register') return
    if (gallery.isPatrolActive()) togglePatrol()
    if (wardrobePanel.isOpen()) wardrobePanel.close()
    hud.setVisible(false)
    hero.sitAt(320, 296, 'right')
    hero.playPreviewClip('idle')
    gallery.setRegistrationBackdropVisible(true)
    registrationOverlay.open(hero.getWardrobe(), visitorProfile)
    setMode('register')
    gallery.snapCameraToFocus()
  }

  const hud = new GalleryHud({
    onToggleWardrobe: toggleWardrobe,
    onOpenRegistration: openRegistration,
    onOpenPrologue: () => {
      if (mode === 'prologue') {
        setMode('explore')
      } else {
        openPrologue()
      }
    },
    onClosePrologue: () => setMode('explore'),
    onUnlockGateAndExplore: unlockGateAndExplore,
    onToggleAlwaysRun: () => {
      hero.alwaysRun = !hero.alwaysRun
      hud.showToast(hero.alwaysRun ? '已开启常驻奔跑（按住 Shift 步行）' : '已切回步行模式（按住 Shift 奔跑）')
    },
    onSelectWing: selectWing,
    onTogglePatrol: togglePatrol,
  })

  const wardrobePanel = new WardrobePanel(hero.getPack(), hero.getWardrobe(), {
    onChange: async (next) => {
      await hero.setWardrobe(next)
    },
    onPreviewAction: (clipId) => {
      hero.playPreviewClip(clipId)
    },
    onFlipFacing: () => {
      hero.flipFacing()
    },
    onClose: () => {
      setMode('explore')
      hero.playPreviewClip('idle')
    },
  })

  const registrationOverlay = new RegistrationOverlay(hero.getPack(), hero.getWardrobe(), visitorProfile, {
    onWardrobeChange: async (next) => {
      await hero.setWardrobe(next)
    },
    onPreviewAction: (clipId) => {
      hero.playPreviewClip(clipId)
    },
    onFlipFacing: () => {
      hero.flipFacing()
    },
    onComplete: (profile) => {
      visitorProfile = profile
      hasEnteredGallery = true
      hud.setVisitorProfile(profile)
      registrationOverlay.closeWithFade()
      hero.sitAt(286, 282, 'right')
      hero.playPreviewClip('idle')
      gallery.setRegistrationBackdropVisible(false)
      gallery.playPostRegistrationSequence()
      setMode('explore')
      gallery.snapCameraToFocus()
      hud.setVisible(true)
      hud.showToast(`通行证 ${profile.passId} 已签发 · 身后大门缓缓合拢，前方闸机为您开启 · 欢迎 ${profile.name}`)
    },
  })

  host.append(hud.root, wardrobePanel.element, registrationOverlay.element)

  // Start directly on the blurred-corridor Visitor Registration showcase
  hero.sitAt(320, 296, 'right')
  hero.playPreviewClip('idle')
  gallery.setRegistrationBackdropVisible(true, true)
  setMode('register')
  gallery.snapCameraToFocus()
  hud.setVisible(false)
  hud.setVisitorProfile(visitorProfile)

  const triggerHotspot = (spot: Hotspot) => {
    if (spot.id === 'left_bench') {
      hero.sitAt(1438, 323, 'right')
      setMode('sit_bench', spot)
    } else if (spot.id === 'right_bench') {
      hero.sitAt(1762, 323, 'left')
      setMode('sit_bench', spot)
    } else if (spot.id === 'west_bench') {
      hero.sitAt(960, 323, 'right')
      setMode('sit_bench', spot)
    } else if (spot.id === 'east_bench') {
      hero.sitAt(2240, 323, 'left')
      setMode('sit_bench', spot)
    } else if (spot.id === 'entrance_reception' || spot.id === 'entrance_prologue_tree') {
      openPrologue(spot)
    } else if (spot.id === 'entrance_kiosk') {
      gallery.setEntranceGateOpen(true)
      hud.showToast(`通行证 ${visitorProfile.passId} 核验通过 · 初始栽培值 Credit +100 · 检票闸门已为您开启`)
    } else if (spot.id === 'wardrobe_mirror') {
      toggleWardrobe()
    }
  }

  const MOVEMENT_CODES = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Space',
    'KeyK',
    'KeyL',
  ])

  app.canvas.addEventListener(
    'wheel',
    (e) => {
      if (mode !== 'explore') return
      e.preventDefault()
      gallery.adjustUserZoom(e.deltaY < 0 ? 0.06 : -0.06)
    },
    { passive: false },
  )

  window.addEventListener('keydown', (e) => {
    const targetTag = (e.target as HTMLElement | null)?.tagName
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') {
      if (e.code === 'Escape') {
        ;(e.target as HTMLElement).blur()
      }
      return
    }

    if (
      e.repeat &&
      (e.code === 'KeyE' ||
        e.code === 'KeyC' ||
        e.code === 'KeyI' ||
        e.code === 'KeyU' ||
        e.code === 'KeyP' ||
        e.code === 'Enter' ||
        e.code === 'Escape')
    ) {
      return
    }
    if (e.code === 'Space' || e.code.startsWith('Arrow')) {
      e.preventDefault()
    }

    if (e.code === 'Escape') {
      if (mode === 'register') {
        if (hasEnteredGallery) {
          registrationOverlay.closeWithFade()
          hero.sitAt(286, 282, 'right')
          hero.playPreviewClip('idle')
          gallery.setRegistrationBackdropVisible(false)
          setMode('explore')
          gallery.snapCameraToFocus()
          hud.setVisible(true)
        }
        return
      }
      if (mode !== 'explore') {
        setMode('explore')
        hero.playPreviewClip('idle')
      } else if (gallery.isPatrolActive()) {
        togglePatrol()
      }
      return
    }

    if (mode === 'register') {
      return
    }

    if (mode === 'prologue' && e.code === 'Enter') {
      unlockGateAndExplore()
      return
    }

    if (e.code === 'KeyI') {
      if (mode === 'prologue') {
        setMode('explore')
      } else {
        openPrologue()
      }
      return
    }

    if (e.code === 'KeyU') {
      openRegistration()
      return
    }

    if (e.code === 'KeyC') {
      toggleWardrobe()
      return
    }

    if (e.code === 'KeyP') {
      togglePatrol()
      return
    }

    if (e.code === 'KeyQ' || e.code === 'BracketLeft') {
      gallery.adjustManualPan(-70)
      return
    }

    if (e.code === 'KeyR' || e.code === 'BracketRight') {
      gallery.adjustManualPan(70)
      return
    }

    if (e.code === 'Equal') {
      gallery.adjustUserZoom(0.08)
      return
    }

    if (e.code === 'Minus') {
      gallery.adjustUserZoom(-0.08)
      return
    }

    if (e.code === 'KeyE') {
      if (mode !== 'explore') {
        setMode('explore')
        hero.playPreviewClip('idle')
        return
      }
      const spot = interaction.getCurrentHotspot()
      if (spot) triggerHotspot(spot)
      return
    }

    if (MOVEMENT_CODES.has(e.code)) {
      if (mode === 'sit_bench') {
        setMode('explore')
      }
      gallery.stopPatrol()
      gallery.resetManualPan()
    }

    hero.onKeyDown(e.code)
  })

  window.addEventListener('keyup', (e) => {
    hero.onKeyUp(e.code)
  })

  window.addEventListener('blur', () => {
    hero.clearInputs()
  })

  app.ticker.add((ticker) => {
    const deltaMs = Math.min(50, ticker.deltaMS)
    const lightSample = gallery.sampleCharacterLightSample(hero.x, hero.floorY)
    hero.update(deltaMs, lightSample, gallery.isEntranceGatePassable())

    const telemetry = hero.getTelemetry()
    const nearest = mode === 'explore' ? interaction.findNearestHotspot(hero.x, hero.floorY) : null
    gallery.updateHotspotIndicator(nearest)
    gallery.update(deltaMs, app.renderer, mode, telemetry)

    const cam = gallery.getCameraState()
    const rect = app.canvas.getBoundingClientRect()
    hud.updatePromptPosition(nearest, mode, rect, cam.x, cam.y, cam.zoom)
    hud.syncState(
      mode,
      hero.alwaysRun,
      cam.wing,
      gallery.isPatrolActive(),
      telemetry,
    )
  })

  // Reveal scene smoothly
  requestAnimationFrame(() => {
    loadingVeil.classList.add('done')
    setTimeout(() => loadingVeil.remove(), 500)
  })
}

void main().catch((err) => {
  console.error(err)
  const appEl = document.querySelector('#app')
  if (appEl) {
    appEl.innerHTML = `<div style="padding:32px;color:#ffb4a2;font-family:monospace">启动失败: ${String(err)}</div>`
  }
})
