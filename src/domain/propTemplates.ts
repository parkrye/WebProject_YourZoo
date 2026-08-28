import { GUI, type GuiIcon, type Habitat } from '@/assets/manifest'
import type { GuideShape } from './templates'

export type PropTemplateId =
  | 'FREE' | 'ROCK' | 'TREE' | 'SIGN' | 'BENCH' | 'BARREL' | 'CONE' | 'BUSH'
  | 'RAFT' | 'BALLOON' | 'LANTERN'

export interface PropTemplate {
  readonly id: PropTemplateId
  readonly label: string
  /** 이 모양이 어울리는 거동. 고르면 함께 맞춰 준다. */
  readonly layer: Habitat
  /**
   * 고를 때 보여 줄 그림. 이름만 늘어놓으면 무엇을 그리는 건지 읽어야 안다.
   * 맞는 아이콘이 없는 것은 비워 둔다 — 엉뚱한 그림이 붙는 것보다 낫다.
   */
  readonly icon?: GuiIcon
  readonly guide: readonly GuideShape[]
}

export const PROP_TEMPLATE_ORDER: readonly PropTemplateId[] = [
  'FREE',
  'ROCK', 'TREE', 'BUSH', 'SIGN', 'BENCH', 'BARREL', 'CONE',
  'RAFT', 'BALLOON', 'LANTERN',
]

/**
 * 프롭 그리기 가이드.
 *
 * 동물 템플릿과 달리 **부위도 움직임 프로파일도 없다.** 프롭은 스스로 움직이지 않고
 * 놓인 곳에 따라 가만히 있거나, 뜨거나, 흔들릴 뿐이다.
 * 그래서 가이드는 순전히 "이 정도 크기로 이런 실루엣" 이라는 밑그림이다.
 *
 * 거동을 함께 담아 둔 건 편의다 — 뗏목을 그려 놓고 땅에 고정으로 두는 실수를 줄인다.
 */
