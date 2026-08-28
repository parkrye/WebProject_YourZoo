import { ANIMAL_SHEETS, type AnimalSheetAsset } from '@/assets/animalSheets'
import {
  PROP_LAND_INDICES, PROP_WATER_INDICES,
  type BiomeId, type Habitat,
} from '@/assets/manifest'
import { SHOP_ANIMAL_PRICE } from './balance'
import { propPrice } from './prop'
import type { AnimalTraits } from './traits'

// ─────────────────────────────────────────────────────────────
// 동물 상점
// ─────────────────────────────────────────────────────────────

/**
 * 시트가 초당 넘어가는 프레임 수. 한 줄이 1초에 한 바퀴 돈다.
 *
 * 격자 크기는 여기 두지 않는다 — **시트마다 다르다.** 닭과 까마귀와 공작은 7칸이다.
 * 칸 수는 전처리가 그림에서 직접 재어 `animalSheets.ts` 에 적어 둔다.
 */
export const SHOP_SHEET_FPS = 8

/**
 * 상점 동물의 시트를 가리키는 이미지 키.
 *
 * 그린 동물은 IndexedDB 의 Blob 을 쓰지만 상점 동물의 시트는 번들에 들어 있다.
 * 같은 캐시를 쓰되 접두사로 갈라 `imageCache` 가 어디서 읽을지 판단하게 한다.
 */
export const SHEET_KEY_PREFIX = 'sheet:'

export function sheetImageId(catalogId: string): string {
  return `${SHEET_KEY_PREFIX}${catalogId}`
}

/**
 * 상점에서 산 동물인가.
 *
 * 산 동물의 그림 키는 `sheet:` 로 시작한다 — 미리 만들어 둔 시트를 가리키기 때문이다.
 * 그린 동물의 키는 플레이어가 그린 그림의 IndexedDB 키라 이 접두사가 붙지 않는다.
 */
export function isShopAnimal(animal: { readonly imageId: string }): boolean {
  return animal.imageId.startsWith(SHEET_KEY_PREFIX)
}

export function findSheet(catalogId: string): AnimalSheetAsset | null {
  return ANIMAL_SHEETS.find((s) => s.id === catalogId) ?? null
}

export interface ShopAnimal {
  readonly catalogId: string
  readonly habitat: Habitat
  readonly price: number
  readonly sheet: AnimalSheetAsset
}

export const SHOP_ANIMALS: readonly ShopAnimal[] = ANIMAL_SHEETS.map((sheet) => ({
  catalogId: sheet.id,
  habitat: sheet.habitat,
  price: SHOP_ANIMAL_PRICE[sheet.habitat],
  sheet,
}))

/**
 * 상점 동물의 습성.
 *
 * 그린 동물은 플레이어가 슬라이더로 정하지만 상점 동물은 이미 만들어진 것이다.
 * 이름에서 **결정적으로** 뽑아 같은 종은 늘 같은 성격을 갖게 한다 —
 * 살 때마다 성격이 달라지면 "이 동물은 이런 애"라는 인상이 안 생긴다.
 */
export function shopAnimalTraits(item: ShopAnimal): AnimalTraits {
  const seed = hash(item.catalogId)
  const pick = (shift: number, min: number, max: number): number => {
    const t = ((seed >>> shift) & 0xff) / 255
    return Math.round((min + t * (max - min)) * 100) / 100
  }
  return {
    habitat: item.habitat,
    speed: pick(0, 0.3, 0.9),
    activity: pick(6, 0.35, 0.9),
    sociability: pick(12, 0.2, 0.9),
    curiosity: pick(18, 0.2, 0.9),
    timidity: pick(24, 0.1, 0.7),
    // 상점 동물은 종이 정해져 있다. 육식은 물과 땅의 사냥꾼에게만 준다.
    diet: PREDATORS.has(item.catalogId) ? 'CARN' : OMNIVORES.has(item.catalogId) ? 'OMNI' : 'HERB',
  }
}

const PREDATORS = new Set(['SHARK', 'PIRANHA', 'MARLIN', 'ALIGATOR', 'TIGGER'])
const OMNIVORES = new Set(['BEAR', 'POLARBEAR', 'CROW', 'MONKEY', 'ORANGUTAN', 'CHICKEN', 'PIGEON'])

/** 상점 동물의 매력도. 값이 비쌀수록 손님을 더 부른다. */
export function shopAnimalAppeal(item: ShopAnimal): number {
  return Math.round(item.price / 5)
}

// ─────────────────────────────────────────────────────────────
// 프롭 상점
// ─────────────────────────────────────────────────────────────

export interface ShopProp {
  /** 목록의 키. 바이옴과 칸 번호를 합친다. */
  readonly id: string
  readonly biome: BiomeId
  readonly sprite: number
  readonly layer: Habitat
  readonly price: number
}

/** 해금된 우리의 프롭만 판다. 아직 못 여는 우리의 소품을 미리 살 이유가 없다. */
export function shopProps(unlocked: readonly BiomeId[]): ShopProp[] {
  const items: ShopProp[] = []
  for (const biome of unlocked) {
    for (const sprite of PROP_LAND_INDICES) {
      items.push({ id: `${biome}-${sprite}`, biome, sprite, layer: 'LAND', price: propPrice('LAND') })
    }
    for (const sprite of PROP_WATER_INDICES) {
      items.push({ id: `${biome}-${sprite}`, biome, sprite, layer: 'WATER', price: propPrice('WATER') })
    }
  }
  return items
}

/** 프롭 이름. 폰트가 영문 대문자뿐이라 짧게 만든다. */
export function shopPropName(item: ShopProp): string {
  return `${item.layer} ${item.sprite + 1}`
}

function hash(text: string): number {
  let value = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}
