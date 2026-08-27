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

/**
 * 시간대 조명. 층마다 **다른 정도로** 반응한다.
 *
 *   `sky`   하늘은 늘 좀 밝다. 색만 살짝 얹고 밝기는 오히려 되살린다
 *   `area`  바닥·프롭·동물은 색 약간 + 밝기 약간 + 그늘 약간. 관찰 대상이라 너무 어두워지면 안 된다
 *   `fence` 울타리와 손님은 시간을 그대로 따른다. 밤엔 확실히 어둡고 저녁엔 확실히 붉다
 *
 * 한 겹으로 화면 전체를 덮으면 이 차이가 사라져 전부 같이 어두워지기만 한다.
 */
export interface SkyLight {
  readonly tint: string
  readonly tintAlpha: number
  /** 되살릴 밝기. 하늘이 가라앉지 않게 한다. */
  readonly lift: number
}

export interface AreaLight {
  readonly tint: string
  readonly tintAlpha: number
  /** 그늘 세기 */
  readonly shade: number
  /** 위에서 내려오는 빛 */
  readonly light: string
  readonly lightAlpha: number
  /** 빛이 닿는 깊이 (0..1) */
  readonly reach: number
}

export interface FenceLight {
  readonly tint: string
  readonly tintAlpha: number
  /** 어둡게 하는 정도. 밤엔 크게, 낮엔 0. */
  readonly shade: number
}

export interface TimeLighting {
  readonly sky: SkyLight
  readonly area: AreaLight
  readonly fence: FenceLight
}

const LIGHTING: Record<SkyPhase, TimeLighting> = {
  DAY: {
    sky: { tint: '#ffffff', tintAlpha: 0, lift: 0 },
    area: { tint: '#fff4d0', tintAlpha: 0.08, shade: 0.06, light: '#fff4c8', lightAlpha: 0.16, reach: 0.9 },
    fence: { tint: '#fff2cc', tintAlpha: 0.1, shade: 0 },
  },
  AFTERNOON: {
    // 노을은 하늘 이미지가 이미 붉다. 색만 조금 더 얹고 밝기는 지킨다.
    sky: { tint: '#ffb877', tintAlpha: 0.2, lift: 0.06 },
    area: { tint: '#e8a165', tintAlpha: 0.3, shade: 0.2, light: '#ff9840', lightAlpha: 0.26, reach: 0.5 },
    // 울타리는 관람로 쪽이라 석양을 정면으로 받는다.
    fence: { tint: '#ff8a3c', tintAlpha: 0.5, shade: 0.22 },
  },
  NIGHT: {
    sky: { tint: '#8fa4e0', tintAlpha: 0.12, lift: 0.1 },
    area: { tint: '#6d80c0', tintAlpha: 0.34, shade: 0.3, light: '#a8bcff', lightAlpha: 0.2, reach: 0.4 },
    fence: { tint: '#4a5c9e', tintAlpha: 0.55, shade: 0.5 },
  },
}

/** 크로스페이드 중에는 두 시간대를 섞는다. 조명이 하늘보다 늦게 따라오면 어색하다. */
export function timeLighting(elapsed: number): TimeLighting {
  const blend = phaseBlend(elapsed)
  const from = LIGHTING[blend.from]
  const to = LIGHTING[blend.to]
  if (blend.t <= 0) return from

  const t = blend.t
  return {
    sky: {
      tint: mixHex(from.sky.tint, to.sky.tint, t),
      tintAlpha: lerpNum(from.sky.tintAlpha, to.sky.tintAlpha, t),
      lift: lerpNum(from.sky.lift, to.sky.lift, t),
    },
    area: {
      tint: mixHex(from.area.tint, to.area.tint, t),
      tintAlpha: lerpNum(from.area.tintAlpha, to.area.tintAlpha, t),
      shade: lerpNum(from.area.shade, to.area.shade, t),
      light: mixHex(from.area.light, to.area.light, t),
      lightAlpha: lerpNum(from.area.lightAlpha, to.area.lightAlpha, t),
      reach: lerpNum(from.area.reach, to.area.reach, t),
    },
    fence: {
      tint: mixHex(from.fence.tint, to.fence.tint, t),
      tintAlpha: lerpNum(from.fence.tintAlpha, to.fence.tintAlpha, t),
      shade: lerpNum(from.fence.shade, to.fence.shade, t),
    },
  }
}

const lerpNum = (a: number, b: number, t: number): number => a + (b - a) * t

function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a)
  const pb = hexToRgb(b)
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '')
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}