export const PROP_TEMPLATES: Record<PropTemplateId, PropTemplate> = {
  FREE: { id: 'FREE', label: 'FREE', layer: 'LAND', icon: GUI.PAINT, guide: [] },

  ROCK: {
    id: 'ROCK',
    label: 'ROCK',
    layer: 'LAND',
    guide: [
      { kind: 'PATH', points: [[0.2, 0.76], [0.3, 0.44], [0.52, 0.34], [0.72, 0.46], [0.8, 0.76]], closed: true },
      { kind: 'PATH', points: [[0.34, 0.5], [0.46, 0.56], [0.6, 0.48]] },
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.78, rx: 0.32, ry: 0.05 },
    ],
  },

  TREE: {
    id: 'TREE',
    label: 'TREE',
    layer: 'LAND',
    icon: GUI.TREE,
    guide: [
      { kind: 'PATH', points: [[0.44, 0.82], [0.44, 0.5]] },
      { kind: 'PATH', points: [[0.56, 0.82], [0.56, 0.5]] },
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.34, rx: 0.28, ry: 0.22 },
      { kind: 'ELLIPSE', cx: 0.31, cy: 0.42, rx: 0.14, ry: 0.12 },
      { kind: 'ELLIPSE', cx: 0.69, cy: 0.42, rx: 0.14, ry: 0.12 },
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.84, rx: 0.26, ry: 0.05 },
    ],
  },

  SIGN: {
    id: 'SIGN',
    label: 'SIGN',
    layer: 'LAND',
    icon: GUI.SIGNPOST,
    guide: [
      { kind: 'PATH', points: [[0.47, 0.84], [0.47, 0.36]] },
      { kind: 'PATH', points: [[0.53, 0.84], [0.53, 0.36]] },
      { kind: 'PATH', points: [[0.22, 0.22], [0.78, 0.22], [0.78, 0.42], [0.22, 0.42]], closed: true },
      { kind: 'PATH', points: [[0.3, 0.3], [0.62, 0.3]] },
      { kind: 'PATH', points: [[0.3, 0.36], [0.54, 0.36]] },
    ],
  },

  BENCH: {
    id: 'BENCH',
    label: 'BENCH',
    layer: 'LAND',
    icon: GUI.PLANKS,
    guide: [
      { kind: 'PATH', points: [[0.14, 0.5], [0.86, 0.5], [0.86, 0.58], [0.14, 0.58]], closed: true },
      { kind: 'PATH', points: [[0.14, 0.62], [0.86, 0.62], [0.86, 0.7], [0.14, 0.7]], closed: true },
      { kind: 'PATH', points: [[0.24, 0.7], [0.24, 0.82]] },
      { kind: 'PATH', points: [[0.76, 0.7], [0.76, 0.82]] },
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.84, rx: 0.36, ry: 0.04 },
    ],
  },

  BARREL: {
    id: 'BARREL',
    label: 'BARREL',
    layer: 'LAND',
    icon: GUI.BARREL,
    guide: [
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.34, rx: 0.24, ry: 0.07 },
      { kind: 'PATH', points: [[0.26, 0.34], [0.22, 0.56], [0.26, 0.78]] },
      { kind: 'PATH', points: [[0.74, 0.34], [0.78, 0.56], [0.74, 0.78]] },
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.78, rx: 0.24, ry: 0.07 },
      { kind: 'PATH', points: [[0.23, 0.47], [0.77, 0.47]] },
      { kind: 'PATH', points: [[0.23, 0.65], [0.77, 0.65]] },
    ],
  },

  CONE: {
    id: 'CONE',
    label: 'CONE',
    layer: 'LAND',
    icon: GUI.CONE,
    guide: [
      { kind: 'PATH', points: [[0.5, 0.2], [0.72, 0.74], [0.28, 0.74]], closed: true },
      { kind: 'PATH', points: [[0.38, 0.44], [0.62, 0.44]] },
      { kind: 'PATH', points: [[0.33, 0.58], [0.67, 0.58]] },
      { kind: 'PATH', points: [[0.18, 0.74], [0.82, 0.74], [0.84, 0.82], [0.16, 0.82]], closed: true },
    ],
  },

  BUSH: {
    id: 'BUSH',
    label: 'BUSH',
    layer: 'LAND',
    icon: GUI.BUSH,
    guide: [
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.5, rx: 0.26, ry: 0.22 },
      { kind: 'ELLIPSE', cx: 0.28, cy: 0.6, rx: 0.18, ry: 0.16 },
      { kind: 'ELLIPSE', cx: 0.72, cy: 0.6, rx: 0.18, ry: 0.16 },
      { kind: 'PATH', points: [[0.36, 0.44], [0.42, 0.36]] },
      { kind: 'PATH', points: [[0.6, 0.42], [0.66, 0.34]] },
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.78, rx: 0.34, ry: 0.05 },
    ],
  },

  RAFT: {
    id: 'RAFT',
    label: 'RAFT',
    layer: 'WATER',
    guide: [
      { kind: 'PATH', points: [[0.16, 0.5], [0.84, 0.5], [0.8, 0.64], [0.2, 0.64]], closed: true },
      { kind: 'PATH', points: [[0.32, 0.5], [0.31, 0.64]] },
      { kind: 'PATH', points: [[0.48, 0.5], [0.48, 0.64]] },
      { kind: 'PATH', points: [[0.64, 0.5], [0.65, 0.64]] },
      { kind: 'PATH', points: [[0.1, 0.7], [0.28, 0.66], [0.5, 0.7], [0.72, 0.66], [0.9, 0.7]] },
    ],
  },

  BALLOON: {
    id: 'BALLOON',
    label: 'BALLOON',
    layer: 'SKY',
    guide: [
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.34, rx: 0.22, ry: 0.26 },
      { kind: 'PATH', points: [[0.44, 0.58], [0.5, 0.64], [0.56, 0.58]], closed: true },
      { kind: 'PATH', points: [[0.5, 0.64], [0.52, 0.76], [0.48, 0.86]] },
    ],
  },

  LANTERN: {
    id: 'LANTERN',
    label: 'LANTERN',
    layer: 'SKY',
    guide: [
      { kind: 'PATH', points: [[0.5, 0.08], [0.5, 0.24]] },
      { kind: 'PATH', points: [[0.34, 0.28], [0.66, 0.28], [0.7, 0.56], [0.3, 0.56]], closed: true },
      { kind: 'PATH', points: [[0.3, 0.34], [0.7, 0.34]] },
      { kind: 'PATH', points: [[0.3, 0.5], [0.7, 0.5]] },
      { kind: 'PATH', points: [[0.42, 0.56], [0.42, 0.7]] },
      { kind: 'PATH', points: [[0.58, 0.56], [0.58, 0.7]] },
    ],
  },
}

export function propTemplateOf(id: PropTemplateId | null): PropTemplate {
  return PROP_TEMPLATES[id ?? 'FREE']
}
