import type { GuideShape } from './templates'

/**
 * 파츠별 밑그림.
 *
 * "FAR ARM" 이라는 이름만 주고 빈 종이를 내밀면 무엇을 얼마만 한 크기로 그려야 하는지
 * 알 수 없다. 대략의 실루엣이 있으면 그 위에 덧그리기만 하면 된다.
 *
 * **모든 좌표는 파츠 상자를 꽉 채우도록 잡는다.** 그린 그림은 나중에 상자 크기로
 * 늘여 붙기 때문이다(`RigRenderer` 가 `drawImage` 로 상자에 맞춘다).
 * 상자 비율에 맞춰 갸름하게 그려 두면 늘어난 뒤 더 갸름해져 다리가 실처럼 된다.
 *
 * 같은 좌표가 두 곳에 쓰인다. 그리는 정사각 캔버스에서는 "이만큼 크게 그려라"로 보이고,
 * 부위 지도의 슬롯에서는 상자 비율로 눌려 **완성됐을 때의 모습**으로 보인다.
 */

const path = (points: readonly (readonly [number, number])[], closed = false): GuideShape =>
  closed ? { kind: 'PATH', points, closed } : { kind: 'PATH', points }

const ellipse = (cx: number, cy: number, rx: number, ry: number): GuideShape =>
  ({ kind: 'ELLIPSE', cx, cy, rx, ry })

/** 동물은 오른쪽을 본다. 머리와 주둥이는 그 방향으로 뻗는다. */

// ── 다리 ────────────────────────────────────────────────────
export const LEGS_PAIR: readonly GuideShape[] = [
  path([[0.08, 0.02], [0.36, 0.02], [0.34, 0.7], [0.42, 0.95], [0.12, 0.95], [0.06, 0.7]], true),
  path([[0.64, 0.02], [0.92, 0.02], [0.94, 0.7], [0.88, 0.95], [0.58, 0.95], [0.66, 0.7]], true),
  path([[0.07, 0.48], [0.35, 0.48]]),
  path([[0.65, 0.48], [0.93, 0.48]]),
]

export const LEGS_SHORT: readonly GuideShape[] = [
  ellipse(0.26, 0.4, 0.2, 0.3),
  path([[0.04, 0.7], [0.48, 0.7], [0.48, 0.96], [0.04, 0.96]], true),
  ellipse(0.74, 0.4, 0.2, 0.3),
  path([[0.52, 0.7], [0.96, 0.7], [0.96, 0.96], [0.52, 0.96]], true),
]

export const ARM_LIMB: readonly GuideShape[] = [
  path([[0.3, 0.02], [0.68, 0.02], [0.74, 0.5], [0.66, 0.86], [0.34, 0.86], [0.28, 0.5]], true),
  path([[0.29, 0.46], [0.73, 0.46]]),
  ellipse(0.5, 0.9, 0.2, 0.1),
]

// ── 몸통 ────────────────────────────────────────────────────
export const BODY_BARREL: readonly GuideShape[] = [
  ellipse(0.5, 0.5, 0.48, 0.44),
  path([[0.1, 0.7], [0.5, 0.82], [0.9, 0.7]]),
  path([[0.74, 0.12], [0.82, 0.5]]),
]

export const BODY_UPRIGHT: readonly GuideShape[] = [
  path([[0.28, 0.04], [0.72, 0.04], [0.9, 0.5], [0.82, 0.96], [0.18, 0.96], [0.1, 0.5]], true),
  path([[0.3, 0.3], [0.7, 0.3]]),
  ellipse(0.5, 0.62, 0.24, 0.2),
]

export const BODY_ROUND: readonly GuideShape[] = [
  ellipse(0.5, 0.54, 0.46, 0.44),
  path([[0.22, 0.32], [0.5, 0.2], [0.8, 0.34]]),
]

export const BODY_STREAM: readonly GuideShape[] = [
  path([[0.02, 0.5], [0.3, 0.14], [0.72, 0.1], [0.98, 0.46], [0.72, 0.88], [0.28, 0.9]], true),
  path([[0.12, 0.52], [0.9, 0.46]]),
]

export const SHELL_DOME: readonly GuideShape[] = [
  path([[0.04, 0.7], [0.16, 0.26], [0.5, 0.06], [0.84, 0.26], [0.96, 0.7]], true),
  path([[0.04, 0.7], [0.5, 0.92], [0.96, 0.7]]),
  path([[0.3, 0.22], [0.34, 0.72]]),
  path([[0.7, 0.22], [0.66, 0.72]]),
  path([[0.1, 0.48], [0.9, 0.48]]),
]

