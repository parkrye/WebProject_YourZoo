import type { MotionArchetype } from './motion'
import type { GuideShape } from './templates'
import * as G from './rigGuides'

/**
 * 리그 파츠 하나.
 *
 * 프레임을 24칸 그리는 것과 파츠를 대여섯 장 그리는 것의 차이는 **누가 움직이느냐**다.
 * 프레임은 사람이 칸마다 자세를 만들고, 리그는 사람이 부위만 그리면 기계가 움직인다.
 * 손은 훨씬 덜 가는데 결과는 통짜 변형보다 살아 있다 — 관절이 실제로 돌기 때문이다.
 */
export interface RigPart {
  readonly id: string
  /** 화면에 뜨는 이름. 무엇을 그려야 하는지 알려 준다. */
  readonly label: string
  /** 그림 상자의 가운데 (동물 전체 크기 대비 0..1). */
  readonly cx: number
  readonly cy: number
  /** 그림 상자의 크기 (동물 전체 크기 대비). */
  readonly w: number
  readonly h: number
  /**
   * 회전축. 상자 안에서의 위치(0..1)다.
   * 다리는 위쪽 끝(엉덩이), 머리는 아래쪽(목)이 축이다.
   */
  readonly px: number
  readonly py: number
  /** 그리는 순서. 작을수록 뒤. */
  readonly z: number
  /**
   * 이 부위의 밑그림. 좌표는 **파츠 상자를 꽉 채우도록** 잡혀 있다 —
   * 규격과 이유는 `rigGuides.ts` 에 적어 두었다.
   */
  readonly guide: readonly GuideShape[]
  readonly motion: RigMotion
}

/**
 * 파츠가 움직이는 방식.
 *
 * 전부 하나의 sin 파에서 나온다. 위상만 어긋내면 앞다리와 뒷다리가 엇갈리고,
 * 팔과 다리가 반대로 흔들린다 — 걸음이 걸음처럼 보이는 건 이 어긋남 덕분이다.
 */
export interface RigMotion {
  /** 회전 진폭(라디안). */
  readonly swing: number
  /** 위아래 흔들림 (동물 높이 대비). */
  readonly bob: number
  /** 좌우 흔들림 (동물 폭 대비). */
  readonly sway: number
  /** 한 걸음에 몇 번 흔들리는가. 1 이면 걸음과 같은 박자. */
  readonly beats: number
  /** 위상 어긋남 (0..1). 0.5 면 정확히 반대로 움직인다. */
  readonly phase: number
  /** 멈춰 있을 때도 이만큼은 움직인다. 숨쉬기다. */
  readonly idle: number
}

export interface RigSpec {
  readonly parts: readonly RigPart[]
}

const still = (idle = 0.15): RigMotion => ({ swing: 0, bob: 0.01, sway: 0, beats: 1, phase: 0, idle })

/**
 * 유형별 리그.
 *
 * 그려야 할 파츠 수는 넷에서 다섯이다. 더 잘게 쪼개면 그리는 일이 24칸만큼 힘들어져
 * 리그를 고를 이유가 없어진다.
 */
