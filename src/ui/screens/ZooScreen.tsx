import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FENCE_OFFSET_DETAIL, FENCE_OFFSET_ZOO, GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH,
  PROP_HEIGHT, ROAM_BOX,
  type BiomeId,
} from '@/assets/manifest'
import { audio } from '@/audio/AudioManager'
import { startTicker } from '@/core/ticker'
import { MAX_ANIMALS_PER_ENCLOSURE, UNLOCK_COST } from '@/domain/balance'
import { clockLabel, phaseOf } from '@/domain/clock'
import { ENCLOSURE_ORDER, ENCLOSURES } from '@/domain/enclosure'
import { SceneRenderer, type EnclosureTransition } from '@/render/SceneRenderer'
import {
  clampCamera, createCamera, MIN_ZOOM, panCamera, screenToScene, zoomStep, type Camera,
} from '@/render/camera'
import { EnclosureSim } from '@/sim/EnclosureSim'
import { useGameStore } from '@/store/gameStore'
import { canPlaceProp, storedProps, type OwnedProp } from '@/domain/prop'
import { AnimalItemThumb, PropItemThumb } from '@/ui/components/ItemThumb'
import { BarButton } from '@/ui/components/BarButton'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
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
/**
 * 창고에서 끌어낸 손이 트레이 밖으로 나가면 울타리를 이만큼 더 내린다.
 * 물 영역은 평소 울타리와 트레이에 가려 어디에 놓는지 보이지 않는다.
 * 다만 완전히 치우지는 않는다 — 울타리가 사라지면 우리 경계도 함께 사라진다.
 */
const FENCE_OFFSET_DRAGGING = 0.32

