import type { BiomeId } from '@/assets/manifest'
import { UNLOCK_COST } from './balance'

export interface EnclosureDef {
  readonly id: BiomeId
  /** 화면에 표시되는 이름. 영문 대문자만 가능. */
  readonly label: string
  readonly unlockCost: number
}

/** 좌우 순회 순서. 문서상의 "우리 1 2 3". */
export const ENCLOSURE_ORDER: readonly BiomeId[] = ['FIELD', 'DESERT', 'ICE']

export const ENCLOSURES: Record<BiomeId, EnclosureDef> = {
  FIELD: { id: 'FIELD', label: 'GREEN FIELD', unlockCost: UNLOCK_COST.FIELD },
  DESERT: { id: 'DESERT', label: 'DRY DESERT', unlockCost: UNLOCK_COST.DESERT },
  ICE: { id: 'ICE', label: 'FROZEN ICE', unlockCost: UNLOCK_COST.ICE },
}

export function enclosureIndex(id: BiomeId): number {
  return ENCLOSURE_ORDER.indexOf(id)
}

export function neighborEnclosure(id: BiomeId, direction: -1 | 1): BiomeId {
  const i = enclosureIndex(id)
  const n = ENCLOSURE_ORDER.length
  const next = (i + direction + n) % n
  return ENCLOSURE_ORDER[next] as BiomeId
}
