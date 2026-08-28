/** 밸런스 수치 단일 출처. 매직 넘버는 전부 여기 모은다. */

export const DAY_DURATION_SEC = 180

export const PHASE_END = {
  DAY: 80,
  AFTERNOON: 130,
  NIGHT: DAY_DURATION_SEC,
} as const

export const START_GOLD = 200
/** 캐시(유료 재화) 시작 보유량. 상점에서 사야만 생긴다. */
export const START_CASH = 0
export const START_REPUTATION = 0

/**
 * 캐시 상품.
 *
 * 실제 결제는 하지 않는다 — 확인 팝업을 거치면 그냥 지급한다.
 * 덤은 총량에 합치지 않고 `10 + 1` 로 따로 적는다. 11 이라고만 쓰면
 * 묶음이 이득이라는 게 안 보인다. 이득은 숫자가 아니라 `+` 가 보여 준다.
 */
export interface CashProduct {
  readonly id: string
  readonly krw: number
  /** 값을 치르고 받는 몫 */
  readonly cash: number
  /** 덤으로 얹어 주는 몫 */
  readonly bonus: number
}

export const CASH_PRODUCTS: readonly CashProduct[] = [
  { id: 'SINGLE', krw: 500, cash: 1, bonus: 0 },
  { id: 'BUNDLE', krw: 5000, cash: 10, bonus: 1 },
]

export const productTotal = (product: CashProduct): number => product.cash + product.bonus

/** 동물 한 마리의 8x3 스프라이트 시트를 만드는 데 드는 캐시. */
export const SHEET_COST = 1

export const ANIMAL_CREATE_COST = 50
/** 동물을 판매할 때 제작비의 절반을 돌려준다. 잘못 만든 동물을 되돌릴 수 있어야 한다. */
export const ANIMAL_SELL_REFUND = Math.floor(ANIMAL_CREATE_COST / 2)

/**
 * 창고에 도착하기까지 걸리는 일수.
 *
 * 상점에서 산 건 이미 만들어져 있으니 하루면 온다.
 * 직접 그린 건 그림 하나로 동물을 빚어내는 셈이라 하루 더 걸린다 —
 * 기다림의 차이가 "만들어 달라고 맡긴 것"과 "사 온 것"을 구분한다.
 */
export const SHIPPING_DAYS = { SHOP: 1, DRAWN: 2 } as const

// ─────────────────────────────────────────────────────────────
// 상점 가격 (무료 재화)
// ─────────────────────────────────────────────────────────────

/** 상점 동물 가격. 서식지마다 다르다 — 물은 우리가 좁아 귀하게 매긴다. */
export const SHOP_ANIMAL_PRICE = { SKY: 120, LAND: 100, WATER: 150 } as const

/** 상점 프롭 가격. 물에 뜨는 프롭이 더 비싸다. */
export const SHOP_PROP_PRICE = { LAND: 40, WATER: 60 } as const

/** 프롭을 팔 때 돌려받는 비율. 동물과 같이 절반이다. */
export const PROP_SELL_RATIO = 0.5

/** 우리 하나에 놓을 수 있는 프롭 수. 더 놓으면 동물이 다닐 자리가 없다. */
export const MAX_PROPS_PER_ENCLOSURE = 10

/** 직접 그린 프롭의 제작비. */
export const PROP_CREATE_COST = 30

export const PROP_NAME_MAX_LENGTH = 10

export const ANIMAL_UPKEEP_PER_DAY = 8
/**
 * 창고 보관 사육비. 배치의 절반.
 * 공짜로 두면 적자를 피하려고 전부 창고에 넣어두는 플레이가 생기고,
 * 배치와 같게 두면 초반 소지금으로는 잠시 빼두는 것조차 버겁다.
 */
export const STORED_UPKEEP_PER_DAY = Math.floor(ANIMAL_UPKEEP_PER_DAY / 2)
export const TICKET_PRICE = 5
export const VIEW_INCOME_PER_APPEAL = 0.5

export const REPUTATION_PER_APPEAL = 0.1
export const OVERCROWD_THRESHOLD = 8
export const OVERCROWD_PENALTY = 2

export const MAX_ANIMALS_PER_ENCLOSURE = 12
export const MAX_VISITORS_PER_ENCLOSURE = 14

/**
 * 한 손님이 머무는 시간(초).
 *
 * 정해진 인원을 붙박이로 세워 두면 같은 사람이 계속 서 있는 게 눈에 띈다.
 * 저마다 들어왔다 나가게 두면 인원이 목표치 주위에서 오르내려 훨씬 북적인다.
 */
export const VISITOR_STAY_SEC = { min: 22, max: 65 } as const

/** 명성 → 동시 관람객 수 환산 계수 */
export const REPUTATION_PER_VISITOR = 10

export const VISITOR_PHASE_MULTIPLIER = {
  DAY: 1.0,
  AFTERNOON: 0.6,
  NIGHT: 0.15,
} as const

export const UNLOCK_COST = {
  FIELD: 0,
  DESERT: 500,
  ICE: 1500,
} as const

export const ANIMAL_NAME_MAX_LENGTH = 10
export const ZOO_NAME_MAX_LENGTH = 14
