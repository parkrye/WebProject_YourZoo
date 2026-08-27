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

/** 시간대별 화면 색조. 하늘만 바꾸면 땅과 물은 한낮 그대로라 시간이 흐르는 느낌이 약하다. */
export interface LightTint {
  /** 곱연산으로 깔리는 색. 전체를 물들인다. */
  readonly multiply: string
  /** 더해지는 빛. 노을이나 달빛의 번짐. */
  readonly glow: string
  readonly glowAlpha: number
}

const TINTS: Record<SkyPhase, LightTint> = {
  DAY: { multiply: '#ffffff', glow: '#fff3d0', glowAlpha: 0 },
  AFTERNOON: { multiply: '#ffb877', glow: '#ff9a4d', glowAlpha: 0.16 },
  NIGHT: { multiply: '#5a6fae', glow: '#2c3f7a', glowAlpha: 0.22 },
}

/** 크로스페이드 중에는 두 시간대 색을 섞는다. 조명이 하늘보다 늦게 따라오면 어색하다. */
export function lightTint(elapsed: number): LightTint {
  const blend = phaseBlend(elapsed)
  const from = TINTS[blend.from]
  const to = TINTS[blend.to]
  if (blend.t <= 0) return from

  return {
    multiply: mixHex(from.multiply, to.multiply, blend.t),
    glow: mixHex(from.glow, to.glow, blend.t),
    glowAlpha: from.glowAlpha + (to.glowAlpha - from.glowAlpha) * blend.t,
  }
}

function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a)
  const pb = hexToRgb(b)
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t)
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t)
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t)
  return `rgb(${r},${g},${bl})`
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ]
}
