import type { SkyPhase } from '@/assets/manifest'
import { clamp } from '@/core/math'
import {
  MAX_VISITORS_PER_ENCLOSURE, REPUTATION_PER_VISITOR, VISITOR_PHASE_MULTIPLIER,
} from './balance'

/** 명성과 시간대로부터 해당 우리의 동시 관람객 수를 구한다. */
export function visitorCount(reputation: number, phase: SkyPhase, hasAnimals: boolean): number {
  if (!hasAnimals) return 0
  const base = Math.floor(reputation / REPUTATION_PER_VISITOR) + 1
  const scaled = base * VISITOR_PHASE_MULTIPLIER[phase]
  return clamp(Math.round(scaled), 0, MAX_VISITORS_PER_ENCLOSURE)
}
