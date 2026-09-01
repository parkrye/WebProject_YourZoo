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

/**
 * 값은 **캐시 하나를 쓰는 데 드는 비용**에서 거꾸로 잡았다.
 * 상세 요청은 외부 SDK 를 부르고, 한 번에 600원쯤 든다. 그 아래로 팔면 팔수록 손해다.
 *
 * 그래서 묶음 할인의 폭이 좁다. 단품 800원과 원가 600원 사이가 25% 뿐이라,
 * 큰 묶음에 큰 할인을 넣으면 마진이 금세 사라진다.
 *
 * 큰 묶음의 덤이 100 개에 +20 인 것은 그래서다. 작은 묶음과 같은 비율(+10)로 두면
 * 개당 718원 대 717원이 되어 **두 상품의 단가가 사실상 같아진다** —
 * 78,900원을 내고 개당 1원 아끼는 상품은 아무도 사지 않는다.
 */
export const CASH_PRODUCTS: readonly CashProduct[] = [
  // 개당 800원
  { id: 'SINGLE', krw: 800, cash: 1, bonus: 0 },
  // 개당 718원 (-10%)
  { id: 'BUNDLE', krw: 7900, cash: 10, bonus: 1 },
  // 개당 658원 (-18%). 원가 600원까지 58원 남는다.
  { id: 'STACK', krw: 78900, cash: 100, bonus: 20 },
]

export const productTotal = (product: CashProduct): number => product.cash + product.bonus

/**
 * 캐시 하나를 인게임 코인으로 바꿀 때의 환율.
 *
 * **한 방향뿐이다.** 코인으로 캐시를 살 수 있으면 캐시로만 되는 것(프레임 애니메이션)이
 * 시간만 들이면 공짜가 되고, 그러면 유료 재화라는 구분 자체가 사라진다.
 *
 * 1000 은 가장 비싸게 그리는 동물 한 마리(90) 의 열 배쯤이다. 캐시를 코인으로 쓰는
 * 사람이 손해 봤다고 느끼지 않을 만큼 넉넉하되, 캐시 본래 쓰임을 덮을 만큼은 아니다.
 */
export const CASH_TO_GOLD = 1000

/**
 * 상점에서 한 번에 살 수 있는 최대 수량.
 *
 * 소지금으로만 막으면 후반에 수백 마리를 한 번에 사게 되고, 그만큼의 사육비가
 * 다음 자정에 한꺼번에 빠진다. 살 수 있는 것과 감당할 수 있는 것은 다르다.
 */
export const SHOP_MAX_QUANTITY = 10

/** 동물 한 마리의 8x3 스프라이트 시트를 만드는 데 드는 캐시. */
export const SHEET_COST = 1

/**
 * 요청서를 열 수 있는지 보는 기준이자 값을 따로 주지 않았을 때의 기본값.
 * 가장 싼 방식(`ANIMAL_CRAFTS.SIMPLE`)과 같아야 한다 — 이보다 높으면
 * 정작 그릴 수 있는 값을 들고도 요청서가 열리지 않는다.
 */
export const ANIMAL_CREATE_COST = 20

/**
 * 팔 때 돌려받는 비율.
 *
 * **절반을 넘길 수 없다.** 넘기면 싼 방식으로 그려 파는 것이 그대로 돈을 찍는 일이 된다.
 * 얼마를 돌려주는지는 그 동물을 만든 방식에서 나온다 — `domain/shop` 의 `sellRefund`.
 */
export const ANIMAL_SELL_RATIO = 0.5

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

/**
 * 상점 동물 가격. 서식지를 가리지 않고 하나다.
 *
 * 예전에는 하늘 120 / 땅 100 / 물 150 으로 갈라 두었는데, 값의 차이가
 * "물이 귀하다"로 읽히지 않고 **어느 우리를 먼저 채울지 정해 주는 지시**로 읽혔다.
 * 어느 우리를 채울지는 값이 아니라 주인이 정하는 것이다.
 */
export const SHOP_ANIMAL_PRICE = 100

/** 상점 프롭 가격. 동물과 같은 이유로 층을 가리지 않는다. */
export const SHOP_PROP_PRICE = 50

