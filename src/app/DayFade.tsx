import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'

/** 한 방향 페이드에 쓰는 시간(초). 너무 길면 매일 기다리는 시간이 되고, 짧으면 깜빡임이 된다. */
const FADE_SEC = 0.5

/**
 * 하루가 넘어갈 때의 암전.
 *
 * 어두워진다 → 정산 → 리포트 → 밝아진다.
 * 정산 결과(소지금·명성·하늘)가 눈앞에서 튀는 걸 이 검은 막이 가린다.
 * 리포트를 그냥 띄우면 배경에서 날짜가 바뀌는 게 그대로 보여 하루가 끝난 느낌이 없었다.
 *
 * 진행은 CSS transition 이 아니라 rAF 로 돌린다 — 전환이 끝나는 시점에
 * **정산을 트리거해야 해서**, 끝났다는 신호가 확실해야 한다.
 * `transitionend` 는 탭이 비활성이거나 값이 바뀌지 않으면 오지 않는다.
 */
export function DayFade() {
  const phase = useGameStore((s) => s.dayFade)
  const finishDay = useGameStore((s) => s.finishDay)
  const endDayFade = useGameStore((s) => s.endDayFade)
  const [alpha, setAlpha] = useState(0)

  useEffect(() => {
    if (phase === 'NONE') {
      setAlpha(0)
      return
    }
    // 리포트를 읽는 동안은 완전히 어두운 채로 멈춰 있는다.
    if (phase === 'HOLD') {
      setAlpha(1)
      return
    }

    const from = phase === 'OUT' ? 0 : 1
    const to = phase === 'OUT' ? 1 : 0
    let raf = 0
    let start = 0

    const step = (now: number): void => {
      if (start === 0) start = now
      const t = Math.min(1, (now - start) / (FADE_SEC * 1000))
      setAlpha(from + (to - from) * t)
      if (t < 1) {
        raf = requestAnimationFrame(step)
        return
      }
      if (phase === 'OUT') finishDay()
      else endDayFade()
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, finishDay, endDayFade])

  if (phase === 'NONE') return null
  return <div className="day-fade" style={{ opacity: alpha }} />
}
