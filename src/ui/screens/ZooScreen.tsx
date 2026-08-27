import { useEffect, useMemo, useRef } from 'react'
import {
  FENCE_OFFSET_DETAIL, FENCE_OFFSET_ZOO, GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH,
  type BiomeId,
} from '@/assets/manifest'
import { startTicker } from '@/core/ticker'
import { clockLabel, phaseOf } from '@/domain/clock'
import { ENCLOSURE_ORDER, ENCLOSURES } from '@/domain/enclosure'
import { SceneRenderer } from '@/render/SceneRenderer'
import { EnclosureSim } from '@/sim/EnclosureSim'
import { useGameStore } from '@/store/gameStore'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'

interface ZooScreenProps {
  detail: boolean
}

/** 펜스 하강/상승 트윈 속도. 값이 클수록 빨리 붙는다. */
const FENCE_TWEEN_RESPONSE = 6

export function ZooScreen({ detail }: ZooScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderer = useMemo(() => new SceneRenderer(), [])
  const fenceRef = useRef(detail ? FENCE_OFFSET_DETAIL : FENCE_OFFSET_ZOO)

  // 우리 3개를 모두 유지하며 계속 시뮬레이션한다. 넘겼다 돌아왔을 때 얼어 있으면 어색하다.
  const sims = useMemo(() => {
    const map = new Map<BiomeId, EnclosureSim>()
    for (const id of ENCLOSURE_ORDER) map.set(id, new EnclosureSim(id))
    return map
  }, [])

  const setScreen = useGameStore((s) => s.setScreen)
  const openModal = useGameStore((s) => s.openModal)
  const moveEnclosure = useGameStore((s) => s.moveEnclosure)
  const enclosure = useGameStore((s) => s.currentEnclosure)
  const animals = useGameStore((s) => s.animals)
  const day = useGameStore((s) => s.clock.day)
  const elapsed = useGameStore((s) => s.clock.elapsed)

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
        renderer.draw(ctx, { sim, elapsed: store.clock.elapsed, fenceOffset: fenceRef.current })
      },
    })
  }, [detail, renderer, sims])

  const time = clockLabel(elapsed)
  const here = animals.filter((a) => a.enclosureId === enclosure).length

  return (
    <div className="screen">
      <canvas ref={canvasRef} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} className="screen-canvas" />

      <div className="hud-top-left">
        <BitmapLabel text={`DAY ${day}`} size={34} />
        <BitmapLabel text={`${time.hh} ${time.mm}`} size={34} />
      </div>

      <div className="hud-top-right">
        <IconButton icon={GUI.SETTINGS} size={64} title="OPTIONS" onClick={() => openModal('OPTIONS')} />
      </div>

      <div className="hud-enclosure-name">
        <BitmapLabel text={ENCLOSURES[enclosure].label} size={38} align="center" />
        <BitmapLabel text={`ANIMALS ${here}`} size={22} align="center" />
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
            <IconButton icon={GUI.BINOCULARS} size={72} title="DETAIL" onClick={() => setScreen('ZOO_DETAIL')} />
            <IconButton icon={GUI.SCROLL} size={72} title="REQUEST" onClick={() => openModal('REQUEST')} />
            <IconButton icon={GUI.INFO} size={72} title="STATUS" onClick={() => openModal('STATUS')} />
          </div>
        </>
      )}

      {detail && (
        <div className="hud-bottom-bar">
          <IconButton icon={GUI.BACK} size={72} title="BACK" onClick={() => setScreen('ZOO')} />
          <IconButton icon={GUI.CURSOR} size={72} title="CURSOR" />
          <IconButton icon={GUI.HAND} size={72} title="PAN" />
          <IconButton icon={GUI.ZOOM_IN} size={72} title="ZOOM IN" />
          <IconButton icon={GUI.ZOOM_OUT} size={72} title="ZOOM OUT" />
        </div>
      )}
    </div>
  )
}
