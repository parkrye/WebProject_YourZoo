import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FENCE_OFFSET_DETAIL, FENCE_OFFSET_ZOO, GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH,
  PLACE_BOX, PROP_HEIGHT,
  type BiomeId,
} from '@/assets/manifest'
import { audio } from '@/audio/AudioManager'
import { startTicker } from '@/core/ticker'
import { MAX_ANIMALS_PER_ENCLOSURE, UNLOCK_COST, UNLOCK_REPUTATION } from '@/domain/balance'
import { phaseOf } from '@/domain/clock'
import { ENCLOSURE_ORDER, enclosureLabel } from '@/domain/enclosure'
import { SceneRenderer, type DropGuide, type EnclosureTransition } from '@/render/SceneRenderer'
import {
  clampCamera, createCamera, MIN_ZOOM, panCamera, screenToScene, zoomStep, type Camera,
} from '@/render/camera'
import { EnclosureSim } from '@/sim/EnclosureSim'
import { useGameStore } from '@/store/gameStore'
import { canPlaceProp, storedProps, type OwnedProp } from '@/domain/prop'
import { AnimalItemThumb, PropItemThumb } from '@/ui/components/ItemThumb'
import { BarButton } from '@/ui/components/BarButton'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { ClockDial } from '@/ui/components/ClockDial'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { AnimalCard } from '@/ui/panels/AnimalCard'
import { StorageTray, type DragState } from '@/ui/panels/StorageTray'
import { TutorialOverlay } from '@/ui/panels/TutorialOverlay'
import { TUTORIAL_HINTS } from '@/domain/tutorial'
import type { Review } from '@/domain/review'

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
const FENCE_OFFSET_DRAGGING = 0.46
/**
 * 동물을 따라가는 전용 뷰의 배율.
 * 한 마리가 화면을 채우되 여기가 어느 우리인지는 남을 만큼만 당긴다.
 */
const FOLLOW_ZOOM = 2.5
/**
 * 카메라가 동물을 쫓는 속도.
 *
 * 좌표를 그대로 따라 붙이면 동물이 화면 한복판에 못 박히고, 대신 **배경이 흔들린다** —
 * 걸음마다 좌우로 미세하게 떨리는 것이 전부 카메라로 옮겨 붙는다.
 * 조금 뒤처지게 두면 사람이 카메라를 잡고 따라가는 것처럼 보인다.
 */
const FOLLOW_RESPONSE = 4

