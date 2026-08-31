import { useEffect, useState } from 'react'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { useGameStore } from '@/store/gameStore'

/** 한 방향 페이드에 쓰는 시간(초). 하루 넘김보다 짧다 — 매번 기다릴 일이 아니다. */
const FADE_SEC = 0.32
/** 완전히 어두운 채로 머무는 시간(ms). 어디로 가는지 한 줄 읽을 만큼만. */
const HOLD_MS = 420

/**
 * 동물원을 오갈 때의 암전.
 *
 * 예전에는 남의 동물원이 **한 프레임 만에** 바뀌었다. 배경도 우리도 비슷해서
 * 들어간 건지 아직 내 동물원인지 알 수 없었고, 돌아올 때도 마찬가지였다.
 * 어두워졌다 밝아지고, 캄캄한 동안 어디에 도착했는지 적어 준다.
 *
 * 진행은 CSS transition 이 아니라 rAF 로 돌린다 — 끝나는 시점에 **화면을 갈아 끼워야** 해서
 * 끝났다는 신호가 확실해야 한다. `transitionend` 는 탭이 비활성이면 오지 않는다.
 */
export function TravelFade() {
  const phase = useGameStore((s) => s.travel)
  const advance = useGameStore((s) => s.advanceTravel)
  const visiting = useGameStore((s) => s.visiting)
  const zooName = useGameStore((s) => s.zooName)
  const [alpha, setAlpha] = useState(0)

  useEffect(() => {
    if (phase === 'NONE') {
      setAlpha(0)
      return
    }

    if (phase === 'HOLD') {
      setAlpha(1)
      const timer = window.setTimeout(advance, HOLD_MS)
      return () => window.clearTimeout(timer)
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
      advance()
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, advance])

  if (phase === 'NONE') return null

  // 글자는 완전히 어두워진 뒤에만 띄운다. 반쯤 밝은 화면 위에 겹치면 둘 다 안 읽힌다.
  const caption = alpha > 0.85

  return (
    <div className="travel-fade" style={{ opacity: alpha }}>
      {caption && (
        <div className="travel-caption">
          <BitmapLabel text={visiting ? 'VISITING' : 'BACK HOME'} size={22} align="center" />
          <BitmapLabel text={visiting ? visiting.zooName : zooName || 'MY ZOO'} size={44} align="center" />
          {visiting && <BitmapLabel text={visiting.userId} size={18} align="center" />}
        </div>
      )}
    </div>
  )
}
