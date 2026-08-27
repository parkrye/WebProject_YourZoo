import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FENCE_OFFSET_DETAIL, FENCE_OFFSET_ZOO, GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH, ROAM_BOX,
  type BiomeId,
} from '@/assets/manifest'
import { audio } from '@/audio/AudioManager'
import { startTicker } from '@/core/ticker'
import { UNLOCK_COST } from '@/domain/balance'
import { clockLabel, phaseOf } from '@/domain/clock'
import { ENCLOSURE_ORDER, ENCLOSURES } from '@/domain/enclosure'
import { SceneRenderer, type EnclosureTransition } from '@/render/SceneRenderer'
import {
  clampCamera, createCamera, MIN_ZOOM, panCamera, screenToScene, zoomStep, type Camera,
} from '@/render/camera'
import { EnclosureSim } from '@/sim/EnclosureSim'
import { useGameStore } from '@/store/gameStore'
import { AnimalThumb } from '@/ui/components/AnimalThumb'
import { BarButton } from '@/ui/components/BarButton'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { AnimalCard } from '@/ui/panels/AnimalCard'
import { StorageTray, type DragState } from '@/ui/panels/StorageTray'
import { TutorialOverlay } from '@/ui/panels/TutorialOverlay'
import { TUTORIAL_HINTS } from '@/domain/tutorial'

interface ZooScreenProps {
  detail: boolean
}

type DetailTool = 'CURSOR' | 'PAN'

/** 펜스 하강/상승 트윈 속도. 값이 클수록 빨리 붙는다. */
const FENCE_TWEEN_RESPONSE = 6
const DRAG_GHOST_SIZE = 96
/** 우리를 넘길 때 옆으로 미는 시간(초). */
const SLIDE_DURATION = 0.42

