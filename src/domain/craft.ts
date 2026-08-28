/**
 * 만드는 방식.
 *
 * 값이 클수록 손이 많이 가고, 그만큼 화면에서 살아 움직인다.
 * 값싼 쪽을 없애지 않는 이유는 **그림 한 장으로도 놀 수 있어야** 하기 때문이다 —
 * 24프레임을 그려야만 동물을 가질 수 있다면 대부분은 시작조차 못 한다.
 */
export type AnimalCraft = 'SIMPLE' | 'TEMPLATE' | 'RIG' | 'FRAMES' | 'COMMISSION'
export type PropCraft = 'SIMPLE' | 'TEMPLATE' | 'DETAILED'

export interface CraftSpec {
  /** 화면에 뜨는 이름. 영문 대문자 — 폰트 제약. */
  readonly label: string
  /** 한 줄 설명. */
  readonly hint: string
  /** 코인 값. `COMMISSION` 은 캐시를 쓰므로 0. */
  readonly coins: number
  /** 캐시 값. 코인으로 사는 것은 0. */
  readonly cash: number
  /** 그려야 하는 칸 수. */
  readonly frames: number
  /** 아직 못 여는 것. 있다는 사실만 보여 준다. */
  readonly locked?: boolean
}

/** 상세 그리기의 규격. 시트와 같은 8프레임 x 3모션이다. */
export const DETAIL_COLS = 8
export const DETAIL_ROWS = 3
/** 상세 프롭은 한 줄만 그린다. 프롭에는 걷기도 필살기도 없다. */
export const PROP_DETAIL_FRAMES = 8

export const ANIMAL_CRAFTS: Record<AnimalCraft, CraftSpec> = {
  SIMPLE: {
    label: 'SIMPLE',
    hint: 'BLANK CANVAS  DEFAULT MOTION',
    coins: 40,
    cash: 0,
    frames: 1,
  },
  TEMPLATE: {
    label: 'TEMPLATE',
    hint: 'DRAW OVER A SHAPE  MATCHING MOTION',
    coins: 90,
    cash: 0,
    frames: 1,
  },
  /**
   * 부위만 그리면 기계가 관절로 돌린다.
   *
   * 24칸을 그리는 것과의 차이는 **누가 움직이느냐**다. 손은 훨씬 덜 가는데
   * 결과는 통짜 변형보다 살아 있다 — 다리가 엉덩이를 축으로 실제로 돌기 때문이다.
   */
  RIG: {
    label: 'RIGGED',
    hint: 'DRAW EACH BODY PART  JOINTS DO THE REST',
    coins: 150,
    cash: 0,
    frames: 5,
  },
  FRAMES: {
    label: 'FRAME BY FRAME',
    hint: 'DRAW ALL 24 FRAMES YOURSELF',
    coins: 240,
    cash: 0,
    frames: DETAIL_COLS * DETAIL_ROWS,
  },
  COMMISSION: {
    label: 'COMMISSION',
    hint: 'ONE DRAWING  WE ANIMATE IT  COMING SOON',
    coins: 0,
    cash: 3,
    frames: 1,
    // 외부 SDK 가 아직 없다. 자리는 보여 주되 누를 수는 없다 —
    // 있다는 걸 알아야 나중에 열렸을 때 찾는다.
    locked: true,
  },
}

export const PROP_CRAFTS: Record<PropCraft, CraftSpec> = {
  SIMPLE: {
    label: 'SIMPLE',
    hint: 'ONE DRAWING  STANDS STILL',
    coins: 15,
    cash: 0,
    frames: 1,
  },
  TEMPLATE: {
    label: 'TEMPLATE',
    hint: 'DRAW OVER A SHAPE',
    coins: 35,
    cash: 0,
    frames: 1,
  },
  DETAILED: {
    label: 'DETAILED',
    hint: 'DRAW 8 FRAMES  IT ANIMATES',
    coins: 90,
    cash: 0,
    frames: PROP_DETAIL_FRAMES,
  },
}

export const ANIMAL_CRAFT_ORDER: readonly AnimalCraft[] = [
  'SIMPLE', 'TEMPLATE', 'RIG', 'FRAMES', 'COMMISSION',
]
export const PROP_CRAFT_ORDER: readonly PropCraft[] = ['SIMPLE', 'TEMPLATE', 'DETAILED']

/** 상세 그리기 칸의 행 이름. 순서가 곧 시트의 행이다. */
export const DETAIL_ROW_LABELS = ['IDLE', 'MOVE', 'SIGNATURE'] as const