export const RIG_SPECS: Partial<Record<MotionArchetype, RigSpec>> = {
  TALL_QUADRUPED: {
    parts: [
      { id: 'BACK_LEG', label: 'BACK LEGS', cx: 0.38, cy: 0.76, w: 0.26, h: 0.42, px: 0.5, py: 0.05, guide: G.LEGS_PAIR, z: 0,
        motion: { swing: 0.55, bob: 0, sway: 0, beats: 1, phase: 0.5, idle: 0.06 } },
      { id: 'BODY', label: 'BODY', cx: 0.46, cy: 0.46, w: 0.62, h: 0.4, px: 0.5, py: 0.5, guide: G.BODY_BARREL, z: 1,
        motion: { swing: 0.03, bob: 0.02, sway: 0, beats: 2, phase: 0, idle: 0.35 } },
      { id: 'TAIL', label: 'TAIL', cx: 0.14, cy: 0.42, w: 0.2, h: 0.24, px: 0.9, py: 0.3, guide: G.TAIL_CURVE, z: 1,
        motion: { swing: 0.3, bob: 0, sway: 0, beats: 1, phase: 0.25, idle: 0.5 } },
      { id: 'FRONT_LEG', label: 'FRONT LEGS', cx: 0.6, cy: 0.76, w: 0.26, h: 0.42, px: 0.5, py: 0.05, guide: G.LEGS_PAIR, z: 2,
        motion: { swing: 0.55, bob: 0, sway: 0, beats: 1, phase: 0, idle: 0.06 } },
      { id: 'HEAD', label: 'HEAD AND NECK', cx: 0.76, cy: 0.24, w: 0.34, h: 0.4, px: 0.35, py: 0.9, guide: G.HEAD_MUZZLE, z: 3,
        motion: { swing: 0.09, bob: 0.02, sway: 0, beats: 1, phase: 0.15, idle: 0.4 } },
    ],
  },

  HEAVY_QUADRUPED: {
    parts: [
      { id: 'BACK_LEG', label: 'BACK LEGS', cx: 0.35, cy: 0.79, w: 0.26, h: 0.34, px: 0.5, py: 0.05, guide: G.LEGS_PAIR, z: 0,
        motion: { swing: 0.45, bob: 0, sway: 0, beats: 1, phase: 0.5, idle: 0.06 } },
      { id: 'BODY', label: 'BODY', cx: 0.44, cy: 0.52, w: 0.66, h: 0.4, px: 0.5, py: 0.5, guide: G.BODY_BARREL, z: 1,
        motion: { swing: 0.04, bob: 0.024, sway: 0.008, beats: 2, phase: 0, idle: 0.35 } },
      { id: 'TAIL', label: 'TAIL', cx: 0.1, cy: 0.46, w: 0.2, h: 0.22, px: 0.9, py: 0.3, guide: G.TAIL_CURVE, z: 1,
        motion: { swing: 0.26, bob: 0, sway: 0, beats: 1, phase: 0.3, idle: 0.5 } },
      { id: 'FRONT_LEG', label: 'FRONT LEGS', cx: 0.6, cy: 0.79, w: 0.26, h: 0.34, px: 0.5, py: 0.05, guide: G.LEGS_PAIR, z: 2,
        motion: { swing: 0.45, bob: 0, sway: 0, beats: 1, phase: 0, idle: 0.06 } },
      { id: 'HEAD', label: 'HEAD AND MANE', cx: 0.76, cy: 0.4, w: 0.38, h: 0.42, px: 0.3, py: 0.7, guide: G.HEAD_MANE, z: 3,
        motion: { swing: 0.07, bob: 0.02, sway: 0, beats: 1, phase: 0.2, idle: 0.4 } },
    ],
  },

  UPRIGHT_BIPED: {
    parts: [
      { id: 'BACK_ARM', label: 'FAR ARM', cx: 0.36, cy: 0.5, w: 0.2, h: 0.4, px: 0.5, py: 0.1, guide: G.ARM_LIMB, z: 0,
        motion: { swing: 0.5, bob: 0, sway: 0, beats: 1, phase: 0, idle: 0.1 } },
      { id: 'LEG', label: 'LEGS', cx: 0.5, cy: 0.8, w: 0.3, h: 0.36, px: 0.5, py: 0.08, guide: G.LEGS_PAIR, z: 1,
        motion: { swing: 0.45, bob: 0, sway: 0, beats: 1, phase: 0.5, idle: 0.06 } },
      { id: 'BODY', label: 'BODY', cx: 0.5, cy: 0.5, w: 0.34, h: 0.42, px: 0.5, py: 0.9, guide: G.BODY_UPRIGHT, z: 2,
        motion: { swing: 0.04, bob: 0.03, sway: 0.01, beats: 2, phase: 0, idle: 0.4 } },
      { id: 'HEAD', label: 'HEAD', cx: 0.52, cy: 0.2, w: 0.3, h: 0.28, px: 0.5, py: 0.95, guide: G.HEAD_ROUND, z: 3,
        motion: { swing: 0.08, bob: 0.02, sway: 0, beats: 1, phase: 0.2, idle: 0.45 } },
      { id: 'FRONT_ARM', label: 'NEAR ARM', cx: 0.64, cy: 0.5, w: 0.2, h: 0.4, px: 0.5, py: 0.1, guide: G.ARM_LIMB, z: 4,
        motion: { swing: 0.5, bob: 0, sway: 0, beats: 1, phase: 0.5, idle: 0.1 } },
    ],
  },

  WADDLER: {
    parts: [
      { id: 'BACK_WING', label: 'FAR WING', cx: 0.3, cy: 0.54, w: 0.16, h: 0.34, px: 0.6, py: 0.1, guide: G.WING_FAN, z: 0,
        motion: { swing: 0.34, bob: 0, sway: 0, beats: 2, phase: 0, idle: 0.3 } },
      { id: 'LEG', label: 'FEET', cx: 0.5, cy: 0.9, w: 0.32, h: 0.14, px: 0.5, py: 0.1, guide: G.LEGS_SHORT, z: 1,
        motion: { swing: 0.16, bob: 0, sway: 0.01, beats: 1, phase: 0.5, idle: 0.06 } },
      { id: 'BODY', label: 'BODY', cx: 0.5, cy: 0.55, w: 0.44, h: 0.56, px: 0.5, py: 0.95, guide: G.BODY_UPRIGHT, z: 2,
        // 뒤뚱거림은 몸통이 통째로 기우는 것이다. 다리가 아니라 여기가 크게 돈다.
        motion: { swing: 0.2, bob: 0.012, sway: 0, beats: 1, phase: 0, idle: 0.25 } },
      { id: 'HEAD', label: 'HEAD', cx: 0.5, cy: 0.2, w: 0.3, h: 0.26, px: 0.5, py: 0.95, guide: G.HEAD_BEAK, z: 3,
        motion: { swing: 0.16, bob: 0.015, sway: 0, beats: 1, phase: 0.12, idle: 0.3 } },
      { id: 'FRONT_WING', label: 'NEAR WING', cx: 0.7, cy: 0.54, w: 0.16, h: 0.34, px: 0.4, py: 0.1, guide: G.WING_FAN, z: 4,
        motion: { swing: 0.34, bob: 0, sway: 0, beats: 2, phase: 0.5, idle: 0.3 } },
    ],
  },

  SMALL_HOPPER: {
    parts: [
      { id: 'BACK_LEG', label: 'BACK LEGS', cx: 0.36, cy: 0.8, w: 0.28, h: 0.3, px: 0.5, py: 0.1, guide: G.LEGS_PAIR, z: 0,
        motion: { swing: 0.4, bob: 0.03, sway: 0, beats: 1, phase: 0, idle: 0.08 } },
      { id: 'BODY', label: 'BODY', cx: 0.46, cy: 0.58, w: 0.46, h: 0.42, px: 0.5, py: 0.8, guide: G.BODY_ROUND, z: 1,
        motion: { swing: 0.05, bob: 0.06, sway: 0, beats: 1, phase: 0.1, idle: 0.3 } },
      { id: 'HEAD', label: 'HEAD AND EARS', cx: 0.68, cy: 0.28, w: 0.36, h: 0.46, px: 0.4, py: 0.9, guide: G.HEAD_EARS, z: 2,
        motion: { swing: 0.12, bob: 0.05, sway: 0, beats: 1, phase: 0.16, idle: 0.35 } },
      { id: 'FRONT_LEG', label: 'FRONT PAWS', cx: 0.62, cy: 0.82, w: 0.2, h: 0.24, px: 0.5, py: 0.1, guide: G.LEGS_SHORT, z: 3,
        motion: { swing: 0.3, bob: 0.03, sway: 0, beats: 1, phase: 0.4, idle: 0.08 } },
    ],
  },

  BROAD_WING: {
    parts: [
      { id: 'BACK_WING', label: 'FAR WING', cx: 0.36, cy: 0.4, w: 0.4, h: 0.36, px: 0.85, py: 0.4, guide: G.WING_FAN, z: 0,
        motion: { swing: 0.9, bob: 0.02, sway: 0, beats: 1, phase: 0.06, idle: 0.5 } },
      { id: 'TAIL', label: 'TAIL', cx: 0.24, cy: 0.72, w: 0.28, h: 0.3, px: 0.85, py: 0.2, guide: G.TAIL_FIN, z: 1,
        motion: { swing: 0.22, bob: 0, sway: 0, beats: 1, phase: 0.3, idle: 0.5 } },
      { id: 'BODY', label: 'BODY', cx: 0.5, cy: 0.52, w: 0.34, h: 0.46, px: 0.5, py: 0.5, guide: G.BODY_ROUND, z: 2,
        motion: { swing: 0.05, bob: 0.05, sway: 0, beats: 1, phase: 0, idle: 0.5 } },
      { id: 'HEAD', label: 'HEAD AND BEAK', cx: 0.68, cy: 0.24, w: 0.32, h: 0.3, px: 0.35, py: 0.9, guide: G.HEAD_BEAK, z: 3,
        motion: { swing: 0.07, bob: 0.03, sway: 0, beats: 1, phase: 0.1, idle: 0.5 } },
      { id: 'FRONT_WING', label: 'NEAR WING', cx: 0.6, cy: 0.4, w: 0.4, h: 0.36, px: 0.15, py: 0.4, guide: G.WING_FAN, z: 4,
        motion: { swing: 0.9, bob: 0.02, sway: 0, beats: 1, phase: 0, idle: 0.5 } },
    ],
  },

  ROUND_BIRD: {
    parts: [
      { id: 'BACK_WING', label: 'FAR WING', cx: 0.34, cy: 0.5, w: 0.3, h: 0.34, px: 0.85, py: 0.3, guide: G.WING_FAN, z: 0,
        motion: { swing: 0.6, bob: 0.02, sway: 0, beats: 1, phase: 0.06, idle: 0.45 } },
      { id: 'BODY', label: 'BODY', cx: 0.5, cy: 0.58, w: 0.44, h: 0.5, px: 0.5, py: 0.5, guide: G.BODY_ROUND, z: 1,
        motion: { swing: 0.03, bob: 0.06, sway: 0, beats: 1, phase: 0, idle: 0.5 } },
      { id: 'HEAD', label: 'HEAD', cx: 0.5, cy: 0.24, w: 0.42, h: 0.34, px: 0.5, py: 0.95, guide: G.HEAD_BEAK, z: 2,
        motion: { swing: 0.06, bob: 0.03, sway: 0.006, beats: 1, phase: 0.12, idle: 0.5 } },
      { id: 'FRONT_WING', label: 'NEAR WING', cx: 0.66, cy: 0.5, w: 0.3, h: 0.34, px: 0.15, py: 0.3, guide: G.WING_FAN, z: 3,
        motion: { swing: 0.6, bob: 0.02, sway: 0, beats: 1, phase: 0, idle: 0.45 } },
    ],
  },

  STREAMLINED: {
    parts: [
      { id: 'TAIL', label: 'TAIL FIN', cx: 0.14, cy: 0.5, w: 0.26, h: 0.42, px: 0.95, py: 0.5, guide: G.TAIL_FIN, z: 0,
        motion: { swing: 0.45, bob: 0, sway: 0, beats: 1, phase: 0.35, idle: 0.6 } },
      { id: 'BODY', label: 'BODY', cx: 0.52, cy: 0.5, w: 0.62, h: 0.4, px: 0.5, py: 0.5, guide: G.BODY_STREAM, z: 1,
        motion: { swing: 0.07, bob: 0.02, sway: 0, beats: 1, phase: 0, idle: 0.6 } },
      { id: 'FIN', label: 'FINS', cx: 0.5, cy: 0.28, w: 0.28, h: 0.22, px: 0.5, py: 0.95, guide: G.FIN_PAIR, z: 2,
        motion: { swing: 0.2, bob: 0, sway: 0, beats: 2, phase: 0.2, idle: 0.6 } },
      { id: 'HEAD', label: 'HEAD', cx: 0.8, cy: 0.5, w: 0.26, h: 0.34, px: 0.2, py: 0.5, guide: G.HEAD_SNOUT, z: 3,
        motion: { swing: 0.06, bob: 0.012, sway: 0, beats: 1, phase: 0.1, idle: 0.6 } },
    ],
  },

  LOW_CRAWLER: {
    parts: [
      { id: 'LEG', label: 'LEGS', cx: 0.44, cy: 0.78, w: 0.5, h: 0.2, px: 0.5, py: 0.1, guide: G.LEGS_SHORT, z: 0,
        motion: { swing: 0.3, bob: 0, sway: 0, beats: 1, phase: 0.5, idle: 0.08 } },
      { id: 'TAIL', label: 'TAIL', cx: 0.12, cy: 0.6, w: 0.26, h: 0.2, px: 0.95, py: 0.5, guide: G.TAIL_CURVE, z: 1,
        motion: { swing: 0.34, bob: 0, sway: 0, beats: 1, phase: 0.3, idle: 0.5 } },
      { id: 'BODY', label: 'BODY', cx: 0.46, cy: 0.58, w: 0.6, h: 0.26, px: 0.5, py: 0.5, guide: G.BODY_BARREL, z: 2,
        motion: { swing: 0.04, bob: 0.014, sway: 0, beats: 1, phase: 0, idle: 0.4 } },
      { id: 'HEAD', label: 'HEAD AND JAWS', cx: 0.82, cy: 0.56, w: 0.3, h: 0.22, px: 0.15, py: 0.5, guide: G.HEAD_SNOUT, z: 3,
        motion: { swing: 0.05, bob: 0.01, sway: 0, beats: 1, phase: 0.15, idle: 0.4 } },
    ],
  },

  SHELLED: {
    parts: [
      { id: 'BACK_LEG', label: 'BACK FEET', cx: 0.34, cy: 0.8, w: 0.22, h: 0.2, px: 0.5, py: 0.1, guide: G.LEGS_SHORT, z: 0,
        motion: { swing: 0.34, bob: 0, sway: 0, beats: 1, phase: 0.5, idle: 0.1 } },
      { id: 'BODY', label: 'SHELL', cx: 0.46, cy: 0.5, w: 0.58, h: 0.42, px: 0.5, py: 0.6, guide: G.SHELL_DOME, z: 1,
        motion: { swing: 0.02, bob: 0.014, sway: 0, beats: 1, phase: 0, idle: 0.3 } },
      { id: 'FRONT_LEG', label: 'FRONT FEET', cx: 0.6, cy: 0.8, w: 0.22, h: 0.2, px: 0.5, py: 0.1, guide: G.LEGS_SHORT, z: 2,
        motion: { swing: 0.34, bob: 0, sway: 0, beats: 1, phase: 0, idle: 0.1 } },
      { id: 'HEAD', label: 'HEAD AND NECK', cx: 0.82, cy: 0.6, w: 0.26, h: 0.24, px: 0.15, py: 0.6, guide: G.HEAD_NECK, z: 3,
        motion: { swing: 0.1, bob: 0.02, sway: 0.01, beats: 1, phase: 0.2, idle: 0.4 } },
    ],
  },

  /** 템플릿 없이 리그를 고른 경우. 몸과 머리, 다리만 나눈다. */
  FREE: {
    parts: [
      { id: 'LEG', label: 'LEGS', cx: 0.5, cy: 0.82, w: 0.44, h: 0.3, px: 0.5, py: 0.1, guide: G.LEGS_PAIR, z: 0,
        motion: { swing: 0.34, bob: 0, sway: 0, beats: 1, phase: 0.5, idle: 0.08 } },
      { id: 'BODY', label: 'BODY', cx: 0.5, cy: 0.52, w: 0.56, h: 0.5, px: 0.5, py: 0.8, guide: G.BODY_ROUND, z: 1,
        motion: { swing: 0.04, bob: 0.025, sway: 0, beats: 2, phase: 0, idle: 0.35 } },
      { id: 'HEAD', label: 'HEAD', cx: 0.56, cy: 0.22, w: 0.36, h: 0.32, px: 0.45, py: 0.9, guide: G.HEAD_ROUND, z: 2,
        motion: { swing: 0.08, bob: 0.02, sway: 0, beats: 1, phase: 0.15, idle: 0.4 } },
    ],
  },
}

/** 이 유형으로 리그를 만들 수 있는가. */
export function rigOf(archetype: MotionArchetype): RigSpec {
  return RIG_SPECS[archetype] ?? (RIG_SPECS.FREE as RigSpec)
}

export { still as STILL_MOTION }
