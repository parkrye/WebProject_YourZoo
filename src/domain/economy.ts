import type { BiomeId, SkyPhase } from '@/assets/manifest'
import { clamp } from '@/core/math'
import { placedIn, type Animal } from './animal'
import {
  ANIMAL_UPKEEP_PER_DAY, DAY_DURATION_SEC, MAX_VISITORS_PER_ENCLOSURE, OVERCROWD_PENALTY,
  OVERCROWD_THRESHOLD, PHASE_END, REPUTATION_PER_APPEAL, REPUTATION_PER_VISITOR,
  MIN_VISITORS_WITH_ANIMALS,
  STORED_UPKEEP_PER_DAY, TICKET_PRICE, VIEW_INCOME_PER_APPEAL, VISITOR_PHASE_MULTIPLIER,
} from './balance'

/**
 * 명성과 시간대로부터 해당 우리의 동시 관람객 수를 구한다.
 *
 * 동물이 한 마리라도 있으면 **최소 한 명은 온다.** 밤에는 배율이 0.15 라
 * 반올림하면 0 이 되는데, 그러면 그 시간대에는 수입이 통째로 끊긴다 —
 * 하루의 3분의 1 을 아무 일도 일어나지 않는 시간으로 두면 볼 이유가 없어진다.
 */
export function visitorCount(reputation: number, phase: SkyPhase, hasAnimals: boolean): number {
  if (!hasAnimals) return 0
  const scaled = baseVisitors(reputation) * VISITOR_PHASE_MULTIPLIER[phase]
  return clamp(Math.round(scaled), MIN_VISITORS_WITH_ANIMALS, MAX_VISITORS_PER_ENCLOSURE)
}

function baseVisitors(reputation: number): number {
  return Math.floor(reputation / REPUTATION_PER_VISITOR) + 1
}

/**
 * 하루 전체의 시간대 배율 평균.
 * 낮이 길고 밤이 한산하므로 단순 평균이 아니라 **구간 길이로 가중**해야 한다.
 */
export function averageVisitorMultiplier(): number {
  const day = PHASE_END.DAY
  const afternoon = PHASE_END.AFTERNOON - PHASE_END.DAY
  const night = PHASE_END.NIGHT - PHASE_END.AFTERNOON
  const weighted =
    day * VISITOR_PHASE_MULTIPLIER.DAY +
    afternoon * VISITOR_PHASE_MULTIPLIER.AFTERNOON +
    night * VISITOR_PHASE_MULTIPLIER.NIGHT
  return weighted / DAY_DURATION_SEC
}

export interface DailyReport {
  day: number
  /** 입장료 수입 */
  ticketIncome: number
  /** 동물 매력도에서 오는 관람 수입 */
  viewIncome: number
  /** 사육비 지출 */
  upkeep: number
  /** 수입 − 지출 */
  net: number
  reputationDelta: number
  /** 하루 평균 관람객 합계 */
  visitors: number
  /** 우리에 배치된 동물 수 */
  animalCount: number
  /** 창고 보관 수 */
  storedCount: number
  /** 이 정산으로 창고에 도착한 수 */
  arrivedCount: number
}

export interface SettleInput {
  day: number
  animals: readonly Animal[]
  unlocked: readonly BiomeId[]
  reputation: number
  /** 이 정산에서 배송이 완료된 동물 수. 리포트 표시용. */
  arrivedCount?: number
}

/**
 * 자정 정산. 하루치 수지와 명성 변화를 계산한다.
 * @see docs/00-overview.md §4.3
 */
export function settleDay({
  day, animals, unlocked, reputation, arrivedCount = 0,
}: SettleInput): DailyReport {
  const multiplier = averageVisitorMultiplier()

  let ticketIncome = 0
  let visitors = 0
  let overcrowdPenalty = 0

  for (const biome of unlocked) {
    const inBiome = placedIn(animals, biome)
    if (inBiome.length === 0) continue

    const average = clamp(
      Math.round(baseVisitors(reputation) * multiplier),
      0,
      MAX_VISITORS_PER_ENCLOSURE,
    )
    visitors += average
    ticketIncome += average * TICKET_PRICE

    // 과밀은 우리 단위로 판정한다. 전체 동물 수로 재면 우리를 늘린 보람이 없다.
    overcrowdPenalty += Math.max(0, inBiome.length - OVERCROWD_THRESHOLD) * OVERCROWD_PENALTY
  }

  // 수입과 명성은 **배치된 동물만** 만든다. 창고에 쌓아두면 돈이 되지 않는다.
  const placed = animals.filter((a) => a.status === 'PLACED')
  const stored = animals.filter((a) => a.status === 'STORED')

  const totalAppeal = placed.reduce((sum, a) => sum + a.appeal, 0)
  const viewIncome = Math.round(totalAppeal * VIEW_INCOME_PER_APPEAL)
  // 배송 중인 동물은 아직 우리 것이 아니므로 사육비를 물리지 않는다.
  const upkeep = placed.length * ANIMAL_UPKEEP_PER_DAY + stored.length * STORED_UPKEEP_PER_DAY
  const reputationDelta = Math.round(totalAppeal * REPUTATION_PER_APPEAL) - overcrowdPenalty

  return {
    day,
    ticketIncome,
    viewIncome,
    upkeep,
    net: ticketIncome + viewIncome - upkeep,
    reputationDelta,
    visitors,
    animalCount: placed.length,
    storedCount: stored.length,
    arrivedCount,
  }
}
