import type { BiomeId, Habitat } from '@/assets/manifest'
import { MAX_PROPS_PER_ENCLOSURE, SHOP_PROP_PRICE } from './balance'

/**
 * 프롭의 생애 단계. 동물과 같다.
 *
 * `SHIPPING` 주문 후 배송 중
 * `STORED`   창고 도착. 아직 어느 우리에도 없다
 * `PLACED`   우리에 놓임
 *
 * 프롭에는 사육비가 없다. 밥을 먹지 않는다.
 */
export type PropStatus = 'SHIPPING' | 'STORED' | 'PLACED'

/**
 * 프롭 한 점.
 *
 * 상점 프롭은 바이옴 시트의 한 칸(`sprite`)이고, 직접 그린 프롭은
 * IndexedDB 의 그림(`imageId`)이다. 둘 중 하나만 채워진다.
 */
export interface OwnedProp {
  readonly id: string
  readonly name: string
  readonly status: PropStatus
  /** `PLACED` 일 때만 값이 있다. */
  readonly enclosureId: BiomeId | null
  /** 상점 프롭: 어느 바이옴 시트의 몇 번 칸인가. 그린 프롭은 둘 다 null. */
  readonly sheetBiome: BiomeId | null
  readonly sprite: number | null
  /** 그린 프롭의 IndexedDB 키. 상점 프롭은 null. */
  readonly imageId: string | null
  /** 땅에 놓느냐 물에 띄우느냐. 배치 가능한 구역을 정한다. */
  readonly layer: Habitat
  /** 놓인 자리 (정규화). 배치 전에는 0. */
  readonly x: number
  readonly y: number
  readonly orderedDay: number
  readonly arrivalDay: number
}

export function propPrice(layer: Habitat): number {
  return layer === 'WATER' ? SHOP_PROP_PRICE.WATER : SHOP_PROP_PRICE.LAND
}

export function placedProps(props: readonly OwnedProp[], enclosureId: BiomeId): OwnedProp[] {
  return props.filter((p) => p.status === 'PLACED' && p.enclosureId === enclosureId)
}

export function storedProps(props: readonly OwnedProp[]): OwnedProp[] {
  return props.filter((p) => p.status === 'STORED')
}

export function canPlaceProp(props: readonly OwnedProp[], enclosureId: BiomeId): boolean {
  return placedProps(props, enclosureId).length < MAX_PROPS_PER_ENCLOSURE
}

export function createPropId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `p_${crypto.randomUUID()}`
  return `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}
