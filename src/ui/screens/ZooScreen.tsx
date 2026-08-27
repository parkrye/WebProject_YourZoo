import { useEffect, useMemo, useRef } from 'react'
import {
  FENCE_OFFSET_DETAIL, FENCE_OFFSET_ZOO, GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH,
} from '@/assets/manifest'
import { startTicker } from '@/core/ticker'
import { createRng } from '@/core/rng'
import { clockLabel, phaseOf } from '@/domain/clock'
import { visitorCount } from '@/domain/economy'
import { ENCLOSURES } from '@/domain/enclosure'
import { SceneRenderer } from '@/render/SceneRenderer'
import { reconcileVisitors, type VisitorAgent } from '@/sim/VisitorAgent'
import { useGameStore } from '@/store/gameStore'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'

interface ZooScreenProps {
  detail: boolean
}

export function ZooScreen({ detail }: ZooScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderer = useMemo(() => new SceneRenderer(), [])
  const visitorsRef = useRef<VisitorAgent[]>([])
  const rng = useMemo(() => createRng(0x5eed), [])
  const fenceRef = useRef(detail ? FENCE_OFFSET_DETAIL : FENCE_OFFSET_ZOO)

  const setScreen = useGameStore((s) => s.setScreen)
  const openModal = useGameStore((s) => s.openModal)
  const moveEnclosure = useGameStore((s) => s.moveEnclosure)
  const enclosure = useGameStore((s) => s.currentEnclosure)
  const day = useGameStore((s) => s.clock.day)
  const elapsed = useGameStore((s) => s.clock.elapsed)

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
        // TODO(M3): hasAnimals 는 실제 배치된 동물 수로 대체한다.
        const target = visitorCount(store.reputation, phase, true)
        reconcileVisitors(visitorsRef.current, target, rng)
        for (const v of visitorsRef.current) v.update(step)

        // 펜스 오프셋 트윈 (0.45s easeInOutCubic 근사)
        fenceRef.current += (targetFence - fenceRef.current) * Math.min(1, step * 6)
      },
      render: () => {
        const store = useGameStore.getState()
        renderer.draw(ctx, {
          biome: store.currentEnclosure,
          elapsed: store.clock.elapsed,
          visitors: visitorsRef.current,
          fenceOffset: fenceRef.current,
        })
      },
    })
  }, [detail, renderer, rng])

  const time = clockLabel(elapsed)

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
