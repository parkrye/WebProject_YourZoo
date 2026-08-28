import type { TemplateId } from './templates'

/**
 * 이동 유형.
 *
 * 템플릿을 고를 때 **먼저 이것부터 고른다.** 실루엣 열몇 개를 한 화면에 늘어놓으면
 * 사자와 거북이가 나란히 놓여 무엇이 무엇과 다른지 읽히지 않는다.
 * 걷는 방식이 곧 움직임의 성격이므로, 여기서 갈라 두면 고른 뒤에 어긋날 일도 적다.
 */
export type Locomotion =
  | 'QUADRUPED'
  | 'HOPPER'
  | 'BIPED'
  | 'BIRD'
  | 'SWIMMER'
  | 'CRAWLER'
  | 'SHELLED'

export interface LocomotionGroup {
  readonly id: Locomotion
  /** 화면에 뜨는 이름. 영문 대문자 — 폰트 제약. */
  readonly label: string
  /** 한 줄 설명. 어떤 동물이 여기 드는지 알려 준다. */
  readonly hint: string
  readonly templates: readonly TemplateId[]
}

export const LOCOMOTION_ORDER: readonly Locomotion[] = [
  'QUADRUPED', 'HOPPER', 'BIPED', 'BIRD', 'SWIMMER', 'CRAWLER', 'SHELLED',
]

export const LOCOMOTIONS: Record<Locomotion, LocomotionGroup> = {
  QUADRUPED: {
    id: 'QUADRUPED',
    label: 'FOUR LEGS',
    hint: 'DEER  HORSE  LION',
    templates: ['DEER', 'LION'],
  },
  HOPPER: {
    id: 'HOPPER',
    label: 'HOPPER',
    hint: 'RABBIT  FROG  KANGAROO',
    templates: ['RABBIT'],
  },
  BIPED: {
    id: 'BIPED',
    label: 'TWO LEGS',
    hint: 'MONKEY  PENGUIN  BEAR',
    templates: ['MONKEY', 'PENGUIN'],
  },
  BIRD: {
    id: 'BIRD',
    label: 'WINGS',
    hint: 'PARROT  OWL  SPARROW',
    templates: ['PARROT', 'OWL'],
  },
  SWIMMER: {
    id: 'SWIMMER',
    label: 'FINS',
    hint: 'FISH  SHARK  DOLPHIN',
    templates: ['FISH'],
  },
  CRAWLER: {
    id: 'CRAWLER',
    label: 'LOW BODY',
    hint: 'CROC  LIZARD  SNAKE',
    templates: ['CROC'],
  },
  SHELLED: {
    id: 'SHELLED',
    label: 'SHELL',
    hint: 'TURTLE  SNAIL  BEETLE',
    templates: ['TURTLE'],
  },
}

/** 이 템플릿이 어느 이동 유형에 드는가. */
export function locomotionOf(id: TemplateId): Locomotion | null {
  for (const group of Object.values(LOCOMOTIONS)) {
    if (group.templates.includes(id)) return group.id
  }
  return null
}
