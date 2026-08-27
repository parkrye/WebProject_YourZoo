import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FENCE_OFFSET_DETAIL, FENCE_OFFSET_ZOO, GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH,
  type BiomeId,
} from '@/assets/manifest'
import { startTicker } from '@/core/ticker'
import { UNLOCK_COST } from '@/domain/balance'
import { clockLabel, phaseOf } from '@/domain/clock'
import { ENCLOSURE_ORDER, ENCLOSURES } from '@/domain/enclosure'
import { SceneRenderer } from '@/render/SceneRenderer'
import {
  clampCamera, createCamera, MIN_ZOOM, panCamera, zoomStep, type Camera,
} from '@/render/camera'
import { EnclosureSim } from '@/sim/EnclosureSim'
import { useGameStore } from '@/store/gameStore'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'

interface ZooScreenProps {
  detail: boolean
}

type DetailTool = 'CURSOR' | 'PAN'

/** 펜스 하강/상승 트윈 속도. 값이 클수록 빨리 붙는다. */
const FENCE_TWEEN_RESPONSE = 6

export function ZooScreen({ detail }: ZooScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderer = useMemo(() => new SceneRenderer(), [])
  const fenceRef = useRef(detail ? FENCE_OFFSET_DETAIL : FENCE_OFFSET_ZOO)

  // 카메라는 드래그 중 매 프레임 읽히므로 ref 가 진짜 소유자다.
  // state 는 버튼 활성화 표시를 위한 사본일 뿐이다.
  const cameraRef = useRef<Camera>(createCamera())
  const [camera, setCamera] = useState<Camera>(cameraRef.current)
  const [tool, setTool] = useState<DetailTool>('CURSOR')
  const dragRef = useRef<{ x: number; y: number } | null>(null)

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
  const enclosure = useGameStore((s) => s.currentEnclosure)
  const unlocked = useGameStore((s) => s.unlocked)
  const gold = useGameStore((s) => s.gold)
  const animals = useGameStore((s) => s.animals)
  const day = useGameStore((s) => s.clock.day)
  const elapsed = useGameStore((s) => s.clock.elapsed)

  const isOpen = unlocked.includes(enclosure)

  const applyCameraState = useCallback((next: Camera) => {
    cameraRef.current = next
    setCamera(next)
  }, [])

  // 상세보기를 벗어나면 카메라를 원위치시킨다. 확대된 채로 우리 화면에 돌아가면 안 된다.
  useEffect(() => {
    if (detail) return
    applyCameraState(createCamera())
    setTool('CURSOR')
  }, [detail, applyCameraState])

  useEffect(() => {
    for (const sim of sims.values()) sim.syncAnimals(animals)
  }, [animals, sims])

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
        if (store.modal !== null) return

        const phase = phaseOf(store.clock.elapsed)
        for (const [id, sim] of sims) {
          sim.update(step, {
            reputation: store.reputation,
            phase,
            active: id === store.currentEnclosure,
          })
        }

        fenceRef.current += (targetFence - fenceRef.current) * Math.min(1, step * FENCE_TWEEN_RESPONSE)
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
        })
      },
    })
  }, [detail, renderer, sims])

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (!detail || tool !== 'PAN' || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const drag = dragRef.current
    if (!drag) return

    // Stage 가 CSS 로 축소되어 있으므로 화면 픽셀을 논리 픽셀로 환산한다.
    const rect = event.currentTarget.getBoundingClientRect()
    const scale = LOGICAL_WIDTH / rect.width

    applyCameraState(
      panCamera(
        cameraRef.current,
        (event.clientX - drag.x) * scale,
        (event.clientY - drag.y) * scale,
        LOGICAL_WIDTH,
        LOGICAL_HEIGHT,
      ),
    )
    dragRef.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const time = clockLabel(elapsed)
  const here = animals.filter((a) => a.enclosureId === enclosure).length
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

      {!isOpen && <LockedOverlay id={enclosure} gold={gold} onUnlock={() => unlockEnclosure(enclosure)} />}

      <div className="hud-top-left">
        <BitmapLabel text={`DAY ${day}`} size={34} />
        <BitmapLabel text={`${time.hh} ${time.mm}`} size={34} />
      </div>

      <div className="hud-top-right">
        <IconButton icon={GUI.SETTINGS} size={64} title="OPTIONS" onClick={() => openModal('OPTIONS')} />
      </div>

      <div className="hud-enclosure-name">
        <BitmapLabel text={ENCLOSURES[enclosure].label} size={38} align="center" />
        <BitmapLabel text={isOpen ? `ANIMALS ${here}` : 'LOCKED'} size={22} align="center" />
      </div>

      {!detail && (
        <>
          <div className="hud-arrow hud-arrow-left">
            <IconButton icon={GUI.BACK} size={78} title="PREV" onClick={() => moveEnclosure(-1)} />
          </div>
          <div className="hud-arrow hud-arrow-right">
            <IconButton icon={GUI.BACK} size={78} title="NEXT" onClick={() => moveEnclosure(1)} />
          </div>
          <div className="hud-bottom-bar">
            <IconButton
              icon={GUI.BINOCULARS}
              size={72}
              title="DETAIL"
              disabled={!isOpen}
              onClick={() => setScreen('ZOO_DETAIL')}
            />
            <IconButton
              icon={GUI.SCROLL}
              size={72}
              title="REQUEST"
              disabled={!isOpen}
              onClick={() => openModal('REQUEST')}
            />
            <IconButton icon={GUI.INFO} size={72} title="STATUS" onClick={() => openModal('STATUS')} />
          </div>
        </>
      )}

      {detail && (
        <div className="hud-bottom-bar">
          <IconButton icon={GUI.BACK} size={72} title="BACK" onClick={() => setScreen('ZOO')} />
          <IconButton
            icon={GUI.CURSOR}
            size={72}
            title="CURSOR"
            disabled={tool === 'CURSOR'}
            onClick={() => setTool('CURSOR')}
          />
          <IconButton
            icon={GUI.HAND}
            size={72}
            title="PAN"
            disabled={tool === 'PAN'}
            onClick={() => setTool('PAN')}
          />
          <IconButton
            icon={GUI.ZOOM_IN}
            size={72}
            title="ZOOM IN"
            onClick={() => applyCameraState(zoomStep(cameraRef.current, 1))}
          />
          <IconButton
            icon={GUI.ZOOM_OUT}
            size={72}
            title="ZOOM OUT"
            disabled={camera.zoom <= MIN_ZOOM}
            onClick={() => applyCameraState(clampCamera(zoomStep(cameraRef.current, -1)))}
          />
        </div>
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
