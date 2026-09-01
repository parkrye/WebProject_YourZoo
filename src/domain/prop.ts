import type { BiomeId, Habitat } from '@/assets/manifest'
import { MAX_PROPS_PER_ENCLOSURE, PROP_SELL_RATIO, SHOP_PROP_PRICE } from './balance'
import { PROP_CRAFTS } from './craft'

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
  /**
   * 여러 칸을 그려 만든 프롭. `imageId` 가 가로로 이어붙인 띠를 가리킨다.
   *
   * 프롭에는 걷기도 필살기도 없다. 한 줄이 그대로 반복될 뿐이다.
   */
  readonly strip: { readonly frames: number; readonly fps: number } | null
  /**
   * 놓았을 때의 거동. **놓을 수 있는 자리를 제한하지는 않는다.**
   *
   * `LAND`  가만히 있는다
   * `WATER` 잔물결에 위아래로 뜬다
   * `SKY`   좌우로 흔들린다
   *
   * 프롭은 우리를 꾸미는 물건이다. 물 위에 나무를, 하늘에 풍선을 매달고 싶을 수 있어
   * 자리를 막지 않는다 — 대신 어떻게 움직일지를 만들 때 고른다.
   */
  readonly layer: Habitat
  /** 놓인 자리 (정규화). 배치 전에는 0. */
  readonly x: number
  readonly y: number
  readonly orderedDay: number
  readonly arrivalDay: number
}

/** 상점 프롭 값. 층을 가리지 않고 하나다 — 인자는 부르는 쪽의 읽기 편의로 남긴다. */
export function propPrice(_layer: Habitat): number {
  return SHOP_PROP_PRICE
}

/**
 * 이 프롭에 든 값. 동물과 같이 남아 있는 흔적으로 되짚는다.
 *
 * 다만 동물만큼 정확하지는 않다 — 프롭에는 템플릿을 썼는지가 남지 않아
 * 띠가 없는 그린 프롭은 전부 가장 싼 방식으로 본다. **낮은 쪽으로 틀리는 편이
 * 안전하다**: 실제보다 높게 잡으면 싸게 그려 비싸게 파는 길이 열린다.
 */
export function propCost(prop: OwnedProp): number {
  if (!prop.imageId) return SHOP_PROP_PRICE
  return prop.strip ? PROP_CRAFTS.DETAILED.coins : PROP_CRAFTS.SIMPLE.coins
}

/** 팔 때 돌려받는 값. */
export function propRefund(prop: OwnedProp): number {
  return Math.floor(propCost(prop) * PROP_SELL_RATIO)
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
