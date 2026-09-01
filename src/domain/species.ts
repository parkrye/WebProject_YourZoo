import type { Animal, SheetMeta } from './animal'
import { createAnimalId } from './animal'
import { SHIPPING_DAYS } from './balance'
import { animalCost, isShopAnimal } from './shop'
import type { TemplateId } from './templates'
import type { AnimalTraits } from './traits'

/**
 * 같은 종인가를 가르는 키.
 *
 * 종을 따로 적어 두지 않는다 — **그림이 곧 종이다.** 같은 그림을 쓰는 동물은
 * 같게 생겼고, 같게 생긴 것들이 무리를 짓는 것이 눈에 보이는 규칙이다.
 *
 * 세 경우가 모두 이 한 줄로 갈린다.
 *   상점 동물   `sheet:LION` 처럼 카탈로그를 가리켜 같은 종끼리 저절로 묶인다
 *   그린 동물   그림 키가 개체마다 달라 혼자가 된다
 *   등록한 종   사 온 개체가 원본과 **같은 그림 키**를 물려받아 함께 묶인다
 */
export function speciesKeyOf(animal: Pick<Animal, 'imageId'>): string {
  return animal.imageId
}

export type SpeciesVisibility = 'PRIVATE' | 'PUBLIC'

/**
 * 등록된 종 하나.
 *
 * 그린 동물은 한 마리로 끝날 이유가 없다. 공들여 그린 사슴이 죽은 뒤
 * 다시 그리는 것 말고는 방법이 없으면, 그린다는 일이 소모품이 된다.
 * 한 번 그리면 **종으로 남고**, 같은 값에 다시 데려올 수 있다.
 *
 * `id` 는 원본의 그림 키다 — `speciesKeyOf` 가 보는 값과 같아야
 * 이 종에서 나온 개체들이 우리 안에서 한 무리로 묶인다.
 */
export interface SpeciesDoc {
  readonly id: string
  /** 이 종을 그린 사람. 남의 종이면 그림도 이 사람 폴더에서 읽는다. */
  readonly ownerId: string
  /** 원본에 붙였던 이름. A-Z / 0-9 / 공백 만 — 폰트 제약. */
  readonly name: string
  readonly templateId: TemplateId
  readonly traits: AnimalTraits
  readonly imageId: string
  readonly rig: Record<string, string> | null
  readonly spriteSheet: SheetMeta | null
  /** 그리는 데 든 값. 다시 데려올 때도 같은 값을 낸다. */
  readonly price: number
  readonly appeal: number
  /** `PRIVATE` 는 나만 산다. `PUBLIC` 으로 올려야 남이 볼 수 있다. */
  readonly visibility: SpeciesVisibility
  readonly createdAt: number
}

/**
 * 그린 동물을 종으로 옮긴다. 상점에서 사 온 동물은 이미 종이므로 등록하지 않는다.
 *
 * 처음 등록은 **늘 `PRIVATE`** 이다. 그리자마자 남에게 보이면, 아직 손보는 중인
 * 그림이 세상에 나가 버린다. 내놓는 것은 스스로 누르는 일이어야 한다.
 */
export function speciesFromAnimal(animal: Animal, ownerId: string): SpeciesDoc | null {
  if (isShopAnimal(animal)) return null

  return {
    id: speciesKeyOf(animal),
    ownerId,
    name: animal.name,
    templateId: animal.templateId,
    traits: { ...animal.traits },
    imageId: animal.imageId,
    rig: animal.rig,
    spriteSheet: animal.spriteSheet,
    price: animalCost(animal),
    appeal: animal.appeal,
    visibility: 'PRIVATE',
    createdAt: Date.now(),
  }
}

/**
 * 종에서 개체 하나를 만든다.
 *
 * 그림 키를 **그대로 물려준다.** 새로 만들면 같은 종끼리 무리를 짓지 못하고,
 * 무엇보다 같은 그림을 사람 수만큼 복사해 두게 된다.
 */
export function animalFromSpecies(species: SpeciesDoc, day: number): Animal {
  return {
    id: createAnimalId(),
    name: species.name,
    // 종에서 데려오는 것도 배송을 탄다. 이미 만들어져 있으니 상점과 같은 하루다.
    status: 'SHIPPING',
    enclosureId: null,
    imageId: species.imageId,
    traits: { ...species.traits },
    templateId: species.templateId,
    spriteSheet: species.spriteSheet,
    rig: species.rig,
    orderedDay: day,
    arrivalDay: day + SHIPPING_DAYS.SHOP,
    appeal: species.appeal,
  }
}

/** 이 종을 그리는 데 필요한 그림 전부. 서버에 올릴 때도 받아 올 때도 같은 목록이다. */
export function speciesImageIds(species: SpeciesDoc): string[] {
  const ids = [species.imageId]
  if (species.spriteSheet) ids.push(species.spriteSheet.imageId)
  if (species.rig) ids.push(...Object.values(species.rig))
  return [...new Set(ids)]
}

/** 종 목록에 같은 종을 덮어쓴다. 없으면 뒤에 붙인다. */
export function upsertSpecies(list: readonly SpeciesDoc[], species: SpeciesDoc): SpeciesDoc[] {
  const index = list.findIndex((s) => s.id === species.id)
  if (index < 0) return [...list, species]

  const next = [...list]
  // 등록 시점과 공개 여부는 처음 정한 것을 지킨다 — 다시 등록한다고 비공개로 돌아가면
  // 그림을 손볼 때마다 내놓은 종이 조용히 사라진다.
  const before = list[index] as SpeciesDoc
  next[index] = { ...species, visibility: before.visibility, createdAt: before.createdAt }
  return next
}
