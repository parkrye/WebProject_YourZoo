const FIXED_STEP = 1 / 60
const MAX_FRAME_DELTA = 0.25

export interface TickerHandlers {
  /** 고정 스텝 시뮬레이션. 프레임당 0회 이상 호출된다. */
  fixedUpdate(step: number): void
  /** 렌더. 프레임당 정확히 1회. */
  render(dt: number): void
}

/**
 * rAF 루프. 시뮬레이션은 고정 스텝(1/60)으로 누산 처리하고 렌더는 프레임마다 1회 돈다.
 * 탭 비활성 등으로 큰 델타가 들어와도 MAX_FRAME_DELTA 로 잘라 스파이럴을 막는다.
 */
export function startTicker(handlers: TickerHandlers): () => void {
  let raf = 0
  let last = performance.now()
  let accumulator = 0
  let running = true

  const frame = (now: number): void => {
    if (!running) return
    raf = requestAnimationFrame(frame)

    const dt = Math.min((now - last) / 1000, MAX_FRAME_DELTA)
    last = now
    accumulator += dt

    while (accumulator >= FIXED_STEP) {
      handlers.fixedUpdate(FIXED_STEP)
      accumulator -= FIXED_STEP
    }

    handlers.render(dt)
  }

  raf = requestAnimationFrame(frame)

  return () => {
    running = false
    cancelAnimationFrame(raf)
  }
}