export function ZooScreen({ detail }: ZooScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderer = useMemo(() => new SceneRenderer(), [])
  const fenceRef = useRef(detail ? FENCE_OFFSET_DETAIL : FENCE_OFFSET_ZOO)

  // 카메라는 드래그 중 매 프레임 읽히므로 ref 가 진짜 소유자다.
  // state 는 버튼 활성화 표시를 위한 사본일 뿐이다.
  const cameraRef = useRef<Camera>(createCamera())
  /** 렌더 루프가 매 프레임 읽는다. state 로 두면 트윈이 한 박자 늦는다. */
  const loweringRef = useRef(false)
  /** 배치 안내선. 같은 이유로 ref 다 — 손을 따라 매 프레임 다시 그린다. */
  const dropGuideRef = useRef<DropGuide | null>(null)
  const [camera, setCamera] = useState<Camera>(cameraRef.current)
  const [tool, setTool] = useState<DetailTool>('CURSOR')
  const panRef = useRef<{ x: number; y: number } | null>(null)

  const [trayOpen, setTrayOpen] = useState(false)
  /** 관찰 전용 모드. HUD 를 전부 걷고 화면만 남긴다. */
  const [hudHidden, setHudHidden] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  /**
   * 카메라가 따라다니는 동물.
   *
   * ref 가 진짜 소유자다 — 매 프레임 카메라를 옮기는 것은 틱 루프이고,
   * state 로만 두면 그 루프가 한 박자 늦은 값을 본다.
   */
  const followRef = useRef<string | null>(null)
  const [following, setFollowing] = useState<string | null>(null)
  /** 커서로 집은 배치된 프롭. 창고로 되돌릴 때만 쓴다. */
  const [pickedProp, setPickedProp] = useState<OwnedProp | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)
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
  const myEnclosureNames = useGameStore((s) => s.enclosureNames)
  const myCapacity = useGameStore((s) => s.capacity)

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
  /** 따라가는 중에 띠에 적는 이름. 목록에서 빠진 사이라면 빈 문자열이다. */
  const followName = useMemo(
    () => (following ? (animals.find((a) => a.id === following)?.name ?? '') : ''),
    [animals, following],
  )

  const select = useCallback((id: string | null) => {
    selectedIdRef.current = id
    setSelectedId(id)
  }, [])

  const applyCameraState = useCallback((next: Camera) => {
    cameraRef.current = next
    setCamera(next)
  }, [])

  const stopFollow = useCallback(() => {
    followRef.current = null
    setFollowing(null)
    applyCameraState(createCamera())
  }, [applyCameraState])

  /** 이 동물을 따라간다. 손 도구와 창고는 여기서 할 일이 없으므로 걷는다. */
  const startFollow = useCallback((id: string) => {
    followRef.current = id
    setFollowing(id)
    setTool('CURSOR')
    setTrayOpen(false)
  }, [])

  // 상세보기를 벗어나면 카메라·선택·트레이를 원위치시킨다.
  useEffect(() => {
    if (detail) return
    stopFollow()
    setTool('CURSOR')
    setTrayOpen(false)
    setHudHidden(false)
    select(null)
    setPickedProp(null)
  }, [detail, stopFollow, select])

  useEffect(() => {
    for (const sim of sims.values()) sim.syncAnimals(animals)
  }, [animals, sims])

  useEffect(() => {
    for (const sim of sims.values()) sim.syncProps(props)
  }, [props, sims])

  /*
    무언가를 끌기 시작하면 트레이도 펜스도 곧바로 내려간다.
    예전에는 손이 트레이 밖으로 나갔을 때만 내렸는데, 물 영역이 하필 트레이가
    있는 화면 아래쪽이라 **놓으려고 손을 내리면 트레이가 다시 올라와** 놓을 자리를 가렸다.
    고르는 동안에는 트레이가 필요하지만 이미 집은 뒤에는 필요 없다.
  */
  useEffect(() => {
    loweringRef.current = drag !== null
  }, [drag])

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
        const fresh: Review[] = []
        for (const [id, sim] of sims) {
          sim.update(step, {
            // 손님 수는 보고 있는 동물원의 명성을 따른다. 구경 중에 내 명성으로 세면 안 된다.
            reputation: store.visiting ? store.visiting.reputation : store.reputation,
            phase,
            active: id === shown,
            day: store.clock.day,
            capacity: store.capacity[id],
            // 남의 동물원에서 나온 말은 그 사람의 평가다. 내 목록에 담지 않는다.
            collectReviews: !store.visiting,
          })
          fresh.push(...sim.drainReviews())
        }
        // 우리 셋의 몫을 모아 한 번에 넘긴다. 우리마다 밀어 넣으면 한 프레임에 세 번 리렌더한다.
        store.pushReviews(fresh)

        /*
          따라가는 중이면 카메라가 그 동물을 쫓는다.

          동물이 사라졌으면(창고로 넣었거나 팔았거나) 스스로 그만둔다 —
          빈 자리를 계속 비추고 있으면 화면이 고장 난 것으로 보인다.
        */
        const followId = followRef.current
        if (followId) {
          const agent = sims.get(shown)?.findAnimal(followId) ?? null
          if (!agent) {
            followRef.current = null
            setFollowing(null)
            applyCameraState(createCamera())
          } else {
            const cam = cameraRef.current
            const k = Math.min(1, step * FOLLOW_RESPONSE)
            cameraRef.current = clampCamera({
              zoom: FOLLOW_ZOOM,
              x: cam.x + (agent.x - cam.x) * k,
              y: cam.y + (agent.y - cam.y) * k,
            })
          }
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
          dropGuide: dropGuideRef.current,
          camera: cameraRef.current,
          /*
            따라가는 중에는 발밑 링을 그리지 않는다.
            누구를 보고 있는지는 카메라가 이미 말하고 있고, 배율을 당긴 화면에서
            그 링은 동물보다 커져 한복판에 커다란 타원이 걸린다.
          */
          selectedId: followRef.current ? null : selectedIdRef.current,
          transition: transitionRef.current,
        })
      },
    })
  }, [detail, renderer, sims, applyCameraState])

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
    dropGuideRef.current = guideFor(state, canPlaceIn(enclosure), canPlaceProp(props, enclosure))
  }, [toStage, canPlaceIn, enclosure, props])

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
      // 따라가는 중이라면 대상을 갈아탄다. 한 번 멈췄다 다시 고를 이유가 없다.
      if (followRef.current) startFollow(picked.id)
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
    // 따라가던 동물은 저 우리에 있다. 넘어가면 쫓을 대상이 없다.
    stopFollow()
    select(null)
    moveEnclosure(direction)
  }

  const handleDrop = (state: DragState): void => {
    setDrag(null)
    setGhost(null)
    dropGuideRef.current = null

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

    // 놓는 자리는 이동 범위보다 좁다. 여기서 보는 건 놓을 수 있는 상자다.
    const box = PLACE_BOX[state.item.animal.traits.habitat]
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

  const here = animals.filter((a) => a.status === 'PLACED' && a.enclosureId === enclosure).length
  // 이름과 정원도 보고 있는 동물원의 것을 따른다. 남의 우리에 내 정원을 적을 수는 없다.
  const names = visiting ? visiting.enclosureNames : myEnclosureNames
  const room = (visiting ? visiting.capacity?.[enclosure] : myCapacity[enclosure]) ?? MAX_ANIMALS_PER_ENCLOSURE
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
        <LockedOverlay
          id={enclosure}
          gold={gold}
          reputation={reputation}
          onUnlock={() => unlockEnclosure(enclosure)}
        />
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
            /*
              상세보기의 이름표도 그 우리를 손보는 문이다. 우리를 들여다보는
              중에 이름이 마음에 안 들면 바깥으로 나갔다 오는 것이 아니라
              **보고 있는 그 자리에서** 고칠 수 있어야 한다.
            */
            <button
              type="button"
              className="hud-top-right is-button"
              disabled={!!visiting}
              onClick={() => openModal('ENCLOSURE')}
            >
              <BitmapLabel text={enclosureLabel(enclosure, names)} size={24} align="right" />
              <div className="hud-purse">
                <IconGlyph icon={GUI.PAW} size={26} />
                <BitmapLabel text={`${here} / ${room}`} size={22} />
              </div>
            </button>
          ) : (
            <>
              {/*
                날짜와 시계는 각자의 판에 둔다. 한 판에 같이 담으면 날짜가 세 자리가
                될수록 판이 늘어나며 시계가 글자에 붙은 장식처럼 읽힌다.
              */}
              <div className="hud-top-left">
                {visiting ? (
                  <div className="hud-plate">
                    <BitmapLabel text={`VISITING DAY ${visiting.day}`} size={26} />
                  </div>
                ) : (
                  <>
                    <div className="hud-plate">
                      <BitmapLabel text={`DAY ${day}`} size={34} />
                    </div>
                    {/* 숫자는 읽어서 해석해야 하지만 바늘은 한눈에 지금이 어디쯤인지 보여 준다. */}
                    <div className="hud-plate is-dial">
                      <ClockDial elapsed={elapsed} size={46} />
                    </div>
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
                      <IconGlyph icon={GUI.COIN_LARGE} size={30} />
                      <BitmapLabel text={`${cash}`} size={24} />
                    </>
                  )}
                </div>
              </div>

              {/*
                여기서는 이름을 읽기만 한다. 고치는 것은 상세보기 안에서만 한다 —
                우리를 손보는 일은 그 우리에 **들어가서** 하는 것이고,
                무엇보다 밖에서는 지금 그 우리가 어떤 상태인지 보이지 않는다.
              */}
              <div className="hud-enclosure-name">
                <BitmapLabel text={enclosureLabel(enclosure, names)} size={38} align="center" />
                <BitmapLabel
                  text={isOpen ? `ANIMALS ${here} / ${room}` : 'LOCKED'}
                  size={22}
                  align="center"
                />
              </div>
            </>
          )}

          {/* 구경 중에 연 우리가 하나뿐이면 화살표 자체를 띄우지 않는다. 눌러도 갈 데가 없다. */}
          {canMove && !following && (
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

          {selected && !following && (
            <AnimalCard
              animal={selected}
              onClose={() => select(null)}
              readOnly={visiting !== null}
              {...(detail && selected.status === 'PLACED' && {
                onFollow: () => startFollow(selected.id),
              })}
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

          {/*
            따라가는 중에는 화면에 그 동물만 남긴다. 전용 뷰라는 말이 그 뜻이다 —
            창고도 요청서도 여기서 할 일이 아니고, 띠가 남아 있으면 여전히
            우리를 둘러보는 화면으로 읽힌다. 이름과 나가는 문만 남긴다.
          */}
          {following && (
            <div className="hud-bottom-bar is-follow">
              <div className="bar-group bar-center">
                <BitmapLabel text={`FOLLOWING ${followName}`} size={26} />
                <BarButton icon={GUI.BACK} label="STOP" onClick={stopFollow} />
              </div>
            </div>
          )}

          {!following && (
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
                      icon={GUI.CRATE}
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
                  <BarButton icon={GUI.SHOP} label="SHOP" onClick={() => openModal('SHOP')} />
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
          )}
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
            lowered={drag !== null}
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

/**
 * 끌고 있는 것이 어디에 들어갈 수 있는지.
 * 동물은 제 서식지 칸에만, 프롭은 어디에나 들어간다.
 */
function guideFor(state: DragState, roomForAnimal: boolean, roomForProp: boolean): DropGuide {
  if (state.item.kind === 'PROP') return { habitat: null, blocked: !roomForProp }
  return { habitat: state.item.animal.traits.habitat, blocked: !roomForAnimal }
}

interface LockedOverlayProps {
  id: BiomeId
  gold: number
  reputation: number
  onUnlock: () => void
}

/**
 * 잠긴 우리.
 *
 * 조건이 둘이므로 **가진 것과 필요한 것을 나란히** 적는다.
 * "NOT ENOUGH" 한 줄만 띄우면 무엇이 얼마나 모자란지 알 수 없어,
 * 얼마를 더 모아야 하는지 가늠할 수가 없다.
 */
function LockedOverlay({ id, gold, reputation, onUnlock }: LockedOverlayProps) {
  const cost = UNLOCK_COST[id]
  const fame = UNLOCK_REPUTATION[id]
  const rich = gold >= cost
  const famous = reputation >= fame
  const ready = rich && famous

  return (
    <div className="locked-overlay">
      <IconGlyph icon={GUI.LOCK} size={72} />
      <BitmapLabel text="LOCKED" size={64} align="center" />

      <div className="locked-reqs">
        <span className={rich ? 'locked-req is-met' : 'locked-req'}>
          <IconGlyph icon={GUI.COIN} size={30} />
          <BitmapLabel text={`${gold} / ${cost}`} size={24} />
        </span>
        <span className={famous ? 'locked-req is-met' : 'locked-req'}>
          <IconGlyph icon={GUI.MEDAL} size={30} />
          <BitmapLabel text={`${reputation} / ${fame}`} size={24} />
        </span>
      </div>

      <IconButton
        icon={ready ? GUI.LOCK_OPEN : GUI.EYE_OFF}
        size={86}
        title="UNLOCK"
        disabled={!ready}
        onClick={onUnlock}
      />
      {/* 명성은 동물을 배치해야만 오른다. 그 사실을 여기서 한 번 알려 준다. */}
      {!ready && (
        <BitmapLabel
          text={rich ? 'PLACE ANIMALS TO EARN FAME' : 'NOT ENOUGH GOLD'}
          size={22}
          align="center"
        />
      )}
    </div>
  )
}
