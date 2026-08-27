import type { Habitat } from '@/assets/manifest'
import { clamp01 } from '@/core/math'
import { pick, type Rng } from '@/core/rng'

export type Diet = 'HERB' | 'CARN' | 'OMNI'

export interface AnimalTraits {
  habitat: Habitat
  /** 이동 속도 */
  speed: number
  /** 높을수록 덜 쉬고 더 돌아다닌다 */
  activity: number
  /** 높을수록 다른 동물 곁으로 모인다 */
  sociability: number
  /** 높을수록 프롭·손님 쪽으로 접근한다 */
  curiosity: number
  /** 높을수록 손님이 가까이 오면 도망친다 */
  timidity: number
  diet: Diet
}

/** 0..1 슬라이더로 노출되는 항목. UI 와 BT 가 같은 목록을 쓴다. */
export const TRAIT_KEYS = ['speed', 'activity', 'sociability', 'curiosity', 'timidity'] as const
export type TraitKey = (typeof TRAIT_KEYS)[number]

/** 화면 표기용 축약. 폰트가 영문 대문자뿐이라 짧고 읽히는 단어로 고정한다. */
export const TRAIT_LABELS: Record<TraitKey, string> = {
  speed: 'SPEED',
  activity: 'ACTIVE',
  sociability: 'SOCIAL',
  curiosity: 'CURIOUS',
  timidity: 'SHY',
}

export const HABITATS: readonly Habitat[] = ['SKY', 'LAND', 'WATER']
export const DIETS: readonly Diet[] = ['HERB', 'CARN', 'OMNI']

export type AnimalTypeId = 'BIRD' | 'FISH' | 'BEAST' | 'HERD' | 'REPTILE'

export const ANIMAL_TYPE_ORDER: readonly AnimalTypeId[] = ['BIRD', 'FISH', 'BEAST', 'HERD', 'REPTILE']

/** 유형 프리셋. docs/00-overview.md §5 와 동일해야 한다. */
export const ANIMAL_TYPES: Record<AnimalTypeId, AnimalTraits> = {
  BIRD: { habitat: 'SKY', speed: 0.75, activity: 0.8, sociability: 0.6, curiosity: 0.55, timidity: 0.6, diet: 'OMNI' },
  FISH: { habitat: 'WATER', speed: 0.55, activity: 0.7, sociability: 0.85, curiosity: 0.3, timidity: 0.55, diet: 'OMNI' },
  BEAST: { habitat: 'LAND', speed: 0.6, activity: 0.55, sociability: 0.3, curiosity: 0.45, timidity: 0.2, diet: 'CARN' },
  HERD: { habitat: 'LAND', speed: 0.35, activity: 0.45, sociability: 0.9, curiosity: 0.35, timidity: 0.65, diet: 'HERB' },
  REPTILE: { habitat: 'LAND', speed: 0.2, activity: 0.2, sociability: 0.15, curiosity: 0.25, timidity: 0.4, diet: 'CARN' },
}

export function traitsFromType(id: AnimalTypeId): AnimalTraits {
  return { ...ANIMAL_TYPES[id] }
}

export function randomTraits(rng: Rng): AnimalTraits {
  return {
    habitat: pick(rng, HABITATS),
    speed: round2(rng()),
    activity: round2(rng()),
    sociability: round2(rng()),
    curiosity: round2(rng()),
    timidity: round2(rng()),
    diet: pick(rng, DIETS),
  }
}

export function withTrait(traits: AnimalTraits, key: TraitKey, value: number): AnimalTraits {
  return { ...traits, [key]: clamp01(value) }
}

const round2 = (v: number): number => Math.round(v * 100) / 100
