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
 * 시간대 조명. 세 층으로 나눈다.
 *
 * 한 겹으로 화면 전체를 덮으면 하늘까지 같은 색이 겹쳐 탁해지고,
 * 우리 안쪽은 "빛이 어디서 오는지" 없이 그냥 어두워지기만 한다.
 *
 *   1. `sky`       — 하늘. 이미 시간대별 이미지가 있으니 보정만 얹는다
 *   2. `enclosure` — 우리 안쪽(바닥·프롭·동물). 위에서 빛이 내려오는 그라디언트
 *   3. `global`    — 마지막에 화면 전체를 묶는 색조
 */
export interface SkyLight {
  readonly multiply: string
  readonly alpha: number
}

export interface EnclosureLight {
  /** 그늘 색. 곱연산으로 깔린다. */
  readonly shade: string
  readonly shadeAlpha: number
  /** 위에서 내려오는 빛의 색 */
  readonly light: string
  /** 빛이 가장 센 지점의 세기 */
  readonly lightAlpha: number
  /** 빛이 닿는 깊이 (0..1). 낮으면 위쪽만 밝다. */
  readonly reach: number
}

export interface GlobalLight {
  readonly multiply: string
  readonly glow: string
  readonly glowAlpha: number
}

export interface TimeLighting {
  readonly sky: SkyLight
  readonly enclosure: EnclosureLight
  readonly global: GlobalLight
}

const LIGHTING: Record<SkyPhase, TimeLighting> = {
  DAY: {
    sky: { multiply: '#ffffff', alpha: 0 },
    // 한낮은 해가 높다. 빛이 깊이 들어오고 그늘이 거의 없다.
    enclosure: { shade: '#ffffff', shadeAlpha: 0, light: '#fff6d8', lightAlpha: 0.1, reach: 0.85 },
    global: { multiply: '#ffffff', glow: '#ffffff', glowAlpha: 0 },
  },
  AFTERNOON: {
    sky: { multiply: '#ffd8a8', alpha: 0.25 },
    // 해가 낮아 빛이 얕게 들고, 아래쪽부터 그늘이 깔린다.
    enclosure: { shade: '#c98a52', shadeAlpha: 0.42, light: '#ff9a3c', lightAlpha: 0.3, reach: 0.45 },
    global: { multiply: '#ffc79a', glow: '#ff8c42', glowAlpha: 0.1 },
  },
  NIGHT: {
    sky: { multiply: '#8fa0d8', alpha: 0.18 },
    // 달빛은 약하고 차다. 바닥까지 닿지 않는다.
    enclosure: { shade: '#2f3d6b', shadeAlpha: 0.62, light: '#9fb4ff', lightAlpha: 0.16, reach: 0.35 },
    global: { multiply: '#7285bd', glow: '#2c3f7a', glowAlpha: 0.14 },
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
      multiply: mixHex(from.sky.multiply, to.sky.multiply, t),
      alpha: lerpNum(from.sky.alpha, to.sky.alpha, t),
    },
    enclosure: {
      shade: mixHex(from.enclosure.shade, to.enclosure.shade, t),
      shadeAlpha: lerpNum(from.enclosure.shadeAlpha, to.enclosure.shadeAlpha, t),
      light: mixHex(from.enclosure.light, to.enclosure.light, t),
      lightAlpha: lerpNum(from.enclosure.lightAlpha, to.enclosure.lightAlpha, t),
      reach: lerpNum(from.enclosure.reach, to.enclosure.reach, t),
    },
    global: {
      multiply: mixHex(from.global.multiply, to.global.multiply, t),
      glow: mixHex(from.global.glow, to.global.glow, t),
      glowAlpha: lerpNum(from.global.glowAlpha, to.global.glowAlpha, t),
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