// ── 머리 ────────────────────────────────────────────────────
export const HEAD_MUZZLE: readonly GuideShape[] = [
  path([[0.12, 0.98], [0.44, 0.98], [0.68, 0.44], [0.42, 0.32]], true),
  ellipse(0.6, 0.28, 0.28, 0.2),
  path([[0.72, 0.18], [0.98, 0.26], [0.94, 0.42], [0.7, 0.38]], true),
  path([[0.42, 0.16], [0.48, 0.02], [0.56, 0.16]], true),
  ellipse(0.58, 0.22, 0.05, 0.05),
]

export const HEAD_MANE: readonly GuideShape[] = [
  ellipse(0.5, 0.5, 0.48, 0.46),
  ellipse(0.54, 0.52, 0.3, 0.28),
  ellipse(0.6, 0.68, 0.16, 0.11),
  path([[0.26, 0.2], [0.32, 0.06], [0.42, 0.18]], true),
  path([[0.62, 0.18], [0.72, 0.06], [0.76, 0.2]], true),
  ellipse(0.44, 0.46, 0.05, 0.05),
  ellipse(0.66, 0.46, 0.05, 0.05),
]

export const HEAD_ROUND: readonly GuideShape[] = [
  ellipse(0.5, 0.48, 0.42, 0.44),
  ellipse(0.38, 0.42, 0.06, 0.06),
  ellipse(0.64, 0.42, 0.06, 0.06),
  ellipse(0.54, 0.68, 0.18, 0.13),
]

export const HEAD_EARS: readonly GuideShape[] = [
  path([[0.3, 0.52], [0.24, 0.04], [0.42, 0.04], [0.44, 0.5]], true),
  path([[0.58, 0.5], [0.6, 0.04], [0.78, 0.06], [0.72, 0.52]], true),
  ellipse(0.5, 0.74, 0.34, 0.24),
  ellipse(0.62, 0.7, 0.05, 0.05),
  ellipse(0.72, 0.82, 0.1, 0.08),
]

export const HEAD_BEAK: readonly GuideShape[] = [
  ellipse(0.4, 0.5, 0.36, 0.38),
  path([[0.7, 0.38], [0.99, 0.5], [0.7, 0.62]], true),
  path([[0.7, 0.5], [0.94, 0.5]]),
  ellipse(0.46, 0.4, 0.06, 0.06),
]

export const HEAD_SNOUT: readonly GuideShape[] = [
  path([[0.02, 0.18], [0.74, 0.28], [0.98, 0.46], [0.74, 0.68], [0.02, 0.76]], true),
  path([[0.06, 0.5], [0.92, 0.46]]),
  ellipse(0.2, 0.32, 0.07, 0.07),
]

export const HEAD_NECK: readonly GuideShape[] = [
  path([[0.2, 0.98], [0.5, 0.98], [0.62, 0.5], [0.34, 0.46]], true),
  ellipse(0.6, 0.32, 0.3, 0.26),
  ellipse(0.68, 0.26, 0.06, 0.06),
]

// ── 꼬리·날개·지느러미 ──────────────────────────────────────
export const TAIL_CURVE: readonly GuideShape[] = [
  path([[0.96, 0.16], [0.62, 0.26], [0.32, 0.48], [0.1, 0.8]]),
  path([[0.96, 0.4], [0.68, 0.48], [0.42, 0.64], [0.22, 0.9]]),
  ellipse(0.14, 0.86, 0.13, 0.11),
]

export const TAIL_FIN: readonly GuideShape[] = [
  path([[0.96, 0.5], [0.28, 0.04], [0.1, 0.5], [0.28, 0.96]], true),
  path([[0.9, 0.5], [0.34, 0.5]]),
]

export const WING_FAN: readonly GuideShape[] = [
  path([[0.9, 0.06], [0.2, 0.28], [0.06, 0.7], [0.5, 0.96], [0.92, 0.48]], true),
  path([[0.82, 0.18], [0.3, 0.64]]),
  path([[0.88, 0.38], [0.46, 0.86]]),
]

export const FIN_PAIR: readonly GuideShape[] = [
  path([[0.06, 0.36], [0.56, 0.04], [0.46, 0.44]], true),
  path([[0.3, 0.62], [0.94, 0.54], [0.66, 0.96]], true),
]
