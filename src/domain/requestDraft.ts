import type { Habitat } from '@/assets/manifest'
import type { ExportedDrawing } from '@/draw/export'
import type { TemplateId } from './templates'
import { traitsFromType, type AnimalTraits, type AnimalTypeId } from './traits'

export type TraitMode = 'TYPE' | 'CUSTOM' | 'RANDOM'

/**
 * 작성 중인 요청서.
 *
 * 그림 한 장을 그리는 데 몇 분이 걸리는데, 제출하려다 돈이 모자라 창을 닫으면
 * **이름도 그림도 습성도 통째로 사라졌다.** 다시 그리게 만들 이유가 없다.
 * 세션이 살아 있는 동안은 그대로 들고 있다가 창을 다시 열면 이어서 쓴다.
 *
 * 세이브에는 넣지 않는다 — 그림이 Blob 이라 직렬화가 번거롭고,
 * 미완성 초안까지 저장할 만큼 중요하지는 않다.
 */
export interface RequestDraft {
  name: string
  templateId: TemplateId
  habitat: Habitat | null
  mode: TraitMode
  typeId: AnimalTypeId
  custom: AnimalTraits
  rolled: AnimalTraits
  rollSeed: number
  drawing: ExportedDrawing | null
}

export function emptyDraft(rolled: AnimalTraits): RequestDraft {
  return {
    name: '',
    templateId: 'FREE',
    habitat: null,
    mode: 'TYPE',
    typeId: 'BEAST',
    custom: traitsFromType('BEAST'),
    rolled,
    rollSeed: 1,
    drawing: null,
  }
}
