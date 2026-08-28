import type { BiomeId, Habitat } from '@/assets/manifest'
import { clamp } from '@/core/math'
import { MAX_ANIMALS_PER_ENCLOSURE } from './balance'
import type { TemplateId } from './templates'
import type { AnimalTraits } from './traits'

/** 동물의 행동 상태. BT 가 정하고 렌더러가 소비한다. */
export type AnimalMotion = 'IDLE' | 'MOVE' | 'SIGNATURE'

/**
 * 향후 외부 SDK 가 생성할 스프라이트 시트 메타.
 * 값이 있으면 `SheetRenderer`, `null` 이면 `ProceduralRenderer` 를 쓴다.
 * @see docs/02-architecture.md §3.1
 */
export interface SheetMeta {
  /** 프레임 이미지의 IndexedDB 키 */
  imageId: string
  cols: number
  rows: number
  fps: number
  /** 행 순서에 대응하는 모션. 예: ['IDLE', 'MOVE', 'SIGNATURE'] */
  motions: readonly AnimalMotion[]
  /**
   * 프레임 높이 대비 동물의 기준 높이. 기본 1(프레임을 꽉 채움).
   *
   * 직접 구운 시트는 보빙과 점프가 잘리지 않게 여백을 두므로 1 보다 작다.
   * 이 값이 없으면 프레임이 곧 동물의 바운딩 박스라고 본다 — 외부 SDK 시트의 관례다.
   */
  fit?: number
  /** 프레임 안에서 발이 놓이는 y (0..1). 기본 1(프레임 아래변). */
  baseline?: number
  /**
   * 줄마다의 실제 프레임 수. 없으면 모든 줄이 `cols` 만큼이라고 본다.
   *
   * 한 시트 안에서도 줄마다 다르다 — 말은 서 있는 줄이 8칸인데 걷는 줄은 7칸이다.
   * 이걸 모르면 걷다가 빈 칸에서 동물이 한 번씩 사라진다.
   */
  frames?: readonly number[]
}

/**
 * 동물의 생애 단계.
 *
 * `SHIPPING` 요청서 제출 후 배송 중. 아무 효과가 없다.
 * `STORED`   창고 도착. 사육비 절반을 내지만 수입도 명성도 없다.
 * `PLACED`   우리에 배치됨. 손님을 부르고 수입을 만든다.
 */
export type AnimalStatus = 'SHIPPING' | 'STORED' | 'PLACED'

export interface Animal {
  readonly id: string
  /** A-Z / 0-9 / 공백 만 허용. 폰트 제약. */
  readonly name: string
  readonly status: AnimalStatus
  /** `PLACED` 일 때만 값이 있다. */
  readonly enclosureId: BiomeId | null
  /** 플레이어가 그린 그림의 IndexedDB 키 */
  readonly imageId: string
  readonly traits: AnimalTraits
  /** 그림을 그릴 때 고른 템플릿. 움직임 프로파일과 파츠 힌트를 정한다. */
  readonly templateId: TemplateId
  readonly spriteSheet: SheetMeta | null
  /**
   * 파츠로 만든 동물. 부위마다 IndexedDB 키를 들고 있다.
   *
   * `spriteSheet` 와 함께 쓰지 않는다 — 시트가 있으면 프레임이 곧 자세이고,
   * 리그가 있으면 파츠를 관절로 돌려 자세를 만든다. 둘은 서로 다른 방식이다.
   */
  readonly rig: Record<string, string> | null
  /** 요청서를 제출한 날 */
  readonly orderedDay: number
  /** 창고에 도착하는 날 */
  readonly arrivalDay: number
  readonly appeal: number
}

export function isPlaced(animal: Animal): boolean {
  return animal.status === 'PLACED'
}

export function placedIn(animals: readonly Animal[], enclosureId: BiomeId): Animal[] {
  return animals.filter((a) => a.status === 'PLACED' && a.enclosureId === enclosureId)
}

export interface AppealInput {
  traits: AnimalTraits
  /** 그림에 쓰인 색상 가짓수 */
  colorCount: number
  /** 배치될 우리에 이미 있는, 같은 서식지 동물 수 */
  sameHabitatCount: number
}

const BASE_APPEAL = 10
const MAX_COLOR_BONUS = 9
const COLOR_BONUS_PER_HUE = 1.5
const MAX_RARITY_BONUS = 5
const MAX_TRAIT_BONUS = 6

/**
 * 동물 매력도. 수입과 명성이 여기서 나온다.
 * @see docs/00-overview.md §4.4
 */
export function computeAppeal({ traits, colorCount, sameHabitatCount }: AppealInput): number {
  const colorBonus = Math.min(MAX_COLOR_BONUS, colorCount * COLOR_BONUS_PER_HUE)

  const crowding = clamp(sameHabitatCount / MAX_ANIMALS_PER_ENCLOSURE, 0, 1)
  const rarityBonus = MAX_RARITY_BONUS * (1 - crowding)

  const traitBonus = ((traits.activity + traits.curiosity) / 2) * MAX_TRAIT_BONUS

  return Math.round(BASE_APPEAL + colorBonus + rarityBonus + traitBonus)
}

export function countHabitat(animals: readonly Animal[], enclosureId: BiomeId, habitat: Habitat): number {
  let n = 0
  for (const a of animals) {
    if (a.status !== 'PLACED') continue
    if (a.enclosureId === enclosureId && a.traits.habitat === habitat) n++
  }
  return n
}

export function createAnimalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `a_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}
