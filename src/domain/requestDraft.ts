import type { Habitat } from '@/assets/manifest'
import { createRng } from '@/core/rng'
import type { ExportedDrawing } from '@/draw/export'
import { DETAIL_COLS, DETAIL_ROW_LABELS, PROP_DETAIL_FRAMES, type AnimalCraft, type PropCraft } from './craft'
import type { Locomotion } from './locomotion'
import type { PropTemplateId } from './propTemplates'
import type { TemplateId } from './templates'
import { randomTraits, type AnimalTraits, type AnimalTypeId } from './traits'

export type TraitMode = 'TYPE' | 'CUSTOM' | 'RANDOM'

/** 요청서의 탭. 어느 탭을 보고 있었는지도 작업 내용의 일부다. */
export type RequestTab = 'NEW' | 'PROP' | 'ORDERS'

export type AnimalStep = 'CRAFT' | 'LOCOMOTION' | 'TEMPLATE' | 'DRAW' | 'TRAITS' | 'NAME'
export type PropStep = 'CRAFT' | 'TEMPLATE' | 'DRAW' | 'DETAILS'

/**
 * 작성 중인 동물 요청서.
 *
 * 그림 한 장을 그리는 데 몇 분이 걸린다. 그런데 위저드의 상태를 폼 컴포넌트가
 * 들고 있으면 **요청서를 덮는 창 하나에 그게 통째로 사라진다** —
 * 자정 정산 팝업이 뜨면 요청서가 내려가고, 그리던 그림도 이름도 습성도 함께 날아갔다.
 *
 * 그래서 걸음까지 포함해 전부 스토어에 둔다. 창이 닫혀도 세션이 살아 있는 동안은
 * 그대로 남고, 다시 열면 보던 걸음 그 자리에서 이어 쓴다.
 * 비우는 시점은 **제출이 성공했을 때 하나뿐이다.**
 *
 * 세이브에는 넣지 않는다 — 그림이 Blob 이라 직렬화가 번거롭고,
 * 미완성 초안까지 저장할 만큼 중요하지는 않다.
 */
export interface AnimalDraft {
  step: AnimalStep
  craft: AnimalCraft
  locomotion: Locomotion
  templateId: TemplateId
  name: string
  mode: TraitMode
  typeId: AnimalTypeId
  custom: AnimalTraits
  rolled: AnimalTraits
  rollSeed: number
  habitat: Habitat
  /** 한 장짜리 그림. SIMPLE / TEMPLATE 이 쓴다. */
  single: ExportedDrawing | null
  /** 리그 파츠. 부위 id 로 찾는다. */
  rigParts: Record<string, ExportedDrawing>
  /** 24칸 그리기. 칸 번호가 곧 시트의 자리다. */
  frames: (ExportedDrawing | null)[]
}

/** 작성 중인 프롭 요청서. 보존하는 이유는 동물과 같다. */
export interface PropDraft {
  step: PropStep
  craft: PropCraft
  templateId: PropTemplateId
  layer: Habitat
  name: string
  single: ExportedDrawing | null
  frames: (ExportedDrawing | null)[]
}

export interface RequestDraft {
  tab: RequestTab
  animal: AnimalDraft
  prop: PropDraft
}

const ANIMAL_FRAME_COUNT = DETAIL_COLS * DETAIL_ROW_LABELS.length

/** 습성 초깃값은 고정 시드로 뽑는다. 새로 열 때마다 달라지면 비교할 기준이 없다. */
const CUSTOM_SEED = 11
const ROLL_SEED = 23

export function emptyAnimalDraft(): AnimalDraft {
  return {
    step: 'CRAFT',
    craft: 'SIMPLE',
    locomotion: 'QUADRUPED',
    templateId: 'DEER',
    name: '',
    mode: 'TYPE',
    typeId: 'BIRD',
    custom: randomTraits(createRng(CUSTOM_SEED)),
    rolled: randomTraits(createRng(ROLL_SEED)),
    rollSeed: ROLL_SEED,
    habitat: 'LAND',
    single: null,
    rigParts: {},
    frames: Array(ANIMAL_FRAME_COUNT).fill(null),
  }
}

export function emptyPropDraft(): PropDraft {
  return {
    step: 'CRAFT',
    craft: 'SIMPLE',
    templateId: 'ROCK',
    layer: 'LAND',
    name: '',
    single: null,
    frames: Array(PROP_DETAIL_FRAMES).fill(null),
  }
}

export function emptyRequestDraft(): RequestDraft {
  return { tab: 'NEW', animal: emptyAnimalDraft(), prop: emptyPropDraft() }
}
