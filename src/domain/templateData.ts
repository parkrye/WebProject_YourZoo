import type { AnimalTemplate, TemplateId } from './templates'

export const TEMPLATE_ORDER: readonly TemplateId[] = [
  'FREE',
  'DEER', 'LION',
  'RABBIT',
  'MONKEY', 'PENGUIN',
  'PARROT', 'OWL',
  'FISH',
  'CROC', 'TURTLE',
]

/**
 * 그리기 가이드와 실루엣 유형.
 *
 * 라벨은 대표 동물이지만 실제 기준은 **실루엣의 생김새**다 —
 * 긴 다리 네발, 작고 둥근 몸, 낮고 긴 몸통, 큰 날개, 둥근 새, 유선형, 등껍질.
 * 그래서 사슴 템플릿으로 말이나 기린을 그려도 움직임이 어긋나지 않는다.
 *
 * 유형을 고르면 어느 위치에 어느 부위가 오는지가 약속되고,
 * `domain/motion.ts` 가 그 약속을 이용해 부위별로 다르게 움직인다.
 */
export const TEMPLATES: Record<TemplateId, AnimalTemplate> = {
  FREE: {
    id: 'FREE',
    label: 'FREE',
    habitat: null,
    suggestedType: null,
    guide: [],
    parts: [],
    archetype: 'FREE',
  },

  DEER: {
    id: 'DEER',
    label: 'DEER',
    habitat: 'LAND',
    suggestedType: 'HERD',
    guide: [
      { kind: 'ELLIPSE', cx: 0.42, cy: 0.5, rx: 0.18, ry: 0.11 },
      { kind: 'PATH', points: [[0.56, 0.45], [0.65, 0.33]] },
      { kind: 'ELLIPSE', cx: 0.71, cy: 0.28, rx: 0.075, ry: 0.055 },
      { kind: 'PATH', points: [[0.68, 0.23], [0.63, 0.12]] },
      { kind: 'PATH', points: [[0.66, 0.18], [0.59, 0.16]] },
      { kind: 'PATH', points: [[0.74, 0.23], [0.79, 0.12]] },
      { kind: 'PATH', points: [[0.76, 0.18], [0.83, 0.16]] },
      { kind: 'PATH', points: [[0.3, 0.59], [0.28, 0.8]] },
      { kind: 'PATH', points: [[0.38, 0.6], [0.38, 0.8]] },
      { kind: 'PATH', points: [[0.5, 0.6], [0.51, 0.8]] },
      { kind: 'PATH', points: [[0.56, 0.59], [0.58, 0.8]] },
      { kind: 'PATH', points: [[0.25, 0.45], [0.18, 0.4]] },
    ],
    parts: [
      { id: 'BODY', x: 0.22, y: 0.38, w: 0.4, h: 0.24 },
      { id: 'HEAD', x: 0.58, y: 0.1, w: 0.28, h: 0.26 },
      { id: 'LEG', x: 0.26, y: 0.58, w: 0.34, h: 0.24 },
    ],
    archetype: 'TALL_QUADRUPED',
  },

  /**
   * 사자·곰처럼 낮고 무거운 네발. 사슴과 같은 네발이지만 실루엣이 다르다 —
   * 다리가 짧고 몸통이 두꺼우며 목이 굵다. 걸음도 그만큼 느리고 묵직하다.
   */
  LION: {
    id: 'LION',
    label: 'LION',
    habitat: 'LAND',
    suggestedType: 'BEAST',
    guide: [
      { kind: 'ELLIPSE', cx: 0.44, cy: 0.5, rx: 0.22, ry: 0.14 },
      { kind: 'ELLIPSE', cx: 0.72, cy: 0.42, rx: 0.11, ry: 0.1 },
      // 갈기
      { kind: 'ELLIPSE', cx: 0.71, cy: 0.42, rx: 0.16, ry: 0.15 },
      { kind: 'PATH', points: [[0.78, 0.46], [0.84, 0.48]] },
      { kind: 'PATH', points: [[0.3, 0.62], [0.29, 0.78]] },
      { kind: 'PATH', points: [[0.4, 0.63], [0.4, 0.78]] },
      { kind: 'PATH', points: [[0.54, 0.63], [0.55, 0.78]] },
      { kind: 'PATH', points: [[0.62, 0.62], [0.64, 0.78]] },
      { kind: 'PATH', points: [[0.22, 0.46], [0.12, 0.38], [0.09, 0.48]] },
    ],
    parts: [
      { id: 'BODY', x: 0.2, y: 0.36, w: 0.44, h: 0.28 },
      { id: 'HEAD', x: 0.56, y: 0.26, w: 0.34, h: 0.32 },
      { id: 'LEG', x: 0.26, y: 0.6, w: 0.42, h: 0.22 },
      { id: 'TAIL', x: 0.06, y: 0.34, w: 0.18, h: 0.2 },
    ],
    archetype: 'HEAVY_QUADRUPED',
  },

  /**
   * 원숭이처럼 서서 걷고 팔이 긴 형태.
   * 토끼와 같은 '작고 둥근 몸'이 아니다 — 팔다리가 길고 서로 엇갈려 움직인다.
   */
  MONKEY: {
    id: 'MONKEY',
    label: 'MONKEY',
    habitat: 'LAND',
    suggestedType: 'BEAST',
    guide: [
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.5, rx: 0.13, ry: 0.17 },
      { kind: 'ELLIPSE', cx: 0.52, cy: 0.24, rx: 0.11, ry: 0.1 },
      { kind: 'ELLIPSE', cx: 0.42, cy: 0.22, rx: 0.04, ry: 0.045 },
      { kind: 'ELLIPSE', cx: 0.62, cy: 0.22, rx: 0.04, ry: 0.045 },
      // 긴 팔
      { kind: 'PATH', points: [[0.38, 0.4], [0.26, 0.56], [0.3, 0.68]] },
      { kind: 'PATH', points: [[0.62, 0.4], [0.74, 0.56], [0.7, 0.68]] },
      // 다리
      { kind: 'PATH', points: [[0.45, 0.67], [0.42, 0.86]] },
      { kind: 'PATH', points: [[0.55, 0.67], [0.58, 0.86]] },
      // 꼬리
      { kind: 'PATH', points: [[0.62, 0.6], [0.78, 0.66], [0.8, 0.5]] },
    ],
    parts: [
      { id: 'BODY', x: 0.35, y: 0.33, w: 0.3, h: 0.36 },
      { id: 'HEAD', x: 0.38, y: 0.12, w: 0.28, h: 0.24 },
      { id: 'LEG', x: 0.38, y: 0.66, w: 0.26, h: 0.24 },
      { id: 'TAIL', x: 0.6, y: 0.46, w: 0.24, h: 0.24 },
    ],
    archetype: 'UPRIGHT_BIPED',
  },

  /** 펭귄처럼 서서 뒤뚱거리는 형태. 다리는 거의 안 보이고 몸통이 통째로 기운다. */
  PENGUIN: {
    id: 'PENGUIN',
    label: 'PENGUIN',
    habitat: 'LAND',
    suggestedType: 'BIRD',
    guide: [
      { kind: 'PATH', points: [[0.5, 0.16], [0.66, 0.42], [0.64, 0.8], [0.36, 0.8], [0.34, 0.42]], closed: true },
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.24, rx: 0.11, ry: 0.1 },
      { kind: 'PATH', points: [[0.56, 0.26], [0.66, 0.29], [0.56, 0.32]], closed: true },
      // 지느러미 같은 날개
      { kind: 'PATH', points: [[0.34, 0.4], [0.24, 0.62], [0.33, 0.64]], closed: true },
      { kind: 'PATH', points: [[0.66, 0.4], [0.76, 0.62], [0.67, 0.64]], closed: true },
      { kind: 'PATH', points: [[0.42, 0.8], [0.36, 0.88], [0.46, 0.88]], closed: true },
      { kind: 'PATH', points: [[0.58, 0.8], [0.54, 0.88], [0.64, 0.88]], closed: true },
    ],
    parts: [
      { id: 'BODY', x: 0.32, y: 0.32, w: 0.36, h: 0.5 },
      { id: 'HEAD', x: 0.37, y: 0.12, w: 0.3, h: 0.24 },
      { id: 'WING', x: 0.22, y: 0.36, w: 0.16, h: 0.3 },
      { id: 'LEG', x: 0.34, y: 0.78, w: 0.32, h: 0.14 },
    ],
    archetype: 'WADDLER',
  },

  RABBIT: {
    id: 'RABBIT',
    label: 'RABBIT',
    habitat: 'LAND',
    suggestedType: 'HERD',
    guide: [
      { kind: 'ELLIPSE', cx: 0.43, cy: 0.6, rx: 0.17, ry: 0.14 },
      { kind: 'ELLIPSE', cx: 0.64, cy: 0.47, rx: 0.095, ry: 0.085 },
      { kind: 'PATH', points: [[0.61, 0.4], [0.57, 0.16], [0.63, 0.38]], closed: true },
      { kind: 'PATH', points: [[0.69, 0.4], [0.74, 0.17], [0.75, 0.39]], closed: true },
      { kind: 'PATH', points: [[0.6, 0.7], [0.6, 0.8]] },
      { kind: 'PATH', points: [[0.36, 0.71], [0.34, 0.8]] },
      { kind: 'ELLIPSE', cx: 0.26, cy: 0.56, rx: 0.045, ry: 0.045 },
    ],
    parts: [
      { id: 'BODY', x: 0.24, y: 0.45, w: 0.38, h: 0.32 },
      { id: 'HEAD', x: 0.54, y: 0.14, w: 0.24, h: 0.26 },
      { id: 'LEG', x: 0.3, y: 0.68, w: 0.34, h: 0.16 },
    ],
    archetype: 'SMALL_HOPPER',
  },

  CROC: {
    id: 'CROC',
    label: 'CROC',
    habitat: 'LAND',
    suggestedType: 'REPTILE',
    guide: [
      { kind: 'PATH', points: [[0.1, 0.58], [0.28, 0.52], [0.55, 0.52], [0.7, 0.54]] },
      { kind: 'PATH', points: [[0.1, 0.64], [0.28, 0.62], [0.55, 0.62], [0.7, 0.6]] },
      { kind: 'PATH', points: [[0.7, 0.5], [0.93, 0.55], [0.7, 0.62]], closed: true },
      {
        kind: 'PATH',
        points: [[0.22, 0.53], [0.27, 0.45], [0.32, 0.53], [0.37, 0.45], [0.42, 0.53], [0.47, 0.46], [0.52, 0.53]],
      },
      { kind: 'PATH', points: [[0.26, 0.64], [0.22, 0.73]] },
      { kind: 'PATH', points: [[0.54, 0.64], [0.58, 0.73]] },
      { kind: 'PATH', points: [[0.1, 0.6], [0.03, 0.66]] },
    ],
    parts: [
      { id: 'BODY', x: 0.08, y: 0.44, w: 0.6, h: 0.24 },
      { id: 'HEAD', x: 0.66, y: 0.48, w: 0.3, h: 0.16 },
      { id: 'LEG', x: 0.2, y: 0.62, w: 0.42, h: 0.14 },
    ],
    archetype: 'LOW_CRAWLER',
  },

  PARROT: {
    id: 'PARROT',
    label: 'PARROT',
    habitat: 'SKY',
    suggestedType: 'BIRD',
    guide: [
      { kind: 'ELLIPSE', cx: 0.47, cy: 0.52, rx: 0.15, ry: 0.19 },
      { kind: 'ELLIPSE', cx: 0.56, cy: 0.29, rx: 0.095, ry: 0.085 },
      { kind: 'PATH', points: [[0.64, 0.28], [0.76, 0.33], [0.64, 0.37]], closed: true },
      { kind: 'PATH', points: [[0.52, 0.22], [0.46, 0.08], [0.57, 0.19]], closed: true },
      { kind: 'PATH', points: [[0.4, 0.42], [0.27, 0.58], [0.42, 0.66]], closed: true },
      { kind: 'PATH', points: [[0.43, 0.69], [0.34, 0.93]] },
      { kind: 'PATH', points: [[0.48, 0.7], [0.48, 0.95]] },
      { kind: 'PATH', points: [[0.53, 0.69], [0.62, 0.92]] },
    ],
    parts: [
      { id: 'BODY', x: 0.31, y: 0.33, w: 0.32, h: 0.38 },
      { id: 'HEAD', x: 0.46, y: 0.06, w: 0.32, h: 0.33 },
      { id: 'WING', x: 0.25, y: 0.4, w: 0.2, h: 0.28 },
      { id: 'TAIL', x: 0.32, y: 0.68, w: 0.32, h: 0.28 },
    ],
    archetype: 'BROAD_WING',
  },

  OWL: {
    id: 'OWL',
    label: 'OWL',
    habitat: 'SKY',
    suggestedType: 'BIRD',
    guide: [
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.58, rx: 0.19, ry: 0.22 },
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.32, rx: 0.17, ry: 0.14 },
      { kind: 'ELLIPSE', cx: 0.43, cy: 0.32, rx: 0.05, ry: 0.05 },
      { kind: 'ELLIPSE', cx: 0.57, cy: 0.32, rx: 0.05, ry: 0.05 },
      { kind: 'PATH', points: [[0.5, 0.37], [0.53, 0.43], [0.47, 0.43]], closed: true },
      { kind: 'PATH', points: [[0.37, 0.22], [0.33, 0.11], [0.43, 0.19]], closed: true },
      { kind: 'PATH', points: [[0.63, 0.22], [0.67, 0.11], [0.57, 0.19]], closed: true },
      { kind: 'PATH', points: [[0.33, 0.5], [0.29, 0.72], [0.38, 0.75]], closed: true },
      { kind: 'PATH', points: [[0.44, 0.79], [0.44, 0.87]] },
      { kind: 'PATH', points: [[0.56, 0.79], [0.56, 0.87]] },
    ],
    parts: [
      { id: 'BODY', x: 0.3, y: 0.36, w: 0.4, h: 0.44 },
      { id: 'HEAD', x: 0.31, y: 0.09, w: 0.38, h: 0.3 },
      { id: 'WING', x: 0.27, y: 0.46, w: 0.14, h: 0.3 },
    ],
    archetype: 'ROUND_BIRD',
  },

  FISH: {
    id: 'FISH',
    label: 'FISH',
    habitat: 'WATER',
    suggestedType: 'FISH',
    guide: [
      { kind: 'ELLIPSE', cx: 0.5, cy: 0.5, rx: 0.26, ry: 0.15 },
      { kind: 'PATH', points: [[0.24, 0.5], [0.08, 0.36], [0.12, 0.5], [0.08, 0.64]], closed: true },
      { kind: 'PATH', points: [[0.42, 0.36], [0.5, 0.24], [0.6, 0.37]], closed: true },
      { kind: 'PATH', points: [[0.44, 0.64], [0.5, 0.74], [0.58, 0.63]], closed: true },
      { kind: 'ELLIPSE', cx: 0.68, cy: 0.47, rx: 0.022, ry: 0.022 },
    ],
    parts: [
      { id: 'BODY', x: 0.24, y: 0.35, w: 0.52, h: 0.3 },
      { id: 'TAIL', x: 0.06, y: 0.34, w: 0.2, h: 0.32 },
      { id: 'FIN', x: 0.4, y: 0.22, w: 0.22, h: 0.16 },
    ],
    archetype: 'STREAMLINED',
  },

  TURTLE: {
    id: 'TURTLE',
    label: 'TURTLE',
    habitat: 'WATER',
    suggestedType: 'REPTILE',
    guide: [
      { kind: 'ELLIPSE', cx: 0.46, cy: 0.48, rx: 0.23, ry: 0.16 },
      {
        kind: 'PATH',
        points: [[0.36, 0.4], [0.46, 0.36], [0.56, 0.4], [0.56, 0.52], [0.46, 0.57], [0.36, 0.52]],
        closed: true,
      },
      { kind: 'PATH', points: [[0.36, 0.4], [0.28, 0.46], [0.36, 0.52]] },
      { kind: 'PATH', points: [[0.56, 0.4], [0.64, 0.46], [0.56, 0.52]] },
      { kind: 'ELLIPSE', cx: 0.75, cy: 0.52, rx: 0.08, ry: 0.062 },
      { kind: 'PATH', points: [[0.6, 0.6], [0.68, 0.71]] },
      { kind: 'PATH', points: [[0.32, 0.6], [0.24, 0.7]] },
      { kind: 'PATH', points: [[0.24, 0.5], [0.16, 0.53]] },
    ],
    parts: [
      { id: 'BODY', x: 0.22, y: 0.3, w: 0.48, h: 0.34 },
      { id: 'HEAD', x: 0.66, y: 0.44, w: 0.18, h: 0.16 },
      { id: 'LEG', x: 0.22, y: 0.58, w: 0.48, h: 0.16 },
    ],
    archetype: 'SHELLED',
  },
}

export function templateOf(id: TemplateId | null): AnimalTemplate {
  return TEMPLATES[id ?? 'FREE']
}
