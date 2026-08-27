import { DAY_DURATION_SEC, PHASE_END } from './balance'
import type { SkyPhase } from '@/assets/manifest'
import { clamp01, inverseLerp } from '@/core/math'

export interface ClockState {
  /** 1부터 시작 */
  day: number
  /** 오늘 경과 초 (0 ~ DAY_DURATION_SEC) */
  elapsed: number
}

export interface ClockAdvanceResult {
  next: ClockState
  /** 자정을 넘긴 횟수. 정산 트리거. */
  daysPassed: number
}

export function advanceClock(state: ClockState, dt: number): ClockAdvanceResult {
  const total = state.elapsed + dt
  const daysPassed = Math.floor(total / DAY_DURATION_SEC)
  return {
    next: { day: state.day + daysPassed, elapsed: total - daysPassed * DAY_DURATION_SEC },
    daysPassed,
  }
}

export function phaseOf(elapsed: number): SkyPhase {
  if (elapsed < PHASE_END.DAY) return 'DAY'
  if (elapsed < PHASE_END.AFTERNOON) return 'AFTERNOON'
  return 'NIGHT'
}

/** 현재 시간대와, 다음 시간대로의 크로스페이드 진행률(0..1). */
export interface PhaseBlend {
  from: SkyPhase
  to: SkyPhase
  t: number
}

/**
 * 시간대 크로스페이드 길이.
 * 하루가 180초뿐이라 길게 잡으면 늘 어중간한 색으로 보인다. 짧게 끊어야 전환이 읽힌다.
 */
const CROSSFADE_SEC = 1

export function phaseBlend(elapsed: number): PhaseBlend {
  const from = phaseOf(elapsed)
  const boundary =
    from === 'DAY' ? PHASE_END.DAY : from === 'AFTERNOON' ? PHASE_END.AFTERNOON : PHASE_END.NIGHT
  const to: SkyPhase = from === 'DAY' ? 'AFTERNOON' : from === 'AFTERNOON' ? 'NIGHT' : 'DAY'
  const t = clamp01(inverseLerp(boundary - CROSSFADE_SEC, boundary, elapsed))
  return { from, to, t }
}

/**
 * HUD 표기용 시각. 하루 180초를 24시간에 매핑하되, 게임 시작이 06:00 이 되도록 이동한다.
 *
 * **분은 버리고 시 단위로 내린다.** 하루가 180초라 분까지 보여주면 숫자가 1초에도
 * 여러 번 바뀌어 화면이 산만해진다. 시 단위면 7.5초에 한 번만 갱신된다.
 * 폰트에 콜론이 없으므로 시/분을 분리해 반환한다.
 */
export function clockLabel(elapsed: number): { hh: string; mm: string } {
  const dayFraction = elapsed / DAY_DURATION_SEC
  const hour = Math.floor((dayFraction * 24 + 6) % 24)
  return { hh: String(hour).padStart(2, '0'), mm: '00' }
}
