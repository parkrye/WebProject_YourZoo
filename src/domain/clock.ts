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
 *   `sky`   하늘 — 시간대 밝기만 살짝
 *   `area`  우리 안(바닥·프롭·동물) — 밝기 약간 + 색 약간 + **부분적으로 비추는 조명 영역**
 *   `fence` 울타리 밖(울타리·손님) — 밝기와 색을 그대로 받는다
 *
 * 한 겹으로 화면 전체를 덮으면 이 차이가 사라져 전부 같이 어두워지기만 한다.
 */
export interface SkyLight {
  /** 1 이면 그대로, 낮을수록 어둡다. */
  readonly brightness: number
}

export interface AreaLight {
  readonly brightness: number
  readonly tint: string
  readonly tintAlpha: number
  /** 우리 안 몇 군데를 비추는 조명. 밤에 뚜렷하고 낮엔 없다. */
  readonly spotColor: string
  readonly spotAlpha: number
}

export interface FenceLight {
  readonly brightness: number
  readonly tint: string
  readonly tintAlpha: number
}

export interface TimeLighting {
  readonly sky: SkyLight
  readonly area: AreaLight
  readonly fence: FenceLight
}

const LIGHTING: Record<SkyPhase, TimeLighting> = {
  DAY: {
    sky: { brightness: 1 },
    area: { brightness: 1, tint: '#fff4d0', tintAlpha: 0.06, spotColor: '#ffe9a8', spotAlpha: 0 },
    fence: { brightness: 1, tint: '#fff2cc', tintAlpha: 0.08 },
  },
  AFTERNOON: {
    // 하늘 이미지가 이미 노을이다. 밝기만 살짝 떨어뜨린다.
    sky: { brightness: 0.95 },
    area: { brightness: 0.88, tint: '#e8a165', tintAlpha: 0.22, spotColor: '#ffc070', spotAlpha: 0.07 },
    // 울타리는 관람로 쪽이라 석양을 정면으로 받는다.
    fence: { brightness: 0.8, tint: '#ff8a3c', tintAlpha: 0.5 },
  },
  NIGHT: {
    sky: { brightness: 0.86 },
    area: { brightness: 0.66, tint: '#6d80c0', tintAlpha: 0.28, spotColor: '#ffc98a', spotAlpha: 0.2 },
    fence: { brightness: 0.46, tint: '#4a5c9e', tintAlpha: 0.55 },
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
    sky: { brightness: lerpNum(from.sky.brightness, to.sky.brightness, t) },
    area: {
      brightness: lerpNum(from.area.brightness, to.area.brightness, t),
      tint: mixHex(from.area.tint, to.area.tint, t),
      tintAlpha: lerpNum(from.area.tintAlpha, to.area.tintAlpha, t),
      spotColor: mixHex(from.area.spotColor, to.area.spotColor, t),
      spotAlpha: lerpNum(from.area.spotAlpha, to.area.spotAlpha, t),
    },
    fence: {
      brightness: lerpNum(from.fence.brightness, to.fence.brightness, t),
      tint: mixHex(from.fence.tint, to.fence.tint, t),
      tintAlpha: lerpNum(from.fence.tintAlpha, to.fence.tintAlpha, t),
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
