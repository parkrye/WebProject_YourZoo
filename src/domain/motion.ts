/**
 * 외형 유형별 움직임 규격.
 *
 * 템플릿을 골라 그렸다는 건 **어느 위치에 어느 부위가 있는지 약속했다**는 뜻이다.
 * 그 약속을 이용하면 통짜 변형보다 훨씬 그럴듯하게 움직일 수 있다.
 *
 * 다만 그림을 파츠로 잘라 붙이지는 않는다 — 사람이 그린 경계는 제각각이라 이음매가 드러난다.
 * 대신 이미지를 **띠(band)로 나누고 띠마다 다른 변형을 준다.** 자르는 게 아니라 미는 것이라
 * 이음매가 생기지 않으면서도 "다리만 흔들리고 몸통은 가만히 있는" 그림이 나온다.
 */

/** 띠를 어느 축으로 나눌지. */
export type BandAxis =
  /** 세로로 썰어 좌우 방향 진행파를 만든다. 헤엄·기어가기 */
  | 'COLUMN'
  /** 가로로 썰어 위아래 부위를 따로 움직인다. 다리·날개 */
  | 'ROW'

export interface BandMotion {
  readonly axis: BandAxis
  /** 이 띠 효과가 적용되는 범위 (0..1). ROW 는 위에서부터, COLUMN 은 왼쪽부터. */
  readonly from: number
  readonly to: number
  /** 좌우로 미는 양 (그림 폭 대비) */
  readonly swayX: number
  /** 위아래로 미는 양 (그림 높이 대비) */
  readonly swayY: number
  /** 세로로 늘였다 줄이는 양. 날갯짓에 쓴다. */
  readonly stretchY: number
  /** 범위 전체에 걸치는 파장 수. 0 이면 범위가 통째로 같이 움직인다. */
  readonly cycles: number
  readonly speed: number
  /** 좌우/앞뒤 짝을 엇갈리게 한다. 네발 걸음처럼 */
  readonly alternate: boolean
}

export interface MotionProfile {
  /** 상하 보빙 진폭 (그림 높이 대비) */
  readonly bob: number
  readonly bobSpeed: number
  /** 진행 방향으로 기우는 각도(라디안) */
  readonly lean: number
  /** 숨쉬기·착지에 따른 세로 눌림 */
  readonly squash: number
  /** 부위별 띠 움직임. 없으면 통짜로만 움직인다. */
  readonly bands: readonly BandMotion[]
}

const NONE: readonly BandMotion[] = []

/**
 * 그림 유형.
 * 라벨은 대표 동물이지만 실제 기준은 **실루엣의 생김새**다 —
 * 긴 다리 네발, 작고 둥근 몸, 낮고 긴 몸통, 큰 날개, 둥근 새, 유선형, 등껍질.
 */
export type MotionArchetype =
  | 'FREE'
  | 'TALL_QUADRUPED'
  | 'SMALL_HOPPER'
  | 'LOW_CRAWLER'
  | 'BROAD_WING'
  | 'ROUND_BIRD'
  | 'STREAMLINED'
  | 'SHELLED'
  | 'HEAVY_QUADRUPED'
  | 'UPRIGHT_BIPED'
  | 'WADDLER'

