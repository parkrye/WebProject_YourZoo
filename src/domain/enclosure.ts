import type { BiomeId } from '@/assets/manifest'
import { UNLOCK_COST, UNLOCK_REPUTATION } from './balance'

export interface EnclosureDef {
  readonly id: BiomeId
  /** 화면에 표시되는 이름. 영문 대문자만 가능. */
  readonly label: string
  readonly unlockCost: number
  /** 이만큼의 명성이 있어야 열 수 있다. 돈만으로는 열리지 않는다. */
  readonly unlockReputation: number
}

/** 좌우 순회 순서. 문서상의 "우리 1 2 3". */
export const ENCLOSURE_ORDER: readonly BiomeId[] = ['FIELD', 'DESERT', 'ICE']

export const ENCLOSURES: Record<BiomeId, EnclosureDef> = {
  FIELD: {
    id: 'FIELD', label: 'GREEN FIELD',
    unlockCost: UNLOCK_COST.FIELD, unlockReputation: UNLOCK_REPUTATION.FIELD,
  },
  DESERT: {
    id: 'DESERT', label: 'DRY DESERT',
    unlockCost: UNLOCK_COST.DESERT, unlockReputation: UNLOCK_REPUTATION.DESERT,
  },
  ICE: {
    id: 'ICE', label: 'FROZEN ICE',
    unlockCost: UNLOCK_COST.ICE, unlockReputation: UNLOCK_REPUTATION.ICE,
  },
}

/**
 * 화면에 뜨는 우리 이름.
 *
 * 주인이 붙인 이름이 있으면 그것을, 없으면 기본 이름을 쓴다.
 * 남의 동물원을 볼 때도 같은 함수를 쓴다 — 그쪽이 붙인 이름을 넘기면 된다.
 */
export function enclosureLabel(id: BiomeId, names?: Partial<Record<BiomeId, string>>): string {
  return names?.[id]?.trim() || ENCLOSURES[id].label
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

/**
 * 해금된 우리 안에서만 좌우로 순회한다.
 *
 * 남의 동물원을 구경할 때는 **잠긴 우리를 아예 볼 수 없어야** 한다.
 * 내 동물원에서는 잠긴 우리도 보이는데, 거기서만 해금 안내를 띄울 수 있기 때문이다.
 */
export function neighborUnlocked(
  id: BiomeId,
  direction: -1 | 1,
  unlocked: readonly BiomeId[],
): BiomeId {
  const open = ENCLOSURE_ORDER.filter((e) => unlocked.includes(e))
  if (open.length === 0) return id
  const i = open.indexOf(id)
  const next = ((i < 0 ? 0 : i) + direction + open.length) % open.length
  return open[next] as BiomeId
}
