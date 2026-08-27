/** 밸런스 수치 단일 출처. 매직 넘버는 전부 여기 모은다. */

export const DAY_DURATION_SEC = 180

export const PHASE_END = {
  DAY: 80,
  AFTERNOON: 130,
  NIGHT: DAY_DURATION_SEC,
} as const

export const START_GOLD = 200
export const START_REPUTATION = 0

export const ANIMAL_CREATE_COST = 50
export const ANIMAL_UPKEEP_PER_DAY = 8
export const TICKET_PRICE = 5
export const VIEW_INCOME_PER_APPEAL = 0.5

export const REPUTATION_PER_APPEAL = 0.1
export const OVERCROWD_THRESHOLD = 8
export const OVERCROWD_PENALTY = 2

export const MAX_ANIMALS_PER_ENCLOSURE = 12
export const MAX_VISITORS_PER_ENCLOSURE = 12

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