export function ZooScreen({ detail }: ZooScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderer = useMemo(() => new SceneRenderer(), [])
  const fenceRef = useRef(detail ? FENCE_OFFSET_DETAIL : FENCE_OFFSET_ZOO)

  // 카메라는 드래그 중 매 프레임 읽히므로 ref 가 진짜 소유자다.
  // state 는 버튼 활성화 표시를 위한 사본일 뿐이다.
  const cameraRef = useRef<Camera>(createCamera())
  /** 렌더 루프가 매 프레임 읽는다. state 로 두면 트윈이 한 박자 늦는다. */
  const loweringRef = useRef(false)
  const [camera, setCamera] = useState<Camera>(cameraRef.current)
  const [tool, setTool] = useState<DetailTool>('CURSOR')
  const panRef = useRef<{ x: number; y: number } | null>(null)

  const [trayOpen, setTrayOpen] = useState(false)
  /** 관찰 전용 모드. HUD 를 전부 걷고 화면만 남긴다. */
  const [hudHidden, setHudHidden] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** 커서로 집은 배치된 프롭. 창고로 되돌릴 때만 쓴다. */
  const [pickedProp, setPickedProp] = useState<OwnedProp | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)
  /** 드래그 중인 손이 트레이 밖(= 우리 위)에 있는가. 그때만 시야를 비워 준다. */
  const [dragOverScene, setDragOverScene] = useState(false)
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
  const placeProp = useGameStore((s) => s.placeProp)
  const storePropAction = useGameStore((s) => s.storeProp)
  const storeAnimal = useGameStore((s) => s.storeAnimal)
  const sellAnimal = useGameStore((s) => s.sellAnimal)
  const canPlaceIn = useGameStore((s) => s.canPlaceIn)
  const modal = useGameStore((s) => s.modal)
  const tutorial = useGameStore((s) => s.tutorial)
  const advanceTutorial = useGameStore((s) => s.advanceTutorial)
  const skipTutorial = useGameStore((s) => s.skipTutorial)
  const endVisit = useGameStore((s) => s.endVisit)
  const gold = useGameStore((s) => s.gold)
  const cash = useGameStore((s) => s.cash)
  const day = useGameStore((s) => s.clock.day)
  const elapsed = useGameStore((s) => s.clock.elapsed)

  /*
    구경 중에는 화면에 뿌릴 값의 출처가 통째로 바뀐다.
    화면 구조는 내 동물원과 같으므로 컴포넌트를 따로 만들지 않고 **출처만 갈아 끼운다** —
    카메라·틱·렌더 코드를 한 벌 더 두면 둘이 조금씩 어긋나기 시작한다.
  */
  const visiting = useGameStore((s) => s.visiting)
  const myEnclosure = useGameStore((s) => s.currentEnclosure)
  const visitEnclosure = useGameStore((s) => s.visitEnclosure)
  const myUnlocked = useGameStore((s) => s.unlocked)
  const myReputation = useGameStore((s) => s.reputation)
  const myZooName = useGameStore((s) => s.zooName)
  const myAnimals = useGameStore((s) => s.animals)
  const myProps = useGameStore((s) => s.props)

  const enclosure = visiting ? visitEnclosure : myEnclosure
  const unlocked = visiting ? visiting.unlocked : myUnlocked
  const reputation = visiting ? visiting.reputation : myReputation
  const zooName = visiting ? visiting.zooName : myZooName
  const animals = useMemo(
    () => (visiting ? visiting.animals : myAnimals),
    [visiting, myAnimals],
  )
  const props = useMemo(
    // 구경 중인 동물원이 프롭 도입 전에 올라간 것이면 목록 자체가 없다.
    () => (visiting ? (visiting.props ?? []) : myProps),
    [visiting, myProps],
  )

  // 구경 중에는 잠긴 우리를 아예 볼 수 없으므로 화면에 뜬 우리는 늘 열려 있다.
  const isOpen = unlocked.includes(enclosure)
  const canMove = visiting ? unlocked.length > 1 : true
  const stored = useMemo(() => animals.filter((a) => a.status === 'STORED'), [animals])
  const shippingCount = useMemo(
    () => animals.filter((a) => a.status === 'SHIPPING').length + myProps.filter((p) => p.status === 'SHIPPING').length,
    [animals, myProps],
  )
  const storedPropList = useMemo(() => storedProps(myProps), [myProps])
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
    setTrayOpen(false)
    setHudHidden(false)
    select(null)
    setPickedProp(null)
  }, [detail, applyCameraState, select])

  useEffect(() => {
    for (const sim of sims.values()) sim.syncAnimals(animals)
  }, [animals, sims])

  useEffect(() => {
    for (const sim of sims.values()) sim.syncProps(props)
  }, [props, sims])

  useEffect(() => {
    loweringRef.current = dragOverScene
  }, [dragOverScene])

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

    return startTicker({
      fixedUpdate: (step) => {
        const store = useGameStore.getState()
        store.tickClock(step)
        // 정산 팝업이 떠 있는 동안에는 화면도 멈춰 있어야 결과를 읽기 편하다.
        if (store.modal === 'REPORT' || store.isDrawing) return

        const phase = phaseOf(store.clock.elapsed)
        const shown = store.visiting ? store.visitEnclosure : store.currentEnclosure
        for (const [id, sim] of sims) {
          sim.update(step, {
            // 손님 수는 보고 있는 동물원의 명성을 따른다. 구경 중에 내 명성으로 세면 안 된다.
            reputation: store.visiting ? store.visiting.reputation : store.reputation,
            phase,
            active: id === shown,
          })
        }

        // 드래그 중 시야를 비우는 것도 같은 트윈을 탄다. 뚝 끊기면 놓을 자리를 놓친다.
        const targetFence = loweringRef.current
          ? FENCE_OFFSET_DRAGGING
          : detail
            ? FENCE_OFFSET_DETAIL
            : FENCE_OFFSET_ZOO
        fenceRef.current += (targetFence - fenceRef.current) * Math.min(1, step * FENCE_TWEEN_RESPONSE)

        const transition = transitionRef.current
        if (transition) {
          transition.progress += step / SLIDE_DURATION
          if (transition.progress >= 1) transitionRef.current = null
        }
      },
      render: () => {
        const store = useGameStore.getState()
        const sim = sims.get(store.visiting ? store.visitEnclosure : store.currentEnclosure)
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

  /**
   * 뷰포트 좌표를 Stage 안쪽의 논리 좌표로 바꾼다.
   *
   * 드래그 고스트가 커서에서 어긋났던 이유가 이것이다 — 고스트는 `.screen` 안에 있고
   * 그 조상인 `.stage-view` 에 `transform: scale()` 이 걸려 있다. transform 이 걸린 조상은
   * `position: fixed` 의 기준이 되므로, 뷰포트 좌표를 그대로 넣으면 스케일만큼 밀린다.
   */
  const toStage = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scale = LOGICAL_WIDTH / rect.width
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale }
  }, [])

  const trackGhost = useCallback((state: DragState) => {
    setDrag(state)
    setGhost(toStage(state.clientX, state.clientY))

    // 트레이 위에 손이 있으면 아직 고르는 중이다. 벗어나야 놓을 자리를 보여 준다.
    const tray = document.querySelector('.storage-tray')?.getBoundingClientRect()
    setDragOverScene(!tray || state.clientY < tray.top)
  }, [toStage])

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

    // 동물이 먼저다. 프롭 위에 서 있는 동물을 집으려는데 프롭이 잡히면 답답하다.
    const picked = sim.pickAnimal(scene.x, scene.y)
    if (picked) {
      select(picked.id)
      setPickedProp(null)
      return
    }

    select(null)
    const prop = sim.pickProp(scene.x, scene.y)
    setPickedProp(prop && !visiting ? (props.find((p) => p.id === prop.id) ?? null) : null)
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

  /**
   * 창고에서 끌어온 동물을 우리에 내려놓는다. 서식지와 정원을 함께 본다.
   * 배치는 **상세보기에서만** 한다. 펜스 너머 멀리서 던져 넣는 그림이 어색하다.
   */
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
    setGhost(null)
    setDragOverScene(false)

    const scene = toScene(state.clientX, state.clientY)
    if (!scene) return

    // 프롭은 어디에나 놓을 수 있다. 만들 때 고른 것은 자리가 아니라 거동이다.
    if (state.item.kind === 'PROP') {
      if (!canPlaceProp(props, enclosure)) {
        audio.playSting('DENY')
        setDropError('NO ROOM FOR PROPS')
        return
      }
      // 프롭은 y 를 **발밑**으로 그린다. 커서에 몸 가운데가 오도록 반 칸 내려 잡는다 —
      // 그대로 넣으면 놓은 자리보다 프롭이 반 칸 위에 뜬다.
      const half = PROP_HEIGHT[state.item.prop.layer === 'WATER' ? 'WATER' : 'LAND'] / 2
      placeProp(state.item.prop.id, enclosure, scene.x, scene.y + half)
      return
    }

    const box = ROAM_BOX[state.item.animal.traits.habitat]
    const inside =
      scene.x >= box.x0 && scene.x <= box.x1 && scene.y >= box.y0 && scene.y <= box.y1
    if (!inside) {
      audio.playSting('DENY')
      setDropError(`DROP IN ${state.item.animal.traits.habitat} AREA`)
      return
    }

    if (!canPlaceIn(enclosure)) {
      audio.playSting('DENY')
      setDropError('ENCLOSURE IS FULL')
      return
    }

    // 스토어가 갱신되면 EnclosureSim 이 새 에이전트를 만든다. 그 전에 시작 위치를 알려 둔다.
    sims.get(enclosure)?.setSpawnHint(state.item.animal.id, scene.x, scene.y)
    // 배치 직후 카드를 띄우지 않는다. 창고가 열려 있는 동안에는 카드가 가려져 보이지도 않고,
    // 연달아 여러 마리를 놓는 흐름이 매번 끊긴다. 보고 싶으면 커서로 집으면 된다.
    placeAnimal(state.item.animal.id, enclosure)
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

      {tutorial !== 'DONE' && !visiting && (
        <TutorialOverlay hint={TUTORIAL_HINTS[tutorial]} onSkip={skipTutorial} />
      )}

      {!isOpen && !modal && !trayOpen && !visiting && (
        <LockedOverlay id={enclosure} gold={gold} onUnlock={() => unlockEnclosure(enclosure)} />
      )}

      {/*
        팝업이나 창고가 열려 있으면 HUD 를 통째로 감춘다.
        아래에서 버튼과 바가 비쳐 보이면 무엇을 눌러야 할지 헷갈린다.
        열린 UI 는 자기 닫기 버튼으로만 빠져나간다.
      */}
      {/* 관찰 모드에서도 되돌아올 문은 남겨 둔다. */}
      {hudHidden && !modal && !trayOpen && (
        <button type="button" className="hud-restore" onClick={() => setHudHidden(false)}>
          <IconGlyph icon={GUI.EYE_OFF} size={44} />
        </button>
      )}

      {!modal && !trayOpen && !hudHidden && (
        <>
          {/*
            상세보기는 우리 안을 들여다보는 화면이다. 날짜·시각·재화는 바깥 살림이라
            여기서는 걷어내고, 지금 이 우리에 몇 마리가 있는지만 남긴다.
          */}
          {detail ? (
            <div className="hud-top-right">
              <BitmapLabel text={ENCLOSURES[enclosure].label} size={24} align="right" />
              <div className="hud-purse">
                <IconGlyph icon={GUI.BOOK} size={26} />
                <BitmapLabel text={`${here} / ${MAX_ANIMALS_PER_ENCLOSURE}`} size={22} />
              </div>
            </div>
          ) : (
            <>
              <div className="hud-top-left">
                {visiting ? (
                  <BitmapLabel text={`VISITING DAY ${visiting.day}`} size={26} />
                ) : (
                  <>
                    <BitmapLabel text={`DAY ${day}`} size={34} />
                    <BitmapLabel text={`${time.hh} ${time.mm}`} size={34} />
                  </>
                )}
              </div>

              <div className="hud-top-right">
                <BitmapLabel text={zooName || 'MY ZOO'} size={26} align="right" />
                <div className="hud-purse">
                  {/* 남의 지갑은 보여 주지 않는다. 명성과 주인 아이디만 남긴다. */}
                  {visiting ? (
                    <>
                      <IconGlyph icon={GUI.MEDAL} size={30} />
                      <BitmapLabel text={`${reputation}`} size={24} />
                      <BitmapLabel text={visiting.userId} size={20} />
                    </>
                  ) : (
                    <>
                      <IconGlyph icon={GUI.COIN} size={30} />
                      <BitmapLabel text={`${gold}`} size={24} />
                      <IconGlyph icon={GUI.MEDAL} size={30} />
                      <BitmapLabel text={`${reputation}`} size={24} />
                      {/* GUI 시트에 캐시다운 아이콘이 없다. 무지개 팔레트가 가장 '특별한' 인상을 준다. */}
                      <IconGlyph icon={GUI.PALETTE} size={30} />
                      <BitmapLabel text={`${cash}`} size={24} />
                    </>
                  )}
                </div>
              </div>

              <div className="hud-enclosure-name">
                <BitmapLabel text={ENCLOSURES[enclosure].label} size={38} align="center" />
                <BitmapLabel text={isOpen ? `ANIMALS ${here}` : 'LOCKED'} size={22} align="center" />
              </div>
            </>
          )}

          {/* 구경 중에 연 우리가 하나뿐이면 화살표 자체를 띄우지 않는다. 눌러도 갈 데가 없다. */}
          {canMove && (
            <>
              <div className="hud-arrow hud-arrow-left">
                <IconButton icon={GUI.BACK} size={72} title="PREV" onClick={() => slideTo(-1)} />
              </div>
              <div className="hud-arrow hud-arrow-right">
                <IconButton icon={GUI.BACK} size={72} title="NEXT" onClick={() => slideTo(1)} />
              </div>
            </>
          )}

          {pickedProp && !selected && (
            <div className="prop-card popup">
              <header className="popup-header">
                <BitmapLabel text={pickedProp.name} size={22} />
                <IconButton icon={GUI.CLOSE} size={36} title="CLOSE" onClick={() => setPickedProp(null)} />
              </header>
              <div className="popup-content prop-card-body">
                <PropItemThumb prop={pickedProp} size={96} />
                <BitmapLabel text={pickedProp.layer} size={18} />
                <button
                  type="button"
                  className="labeled-button"
                  onClick={() => {
                    storePropAction(pickedProp.id)
                    setPickedProp(null)
                  }}
                >
                  <IconButton icon={GUI.BACK} size={38} />
                  <BitmapLabel text="STORE" size={16} />
                </button>
              </div>
            </div>
          )}

          {selected && (
            <AnimalCard
              animal={selected}
              onClose={() => select(null)}
              readOnly={visiting !== null}
              {...(!visiting && selected.status === 'PLACED' && {
                onStore: () => {
                  storeAnimal(selected.id)
                  select(null)
                },
              })}
              {...(!visiting && selected.status === 'STORED' && {
                onSell: () => {
                  sellAnimal(selected.id)
                  select(null)
                },
              })}
            />
          )}

          <div className="hud-bottom-bar">
            <div className="bar-group bar-left">
              {detail ? (
                <BarButton icon={GUI.BACK} label="BACK" onClick={() => setScreen('ZOO')} />
              ) : visiting ? (
                <BarButton icon={GUI.BACK} label="GO HOME" onClick={endVisit} />
              ) : (
                <BarButton
                  icon={GUI.BINOCULARS}
                  label="INSPECT"
                  data-tutorial="inspect"
                  disabled={!isOpen}
                  onClick={() => {
                    advanceTutorial('INSPECT', 'STORAGE')
                    setScreen('ZOO_DETAIL')
                  }}
                />
              )}
            </div>

            <div className="bar-group bar-center">
              {detail ? (
                <>
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
                  {/* 배치는 상세보기에서만. 펜스 너머 멀리서 던져 넣는 그림은 어색하다. */}
                  {!visiting && (
                    <BarButton
                      icon={GUI.BOOK}
                      label="STORAGE"
                      data-tutorial="storage"
                      onClick={() => {
                        advanceTutorial('STORAGE', 'PLACE')
                        select(null)
                        setTrayOpen(true)
                      }}
                    />
                  )}
                </>
              ) : visiting ? (
                /* 구경도 우리 안까지 들어가야 제맛이다. 요청서 자리에 가까이 보기를 둔다. */
                <BarButton
                  icon={GUI.BINOCULARS}
                  label="INSPECT"
                  disabled={!isOpen}
                  onClick={() => setScreen('ZOO_DETAIL')}
                />
              ) : (
                <BarButton
                  icon={GUI.SCROLL}
                  label="REQUEST"
                  data-tutorial="request"
                  onClick={() => {
                    advanceTutorial('ORDER', 'DRAW')
                    openModal('REQUEST')
                  }}
                />
              )}
            </div>

            <div className="bar-group bar-right">
              {!detail && !visiting && (
                <>
                  <BarButton icon={GUI.PALETTE} label="SHOP" onClick={() => openModal('SHOP')} />
                  <BarButton icon={GUI.MAP} label="VISIT" onClick={() => openModal('VISIT')} />
                  <BarButton icon={GUI.INFO} label="STATUS" onClick={() => openModal('STATUS')} />
                  <BarButton icon={GUI.SETTINGS} label="OPTIONS" onClick={() => openModal('OPTIONS')} />
                </>
              )}
              <BarButton
                icon={GUI.EYE_OFF}
                label="HIDE UI"
                onClick={() => {
                  select(null)
                  setHudHidden(true)
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* 창고가 열려 있는 동안에는 창고와 드롭 안내만 남는다. */}
      {trayOpen && (
        <>
          {dropError && (
            <div className="drop-error">
              <BitmapLabel text={dropError} size={28} align="center" />
            </div>
          )}

          <StorageTray
            stored={stored}
            storedProps={storedPropList}
            shippingCount={shippingCount}
            lowered={dragOverScene}
            onSelect={(item) => select(item.kind === 'ANIMAL' ? item.id : null)}
            onDragStart={trackGhost}
            onDragMove={trackGhost}
            onDragEnd={handleDrop}
            onClose={() => setTrayOpen(false)}
          />

          {drag && ghost && (
            <div
              className="drag-ghost"
              style={{ left: ghost.x - DRAG_GHOST_SIZE / 2, top: ghost.y - DRAG_GHOST_SIZE / 2 }}
            >
              {drag.item.kind === 'ANIMAL' ? (
                <AnimalItemThumb animal={drag.item.animal} size={DRAG_GHOST_SIZE} />
              ) : (
                <PropItemThumb prop={drag.item.prop} size={DRAG_GHOST_SIZE} />
              )}
            </div>
          )}
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