export function ZooScreen({ detail }: ZooScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderer = useMemo(() => new SceneRenderer(), [])
  const fenceRef = useRef(detail ? FENCE_OFFSET_DETAIL : FENCE_OFFSET_ZOO)

  // 카메라는 드래그 중 매 프레임 읽히므로 ref 가 진짜 소유자다.
  // state 는 버튼 활성화 표시를 위한 사본일 뿐이다.
  const cameraRef = useRef<Camera>(createCamera())
  const [camera, setCamera] = useState<Camera>(cameraRef.current)
  const [tool, setTool] = useState<DetailTool>('CURSOR')
  const panRef = useRef<{ x: number; y: number } | null>(null)

  const [trayOpen, setTrayOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  const transitionRef = useRef<EnclosureTransition | null>(null)

  // 우리 3개를 모두 유지하며 계속 시뮬레이션한다. 넘겼다 돌아왔을 때 얼어 있으면 어색하다.
  const sims = useMemo(() => {
    const map = new Map<BiomeId, EnclosureSim>()
    for (const id of ENCLOSURE_ORDER) map.set(id, new EnclosureSim(id))
    return map
  }, [])

  const setScreen = useGameStore((s) => s.setScreen)
  const openModal = useGameStore((s) => s.openModal)
  const moveEnclosure = useGameStore((s) => s.moveEnclosure)
  const unlockEnclosure = useGameStore((s) => s.unlockEnclosure)
  const placeAnimal = useGameStore((s) => s.placeAnimal)
  const storeAnimal = useGameStore((s) => s.storeAnimal)
  const sellAnimal = useGameStore((s) => s.sellAnimal)
  const canPlaceIn = useGameStore((s) => s.canPlaceIn)
  const modal = useGameStore((s) => s.modal)
  const tutorial = useGameStore((s) => s.tutorial)
  const advanceTutorial = useGameStore((s) => s.advanceTutorial)
  const skipTutorial = useGameStore((s) => s.skipTutorial)
  const enclosure = useGameStore((s) => s.currentEnclosure)
  const unlocked = useGameStore((s) => s.unlocked)
  const gold = useGameStore((s) => s.gold)
  const animals = useGameStore((s) => s.animals)
  const day = useGameStore((s) => s.clock.day)
  const elapsed = useGameStore((s) => s.clock.elapsed)

  const isOpen = unlocked.includes(enclosure)
  const stored = useMemo(() => animals.filter((a) => a.status === 'STORED'), [animals])
  const shippingCount = useMemo(() => animals.filter((a) => a.status === 'SHIPPING').length, [animals])
  const selected = useMemo(
    () => animals.find((a) => a.id === selectedId) ?? null,
    [animals, selectedId],
  )

  const select = useCallback((id: string | null) => {
    selectedIdRef.current = id
    setSelectedId(id)
  }, [])

  const applyCameraState = useCallback((next: Camera) => {
    cameraRef.current = next
    setCamera(next)
  }, [])

  // 상세보기를 벗어나면 카메라·선택·트레이를 원위치시킨다.
  useEffect(() => {
    if (detail) return
    applyCameraState(createCamera())
    setTool('CURSOR')
    select(null)
  }, [detail, applyCameraState, select])

  useEffect(() => {
    for (const sim of sims.values()) sim.syncAnimals(animals)
  }, [animals, sims])

  useEffect(() => {
    if (!dropError) return
    const timer = window.setTimeout(() => setDropError(null), 1800)
    return () => window.clearTimeout(timer)
  }, [dropError])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const targetFence = detail ? FENCE_OFFSET_DETAIL : FENCE_OFFSET_ZOO

    return startTicker({
      fixedUpdate: (step) => {
        const store = useGameStore.getState()
        store.tickClock(step)
        // 정산 팝업이 떠 있는 동안에는 화면도 멈춰 있어야 결과를 읽기 편하다.
        if (store.modal === 'REPORT' || store.isDrawing) return

        const phase = phaseOf(store.clock.elapsed)
        for (const [id, sim] of sims) {
          sim.update(step, {
            reputation: store.reputation,
            phase,
            active: id === store.currentEnclosure,
          })
        }

        fenceRef.current += (targetFence - fenceRef.current) * Math.min(1, step * FENCE_TWEEN_RESPONSE)

        const transition = transitionRef.current
        if (transition) {
          transition.progress += step / SLIDE_DURATION
          if (transition.progress >= 1) transitionRef.current = null
        }
      },
      render: () => {
        const store = useGameStore.getState()
        const sim = sims.get(store.currentEnclosure)
        if (!sim) return
        renderer.draw(ctx, {
          sim,
          elapsed: store.clock.elapsed,
          fenceOffset: fenceRef.current,
          camera: cameraRef.current,
          selectedId: selectedIdRef.current,
          transition: transitionRef.current,
        })
      },
    })
  }, [detail, renderer, sims])

  /** 뷰포트 좌표를 씬의 정규화 좌표로 바꾼다. Stage 의 CSS 축소를 되돌려야 한다. */
  const toScene = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null
    }
    const scale = LOGICAL_WIDTH / rect.width
    return screenToScene(
      cameraRef.current,
      (clientX - rect.left) * scale,
      (clientY - rect.top) * scale,
      LOGICAL_WIDTH,
      LOGICAL_HEIGHT,
    )
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.button !== 0) return
    if (!detail) return

    if (tool === 'PAN') {
      event.currentTarget.setPointerCapture(event.pointerId)
      panRef.current = { x: event.clientX, y: event.clientY }
      return
    }

    const scene = toScene(event.clientX, event.clientY)
    const sim = sims.get(enclosure)
    if (!scene || !sim) return
    const picked = sim.pickAnimal(scene.x, scene.y)
    select(picked?.id ?? null)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const origin = panRef.current
    if (!origin) return

    const rect = event.currentTarget.getBoundingClientRect()
    const scale = LOGICAL_WIDTH / rect.width

    applyCameraState(
      panCamera(
        cameraRef.current,
        (event.clientX - origin.x) * scale,
        (event.clientY - origin.y) * scale,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
      ),
    )
    panRef.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    panRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  /** 창고에서 끌어온 동물을 우리에 내려놓는다. 서식지와 정원을 함께 본다. */
  /** 좌우 전환. 스토어를 바꾸기 전에 나가는 우리를 붙잡아 슬라이드를 시작한다. */
  const slideTo = (direction: 1 | -1): void => {
    if (transitionRef.current) return
    const from = sims.get(enclosure)
    if (from) transitionRef.current = { from, direction, progress: 0 }
    select(null)
    moveEnclosure(direction)
  }

  const handleDrop = (state: DragState): void => {
    setDrag(null)

    const scene = toScene(state.clientX, state.clientY)
    if (!scene) return

    const box = ROAM_BOX[state.animal.traits.habitat]
    const inside =
      scene.x >= box.x0 && scene.x <= box.x1 && scene.y >= box.y0 && scene.y <= box.y1
    if (!inside) {
      audio.playSting('DENY')
      setDropError(`DROP IN ${state.animal.traits.habitat} AREA`)
      return
    }

    if (!canPlaceIn(enclosure)) {
      audio.playSting('DENY')
      setDropError('ENCLOSURE IS FULL')
      return
    }

    // 스토어가 갱신되면 EnclosureSim 이 새 에이전트를 만든다. 그 전에 시작 위치를 알려 둔다.
    sims.get(enclosure)?.setSpawnHint(state.animal.id, scene.x, scene.y)
    if (placeAnimal(state.animal.id, enclosure)) select(state.animal.id)
  }

  const time = clockLabel(elapsed)
  const here = animals.filter((a) => a.status === 'PLACED' && a.enclosureId === enclosure).length
  const canPan = detail && tool === 'PAN'

  return (
    <div className="screen">
      <canvas
        ref={canvasRef}
        width={LOGICAL_WIDTH}
        height={LOGICAL_HEIGHT}
        className={canPan ? 'screen-canvas is-pannable' : 'screen-canvas'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {tutorial !== 'DONE' && (
        <TutorialOverlay hint={TUTORIAL_HINTS[tutorial]} onSkip={skipTutorial} />
      )}

      {!isOpen && !modal && (
        <LockedOverlay id={enclosure} gold={gold} onUnlock={() => unlockEnclosure(enclosure)} />
      )}

      {/*
        팝업이 떠 있는 동안에는 HUD 를 통째로 감춘다.
        아래에서 버튼과 바가 비쳐 보이면 무엇을 눌러야 할지 헷갈리고,
        실제로 우리 이동 화살표가 팝업 옆에서 활성인 채로 남아 있었다.
      */}
      {!modal && (
        <>
          <div className="hud-top-left">
            <BitmapLabel text={`DAY ${day}`} size={34} />
            <BitmapLabel text={`${time.hh} ${time.mm}`} size={34} />
          </div>

          <div className="hud-enclosure-name">
            <BitmapLabel text={ENCLOSURES[enclosure].label} size={38} align="center" />
            <BitmapLabel text={isOpen ? `ANIMALS ${here}` : 'LOCKED'} size={22} align="center" />
          </div>

          <div className="hud-arrow hud-arrow-left">
            <IconButton icon={GUI.BACK} size={72} title="PREV" onClick={() => slideTo(-1)} />
          </div>
          <div className="hud-arrow hud-arrow-right">
            <IconButton icon={GUI.BACK} size={72} title="NEXT" onClick={() => slideTo(1)} />
          </div>

          {dropError && (
            <div className="drop-error">
              <BitmapLabel text={dropError} size={28} align="center" />
            </div>
          )}

          {selected && (
            <AnimalCard
              animal={selected}
              onClose={() => select(null)}
              {...(selected.status === 'PLACED' && {
                onStore: () => {
                  storeAnimal(selected.id)
                  select(null)
                },
              })}
              {...(selected.status === 'STORED' && {
                onSell: () => {
                  sellAnimal(selected.id)
                  select(null)
                },
              })}
            />
          )}

          {trayOpen && (
            <StorageTray
              stored={stored}
              shippingCount={shippingCount}
              onSelect={(animal) => select(animal.id)}
              onDragStart={setDrag}
              onDragMove={setDrag}
              onDragEnd={handleDrop}
              onClose={() => setTrayOpen(false)}
            />
          )}

          {drag && (
            <div
              className="drag-ghost"
              style={{ left: drag.clientX - DRAG_GHOST_SIZE / 2, top: drag.clientY - DRAG_GHOST_SIZE / 2 }}
            >
              <AnimalThumb imageId={drag.animal.imageId} size={DRAG_GHOST_SIZE} />
            </div>
          )}

          <div className="hud-bottom-bar">
            {detail ? (
              <>
                <BarButton icon={GUI.BACK} label="BACK" onClick={() => setScreen('ZOO')} />
                <BarButton
                  icon={GUI.CURSOR}
                  label="SELECT"
                  active={tool === 'CURSOR'}
                  onClick={() => setTool('CURSOR')}
                />
                <BarButton icon={GUI.HAND} label="PAN" active={tool === 'PAN'} onClick={() => setTool('PAN')} />
                <BarButton
                  icon={GUI.ZOOM_IN}
                  label="ZOOM IN"
                  onClick={() => applyCameraState(zoomStep(cameraRef.current, 1))}
                />
                <BarButton
                  icon={GUI.ZOOM_OUT}
                  label="ZOOM OUT"
                  disabled={camera.zoom <= MIN_ZOOM}
                  onClick={() => applyCameraState(clampCamera(zoomStep(cameraRef.current, -1)))}
                />
              </>
            ) : (
              <BarButton icon={GUI.BINOCULARS} label="INSPECT" disabled={!isOpen} onClick={() => setScreen('ZOO_DETAIL')} />
            )}

            <div className="bar-spacer" />

            <BarButton
              icon={GUI.SCROLL}
              label="REQUEST"
              data-tutorial="request"
              onClick={() => {
                advanceTutorial('ORDER', 'DRAW')
                openModal('REQUEST')
              }}
            />
            <BarButton
              icon={GUI.BOOK}
              label="STORAGE"
              data-tutorial="storage"
              active={trayOpen}
              onClick={() => {
                advanceTutorial('STORAGE', 'PLACE')
                setTrayOpen((open) => !open)
              }}
            />
            <BarButton icon={GUI.INFO} label="STATUS" onClick={() => openModal('STATUS')} />
            <BarButton icon={GUI.SETTINGS} label="OPTIONS" onClick={() => openModal('OPTIONS')} />
          </div>
        </>
      )}
    </div>
  )
}

interface LockedOverlayProps {
  id: BiomeId
  gold: number
  onUnlock: () => void
}

function LockedOverlay({ id, gold, onUnlock }: LockedOverlayProps) {
  const cost = UNLOCK_COST[id]
  const affordable = gold >= cost

  return (
    <div className="locked-overlay">
      <BitmapLabel text="LOCKED" size={64} align="center" />
      <BitmapLabel text={`UNLOCK FOR ${cost} GOLD`} size={28} align="center" />
      <IconButton
        icon={affordable ? GUI.CONFIRM : GUI.EYE_OFF}
        size={86}
        title="UNLOCK"
        disabled={!affordable}
        onClick={onUnlock}
      />
      {!affordable && <BitmapLabel text="NOT ENOUGH GOLD" size={22} align="center" />}
    </div>
  )
}