/** 프롭을 팔 때 돌려받는 비율. 동물과 같이 절반이다. */
export const PROP_SELL_RATIO = 0.5

/** 우리 하나에 놓을 수 있는 프롭 수. 더 놓으면 동물이 다닐 자리가 없다. */
export const MAX_PROPS_PER_ENCLOSURE = 10

/**
 * 직접 그린 프롭의 제작비. 가장 싼 방식(`PROP_CRAFTS.SIMPLE`)과 같다.
 * 동물과 같은 이유로, 이 값이 실제 제작비보다 높으면 만들 수 있는데 못 만들게 된다.
 */
export const PROP_CREATE_COST = 8

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
/**
 * 손님 평가가 자정 정산의 명성에 더하는 몫.
 *
 * **작게 잡는다.** 명성은 여전히 매력도에서 나온다 — 평가가 그만큼 무거우면
 * 좋은 동물을 들이는 대신 손님 기분을 맞추는 놀이가 되고, 무엇보다 하루치
 * 표본이 몇 줄뿐이라 운이 명성을 흔든다. 전부 칭찬이어도 하루에 3 이다.
 */
export const REVIEW_REPUTATION_WEIGHT = 3
export const OVERCROWD_THRESHOLD = 8
export const OVERCROWD_PENALTY = 2

/**
 * 우리 정원의 **처음** 값. 골드를 들여 늘릴 수 있다.
 *
 * 매력도의 혼잡 계산은 늘린 정원이 아니라 이 값을 기준으로 둔다 —
 * 정원을 늘렸다고 같은 마릿수가 덜 붐비게 보일 이유는 없다.
 */
export const MAX_ANIMALS_PER_ENCLOSURE = 12

/** 한 번에 늘어나는 마릿수. */
export const ENCLOSURE_EXPAND_STEP = 2

/** 여기까지만 늘어난다. 우리 하나에 스무 마리면 화면이 이미 빽빽하다. */
export const MAX_ENCLOSURE_CAPACITY = 20

/** 정원을 처음 늘릴 때의 값. 한 단계 올라갈 때마다 이만큼씩 더 든다. */
const EXPAND_BASE_COST = 400

/**
 * 정원을 한 단계 늘리는 값.
 *
 * 늘릴수록 비싸진다. 같은 값으로 계속 늘릴 수 있으면 우리를 새로 여는 것보다
 * 한 우리를 키우는 쪽이 늘 싸져서, 사막도 얼음도 열 이유가 없어진다.
 */
export function expandCost(capacity: number): number {
  const steps = Math.max(0, Math.round((capacity - MAX_ANIMALS_PER_ENCLOSURE) / ENCLOSURE_EXPAND_STEP))
  return EXPAND_BASE_COST * (steps + 1)
}
export const MAX_VISITORS_PER_ENCLOSURE = 14
/**
 * 동물이 있는 우리의 최소 동시 관람객.
 *
 * 밤 배율이 0.15 라 명성이 낮으면 반올림해서 0 이 되고, 그러면 그 시간대에는
 * 수입이 통째로 끊긴다. 하루의 3분의 1 을 아무 일도 없는 시간으로 두면
 * 화면을 볼 이유가 없어진다. 한 명은 늘 있게 해서 기본 수입을 만든다.
 */
export const MIN_VISITORS = 1

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

/**
 * 우리를 여는 데 필요한 명성.
 *
 * 돈만으로 열게 두면 **동물원을 운영하지 않고도** 새 우리가 열린다 —
 * 수입은 시간에 비례해 들어오므로 화면만 켜 두면 언젠가 500 이 모인다.
 * 명성은 배치한 동물의 매력도에서만 오르므로, 실제로 우리를 채워야 넘는다.
 *
 * 하루 명성 증가분은 배치한 동물 매력도 합의 10% 다. 매력도 30 짜리 세 마리면
 * 하루 +9 — 사막은 사나흘, 얼음은 그 위로 한참 더 걸린다.
 */
export const UNLOCK_REPUTATION = {
  FIELD: 0,
  DESERT: 30,
  ICE: 100,
} as const

export const ANIMAL_NAME_MAX_LENGTH = 10
export const ENCLOSURE_NAME_MAX_LENGTH = 14
export const ZOO_NAME_MAX_LENGTH = 14
