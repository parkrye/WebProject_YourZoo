/**
 * 첫 플레이 안내.
 *
 * 목표는 **첫 동물을 우리에 세우는 것**까지다. 거기까지 가면 나머지 규칙은
 * 화면을 보며 알 수 있다. 각 단계는 플레이어가 실제로 그 행동을 했을 때만 넘어간다.
 */
export type TutorialStep =
  | 'ORDER'      // 요청 버튼을 눌러 보라
  | 'DRAW'       // 이름과 그림을 채워 제출하라
  | 'INSPECT'    // 우리 안으로 들어가라
  | 'STORAGE'    // 창고를 열어 보라
  | 'PLACE'      // 끌어다 우리에 놓아라
  | 'DONE'

export interface TutorialHint {
  /** 강조할 요소의 CSS 선택자. 없으면 화면 중앙에 안내만 띄운다. */
  readonly target: string | null
  readonly title: string
  readonly body: string
}

export const TUTORIAL_HINTS: Record<Exclude<TutorialStep, 'DONE'>, TutorialHint> = {
  ORDER: {
    target: '[data-tutorial="request"]',
    title: 'ORDER AN ANIMAL',
    body: 'YOUR ZOO IS EMPTY. OPEN THE REQUEST FORM TO DESIGN ONE.',
  },
  DRAW: {
    target: null,
    title: 'DESIGN IT',
    body: 'NAME IT, PICK A TEMPLATE, DRAW IT FACING RIGHT, THEN SUBMIT.',
  },
  INSPECT: {
    target: '[data-tutorial="inspect"]',
    title: 'IT ARRIVED',
    body: 'STEP INTO THE ENCLOSURE TO PLACE IT.',
  },
  STORAGE: {
    target: '[data-tutorial="storage"]',
    title: 'OPEN STORAGE',
    body: 'YOUR FIRST ANIMAL IS WAITING THERE.',
  },
  PLACE: {
    target: '.storage-item',
    title: 'PLACE IT',
    body: 'DRAG IT ONTO ITS HABITAT AREA. ONLY PLACED ANIMALS EARN GOLD.',
  },
}
