import { useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'

/**
 * 탭이 뒤로 가 있는 동안 흐른 시간을 돌아올 때 한 번에 반영한다.
 *
 * 게임 루프는 `requestAnimationFrame` 위에 있고, 브라우저는 보이지 않는 탭의 rAF 를
 * 멈추거나 초당 한 번까지 늦춘다. 그대로 두면 다른 창을 보다 돌아왔을 때
 * **시간이 그 자리에 멈춰 있다.** 하루가 180초뿐이라 특히 티가 난다.
 *
 * 시뮬레이션까지 되감지는 않는다 — 동물 위치를 몇 분치 다시 계산하는 건 비싸고,
 * 돌아왔을 때 어디에 있든 이상하지 않다. 흘러야 하는 건 시계와 정산이다.
 */
export function useBackgroundClock(): void {
  useEffect(() => {
    let hiddenAt = 0

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = performance.now()
        return
      }

      if (hiddenAt === 0) return
      const seconds = (performance.now() - hiddenAt) / 1000
      hiddenAt = 0
      if (seconds > 0.5) useGameStore.getState().tickClock(seconds)
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
}
