import type { Habitat } from '@/assets/manifest'
import type { AnimalTypeId } from './traits'

export type TemplateId = 'FREE' | 'BIRD' | 'FISH' | 'BEAST' | 'SERPENT'

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

/**
 * 절차적 애니메이션 프로파일.
 *
 * 이미지를 가로로 얇게 잘라 각 조각을 서로 다른 위상으로 밀면 몸이 물결친다.
 * 통짜 변형보다 훨씬 살아 있어 보이고, 조각 수가 적어 비용도 낮다.
 */
export interface MotionProfile {
  /** 물결 진폭 (그림 높이 대비). 0 이면 물결 없음. */
  readonly waveAmplitude: number
  /** 그림 전체에 걸치는 물결의 파장 수 */
  readonly waveCycles: number
  /** 물결 속도 (rad/s) */
  readonly waveSpeed: number
  /** 상하 보빙 진폭 (그림 높이 대비) */
  readonly bob: number
  /** 보빙 주파수 (rad/s) */
  readonly bobSpeed: number
  /** 진행 방향으로 기우는 각도(라디안) */
  readonly lean: number
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
  readonly motion: MotionProfile
}

const NO_WAVE = { waveAmplitude: 0, waveCycles: 0, waveSpeed: 0 }

export const TEMPLATE_ORDER: readonly TemplateId[] = ['FREE', 'BIRD', 'FISH', 'BEAST', 'SERPENT']

export const TEMPLATES: Record<TemplateId, AnimalTemplate> = {
  FREE: {
    id: 'FREE',
    label: 'FREE',
    habitat: null,
    suggestedType: null,
    guide: [],
    parts: [],
    motion: { ...NO_WAVE, bob: 0.02, bobSpeed: 2.4, lean: 0.1 },
  },

  BIRD: {
    id: 'BIRD',
    label: 'BIRD',
    habitat: 'SKY',
    suggestedType: 'BIRD',
    guide: [
      { kind: 'ELLIPSE', cx: 0.46, cy: 0.55, rx: 0.19, ry: 0.13 },
      { kind: 'ELLIPSE', cx: 0.7, cy: 0.42, rx: 0.09, ry: 0.08 },
      // 부리
      { kind: 'PATH', points: [[0.79, 0.42], [0.9, 0.45], [0.79, 0.48]], closed: true },
      // 날개 — 위로 펼친 형태
      { kind: 'PATH', points: [[0.42, 0.46], [0.36, 0.2], [0.58, 0.34], [0.5, 0.46]], closed: true },
      // 꼬리
      { kind: 'PATH', points: [[0.28, 0.55], [0.12, 0.46], [0.14, 0.64]], closed: true },
      // 다리
      { kind: 'PATH', points: [[0.5, 0.68], [0.5, 0.78]] },
    ],
    parts: [
      { id: 'BODY', x: 0.27, y: 0.42, w: 0.38, h: 0.26 },
      { id: 'HEAD', x: 0.61, y: 0.34, w: 0.29, h: 0.16 },
      { id: 'WING', x: 0.34, y: 0.18, w: 0.26, h: 0.3 },
      { id: 'TAIL', x: 0.1, y: 0.44, w: 0.2, h: 0.22 },
    ],
    // 날갯짓은 빠른 상하 진동이 핵심이다. 몸통 물결은 약하게만.
    motion: { waveAmplitude: 0.02, waveCycles: 0.8, waveSpeed: 9, bob: 0.05, bobSpeed: 8.5, lean: 0.14 },
  },

  FISH: {
    id: 'FISH',
    label: 'FISH',
    habitat: 'WATER',
    suggestedType: 'FISH',
    guide: [
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.5, rx: 0.26, ry: 0.15 },
      // 꼬리지느러미
      { kind: 'PATH', points: [[0.24, 0.5], [0.08, 0.36], [0.12, 0.5], [0.08, 0.64]], closed: true },
      // 등지느러미
      { kind: 'PATH', points: [[0.42, 0.36], [0.5, 0.24], [0.6, 0.37]], closed: true },
      // 눈
      { kind: 'ELLIPSE', cx: 0.68, cy: 0.47, rx: 0.022, ry: 0.022 },
    ],
    parts: [
      { id: 'BODY', x: 0.24, y: 0.35, w: 0.52, h: 0.3 },
      { id: 'TAIL', x: 0.06, y: 0.34, w: 0.2, h: 0.32 },
      { id: 'FIN', x: 0.4, y: 0.22, w: 0.22, h: 0.16 },
    ],
    // 꼬리에서 머리로 흐르는 물결. 물고기 특유의 헤엄.
    motion: { waveAmplitude: 0.075, waveCycles: 1.1, waveSpeed: 7, bob: 0.012, bobSpeed: 2, lean: 0.04 },
  },

  BEAST: {
    id: 'BEAST',
    label: 'BEAST',
    habitat: 'LAND',
    suggestedType: 'BEAST',
    guide: [
      { kind: 'ELLIPSE', cx: 0.45, cy: 0.45, rx: 0.24, ry: 0.15 },
      { kind: 'ELLIPSE', cx: 0.74, cy: 0.36, rx: 0.11, ry: 0.1 },
      // 다리 4개
      { kind: 'PATH', points: [[0.3, 0.58], [0.29, 0.8]] },
      { kind: 'PATH', points: [[0.42, 0.59], [0.42, 0.8]] },
      { kind: 'PATH', points: [[0.54, 0.59], [0.55, 0.8]] },
      { kind: 'PATH', points: [[0.64, 0.58], [0.66, 0.8]] },
      // 꼬리
      { kind: 'PATH', points: [[0.22, 0.42], [0.1, 0.3]] },
    ],
    parts: [
      { id: 'BODY', x: 0.21, y: 0.3, w: 0.48, h: 0.3 },
      { id: 'HEAD', x: 0.63, y: 0.26, w: 0.24, h: 0.22 },
      { id: 'LEG', x: 0.26, y: 0.58, w: 0.44, h: 0.24 },
      { id: 'TAIL', x: 0.08, y: 0.28, w: 0.16, h: 0.16 },
    ],
    // 네 발 걸음은 물결보다 규칙적인 상하 흔들림으로 읽힌다.
    motion: { waveAmplitude: 0.025, waveCycles: 0.6, waveSpeed: 6, bob: 0.045, bobSpeed: 7, lean: 0.1 },
  },

  SERPENT: {
    id: 'SERPENT',
    label: 'SERPENT',
    habitat: 'LAND',
    suggestedType: 'REPTILE',
    guide: [
      { kind: 'PATH', points: [[0.08, 0.6], [0.24, 0.42], [0.42, 0.6], [0.6, 0.42], [0.78, 0.56], [0.9, 0.48]] },
      { kind: 'ELLIPSE', cx: 0.9, cy: 0.46, rx: 0.07, ry: 0.055 },
    ],
    parts: [
      { id: 'BODY', x: 0.05, y: 0.36, w: 0.8, h: 0.3 },
      { id: 'HEAD', x: 0.82, y: 0.38, w: 0.16, h: 0.16 },
    ],
    // 몸 전체가 파장 두 개로 크게 물결친다.
    motion: { waveAmplitude: 0.11, waveCycles: 2, waveSpeed: 5, bob: 0.008, bobSpeed: 1.6, lean: 0.02 },
  },
}

export function templateOf(id: TemplateId | null): AnimalTemplate {
  return TEMPLATES[id ?? 'FREE']
}
