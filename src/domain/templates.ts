import type { Habitat } from '@/assets/manifest'
import type { MotionArchetype } from './motion'
import type { AnimalTypeId } from './traits'

export type TemplateId =
  | 'FREE'
  | 'DEER' | 'RABBIT' | 'CROC'
  | 'PARROT' | 'OWL'
  | 'FISH' | 'TURTLE'

/** 그림판에 옅게 깔리는 가이드 도형. 좌표는 캔버스 기준 정규화(0..1). */
export type GuideShape =
  | { kind: 'PATH'; points: readonly (readonly [number, number])[]; closed?: boolean }
  | { kind: 'ELLIPSE'; cx: number; cy: number; rx: number; ry: number }

/**
 * 그림의 어느 부분이 무엇인지 알려 주는 힌트.
 *
 * 지금 렌더러는 이 영역을 직접 자르지 않는다 — 사람이 그린 그림은 경계가 제각각이라
 * 잘라 붙이면 이음매가 드러난다. 대신 **어느 축을 흔들지**를 `motion` 프로파일이 정하고,
 * 이 rect 는 향후 8×3 스프라이트 시트 SDK 에 넘길 파츠 힌트로 남겨 둔다.
 */
export interface TemplatePart {
  readonly id: 'BODY' | 'HEAD' | 'WING' | 'TAIL' | 'LEG' | 'FIN'
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface AnimalTemplate {
  readonly id: TemplateId
  readonly label: string
  /** 이 템플릿이 전제하는 서식지. FREE 는 없음. */
  readonly habitat: Habitat | null
  /** 선택 시 함께 적용할 습성 프리셋 */
  readonly suggestedType: AnimalTypeId | null
  readonly guide: readonly GuideShape[]
  readonly parts: readonly TemplatePart[]
  /** 이 실루엣이 어떻게 움직이는지. 규격은 domain/motion.ts 에 있다. */
  readonly archetype: MotionArchetype
}

/*
  구체 데이터는 templateData.ts 에 있다.
  타입과 데이터를 나눠 두면 데이터 파일이 타입을 import 해도 순환이 생기지 않는다.
*/
export { TEMPLATES, TEMPLATE_ORDER, templateOf } from './templateData'
