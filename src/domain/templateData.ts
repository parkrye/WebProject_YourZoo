import type { AnimalTemplate, TemplateId } from './templates'

const NO_WAVE = { waveAmplitude: 0, waveCycles: 0, waveSpeed: 0 }

export const TEMPLATE_ORDER: readonly TemplateId[] = [
  'FREE', 'DEER', 'RABBIT', 'CROC', 'PARROT', 'OWL', 'FISH', 'TURTLE',
]

/**
 * 그리기 가이드와 움직임 프로파일.
 *
 * 추상적인 분류(BIRD / BEAST)가 아니라 **구체적인 동물**로 둔다.
 * "새를 그리세요"보다 "앵무새를 그리세요"가 손이 훨씬 잘 움직이고,
 * 볏·부리·꼬리깃이 어디쯤인지 가이드가 알려 주니 움직임 프로파일과도 어긋나지 않는다.
 */
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
    motion: { waveAmplitude: 0.02, waveCycles: 0.6, waveSpeed: 5, bob: 0.04, bobSpeed: 6.5, lean: 0.09 },
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
    // 토끼는 걷지 않고 통통 튄다. 보빙을 크고 빠르게.
    motion: { waveAmplitude: 0.015, waveCycles: 0.5, waveSpeed: 6, bob: 0.085, bobSpeed: 9, lean: 0.06 },
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
    // 몸통 전체가 느리게 굽이친다.
    motion: { waveAmplitude: 0.05, waveCycles: 1.4, waveSpeed: 3.2, bob: 0.01, bobSpeed: 2, lean: 0.03 },
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
    motion: { waveAmplitude: 0.022, waveCycles: 0.9, waveSpeed: 10, bob: 0.055, bobSpeed: 9.5, lean: 0.13 },
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
    // 올빼미는 크고 느리게 난다.
    motion: { waveAmplitude: 0.018, waveCycles: 0.7, waveSpeed: 5.5, bob: 0.07, bobSpeed: 5, lean: 0.08 },
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
    motion: { waveAmplitude: 0.075, waveCycles: 1.1, waveSpeed: 7, bob: 0.012, bobSpeed: 2, lean: 0.04 },
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
    // 아주 느긋하게 떠다닌다.
    motion: { waveAmplitude: 0.025, waveCycles: 0.8, waveSpeed: 2.4, bob: 0.02, bobSpeed: 2.2, lean: 0.03 },
  },
}

export function templateOf(id: TemplateId | null): AnimalTemplate {
  return TEMPLATES[id ?? 'FREE']
}