export const MOTION_PROFILES: Record<MotionArchetype, MotionProfile> = {
  /** 템플릿 없이 그린 그림. 어떤 형태가 올지 모르니 무난한 숨쉬기와 기울기만. */
  FREE: {
    bob: 0.03,
    bobSpeed: 3.4,
    lean: 0.09,
    squash: 0.04,
    bands: [
      // 아래쪽 절반만 살짝 흔들어 "무언가 움직인다"는 느낌은 준다.
      { axis: 'ROW', from: 0.55, to: 1, swayX: 0.04, swayY: 0, stretchY: 0, cycles: 0, speed: 6, alternate: true },
    ],
  },

  /** 사슴·말처럼 다리가 길고 몸통이 높은 형태. 걸음이 크고 또렷하다. */
  TALL_QUADRUPED: {
    bob: 0.045,
    bobSpeed: 6.2,
    lean: 0.08,
    squash: 0.05,
    bands: [
      // 다리: 앞뒤가 엇갈리게 흔들린다
      { axis: 'ROW', from: 0.58, to: 1, swayX: 0.13, swayY: 0, stretchY: 0, cycles: 1.2, speed: 6.2, alternate: true },
      // 목과 머리는 걸음보다 반 박자 느리게 끄덕인다
      { axis: 'ROW', from: 0, to: 0.32, swayX: 0.035, swayY: 0.02, stretchY: 0, cycles: 0, speed: 3.1, alternate: false },
    ],
  },

  /** 토끼처럼 작고 둥근 몸. 걷지 않고 통통 튄다. */
  SMALL_HOPPER: {
    bob: 0.11,
    bobSpeed: 8.4,
    lean: 0.05,
    squash: 0.12,
    bands: [
      // 착지할 때 아랫부분이 먼저 눌린다
      { axis: 'ROW', from: 0.6, to: 1, swayX: 0.03, swayY: 0.03, stretchY: 0.1, cycles: 0, speed: 8.4, alternate: false },
      // 귀는 뒤늦게 따라 흔들린다
      { axis: 'ROW', from: 0, to: 0.28, swayX: 0.07, swayY: 0, stretchY: 0, cycles: 0, speed: 7.6, alternate: false },
    ],
  },

  /** 악어·도마뱀처럼 낮고 긴 몸통. 몸 전체가 좌우로 굽이친다. */
  LOW_CRAWLER: {
    bob: 0.012,
    bobSpeed: 2.4,
    lean: 0.03,
    squash: 0.02,
    bands: [
      { axis: 'COLUMN', from: 0, to: 1, swayX: 0, swayY: 0.05, stretchY: 0, cycles: 1.5, speed: 3.4, alternate: false },
      // 짧은 다리가 몸통 아래에서 종종거린다
      { axis: 'ROW', from: 0.7, to: 1, swayX: 0.06, swayY: 0, stretchY: 0, cycles: 1, speed: 7, alternate: true },
    ],
  },

  /** 앵무새처럼 날개가 큰 새. 날갯짓이 빠르고 크다. */
  BROAD_WING: {
    bob: 0.05,
    bobSpeed: 9,
    lean: 0.13,
    squash: 0.03,
    bands: [
      // 날개: 몸통 위쪽이 크게 위아래로 늘었다 줄었다
      { axis: 'ROW', from: 0, to: 0.5, swayX: 0.05, swayY: 0.06, stretchY: 0.22, cycles: 0, speed: 9.5, alternate: false },
      // 꼬리깃은 아래에서 천천히 나부낀다
      { axis: 'ROW', from: 0.72, to: 1, swayX: 0.09, swayY: 0, stretchY: 0, cycles: 0.6, speed: 4.6, alternate: false },
    ],
  },

  /** 올빼미처럼 몸이 둥글고 날개가 짧은 새. 크고 느리게 난다. */
  ROUND_BIRD: {
    bob: 0.075,
    bobSpeed: 4.8,
    lean: 0.07,
    squash: 0.05,
    bands: [
      { axis: 'ROW', from: 0.28, to: 0.72, swayX: 0.06, swayY: 0.04, stretchY: 0.13, cycles: 0, speed: 5, alternate: false },
    ],
  },

  /** 물고기·돌고래처럼 유선형. 꼬리에서 머리로 파동이 흐른다. */
  STREAMLINED: {
    bob: 0.014,
    bobSpeed: 2.2,
    lean: 0.04,
    squash: 0.02,
    bands: [
      { axis: 'COLUMN', from: 0, to: 1, swayX: 0, swayY: 0.085, stretchY: 0, cycles: 1.15, speed: 7, alternate: false },
    ],
  },

  /** 거북처럼 등껍질이 단단한 형태. 몸통은 거의 움직이지 않고 네 다리만 젓는다. */
  SHELLED: {
    bob: 0.022,
    bobSpeed: 2.3,
    lean: 0.025,
    squash: 0.015,
    bands: [
      { axis: 'ROW', from: 0.62, to: 1, swayX: 0.1, swayY: 0.015, stretchY: 0, cycles: 1, speed: 3.6, alternate: true },
      { axis: 'ROW', from: 0, to: 0.25, swayX: 0.03, swayY: 0.012, stretchY: 0, cycles: 0, speed: 2.2, alternate: false },
    ],
  },

  /**
   * 사자·곰처럼 무겁고 낮은 네발. 사슴과 같은 네발이지만 **박자가 다르다** —
   * 보폭이 크고 느리며 몸통이 좌우로 묵직하게 흔들린다.
   */
  HEAVY_QUADRUPED: {
    bob: 0.028,
    bobSpeed: 4.2,
    lean: 0.05,
    squash: 0.035,
    bands: [
      // 다리: 사슴보다 낮고 크게 내딛는다
      { axis: 'ROW', from: 0.62, to: 1, swayX: 0.16, swayY: 0.012, stretchY: 0, cycles: 1, speed: 4.2, alternate: true },
      // 어깨와 갈기가 걸음에 맞춰 묵직하게 흔들린다
      { axis: 'ROW', from: 0, to: 0.36, swayX: 0.05, swayY: 0.025, stretchY: 0, cycles: 0, speed: 4.2, alternate: false },
      // 꼬리
      { axis: 'ROW', from: 0.4, to: 0.62, swayX: 0.07, swayY: 0, stretchY: 0, cycles: 0.8, speed: 2.6, alternate: false },
    ],
  },

  /** 원숭이처럼 서서 걷고 팔이 긴 형태. 팔과 다리가 서로 엇갈린다. */
  UPRIGHT_BIPED: {
    bob: 0.05,
    bobSpeed: 5.4,
    lean: 0.06,
    squash: 0.05,
    bands: [
      // 두 다리
      { axis: 'ROW', from: 0.66, to: 1, swayX: 0.12, swayY: 0, stretchY: 0, cycles: 0, speed: 5.4, alternate: true },
      // 팔은 다리와 반대로 흔들린다. 속도를 같게 두고 방향만 엇갈리게 한다
      { axis: 'ROW', from: 0.26, to: 0.55, swayX: 0.1, swayY: 0.015, stretchY: 0, cycles: 0, speed: 5.4, alternate: true },
      // 머리는 걸음마다 살짝 끄덕인다
      { axis: 'ROW', from: 0, to: 0.24, swayX: 0.025, swayY: 0.02, stretchY: 0, cycles: 0, speed: 5.4, alternate: false },
    ],
  },

  /** 펭귄처럼 서서 뒤뚱거리는 형태. 다리는 거의 안 보이고 몸통이 통째로 기운다. */
  WADDLER: {
    bob: 0.035,
    bobSpeed: 3.6,
    lean: 0.16,
    squash: 0.04,
    bands: [
      // 짧은 다리
      { axis: 'ROW', from: 0.82, to: 1, swayX: 0.07, swayY: 0, stretchY: 0, cycles: 0, speed: 3.6, alternate: true },
      // 지느러미 같은 날개가 몸 옆에서 파닥인다
      { axis: 'ROW', from: 0.32, to: 0.68, swayX: 0.06, swayY: 0.02, stretchY: 0.05, cycles: 0, speed: 7.2, alternate: false },
    ],
  },
}

export { NONE as NO_BANDS }
