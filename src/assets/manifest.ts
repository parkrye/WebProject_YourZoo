/**
 * 모든 에셋의 참조와 슬라이싱 스펙.
 * docs/01-assets.md 의 구현체이며, 문서와 항상 동기화되어야 한다.
 *
 * 이미지는 `src/assets/images/` 에서 **번들러가 import** 한다.
 * 알파가 없던 원본은 `scripts/prepare-assets.py` 가 빌드 전에 이미 처리해 두었으므로
 * 런타임에서 배경을 손대는 코드는 없다.
 */
import skyDay from './images/bg/sky-day.png'
import skyAfternoon from './images/bg/sky-afternoon.png'
import skyNight from './images/bg/sky-night.png'
import areaField from './images/bg/area-field.png'
import areaDesert from './images/bg/area-desert.png'
import areaIce from './images/bg/area-ice.png'
import fence from './images/bg/fence.png'
import iconFont from './images/sprite/icon-font.png'
import iconGui from './images/sprite/icon-gui.png'
import propField from './images/sprite/prop-field.png'
import propDesert from './images/sprite/prop-desert.png'
import propIce from './images/sprite/prop-ice.png'
import humanVisitor from './images/sprite/human-visitor.png'

/** 논리 해상도. 모든 게임 좌표는 이 공간의 정규화값(0..1)이다. */
export const LOGICAL_WIDTH = 1672
export const LOGICAL_HEIGHT = 941
export const LOGICAL_ASPECT = LOGICAL_WIDTH / LOGICAL_HEIGHT

export type SkyPhase = 'DAY' | 'AFTERNOON' | 'NIGHT'
export type BiomeId = 'FIELD' | 'DESERT' | 'ICE'

export const SKY_SRC: Record<SkyPhase, string> = {
  DAY: skyDay,
  AFTERNOON: skyAfternoon,
  NIGHT: skyNight,
}

export const AREA_SRC: Record<BiomeId, string> = {
  FIELD: areaField,
  DESERT: areaDesert,
  ICE: areaIce,
}

export const PROP_SRC: Record<BiomeId, string> = {
  FIELD: propField,
  DESERT: propDesert,
  ICE: propIce,
}

export const FENCE_SRC = fence
export const VISITOR_SRC = humanVisitor
export const GUI_SRC = iconGui
export const FONT_SRC = iconFont

// ─────────────────────────────────────────────────────────────
// 그리드 스펙
// ─────────────────────────────────────────────────────────────

export interface GridSpec {
  readonly cols: number
  readonly rows: number
  /** 시트 원본 크기. 셀 크기는 sheetW/cols 로 계산하며 소수일 수 있다. */
  readonly sheetW: number
  readonly sheetH: number
}

export const GUI_GRID: GridSpec = { cols: 6, rows: 6, sheetW: 1254, sheetH: 1254 }
export const FONT_GRID: GridSpec = { cols: 6, rows: 6, sheetW: 1024, sheetH: 1536 }
export const VISITOR_GRID: GridSpec = { cols: 8, rows: 4, sheetW: 1774, sheetH: 887 }

/** 프롭 시트는 바이옴마다 원본 크기가 다르다. */
export const PROP_GRID: Record<BiomeId, GridSpec> = {
  FIELD: { cols: 4, rows: 4, sheetW: 1262, sheetH: 1246 },
  DESERT: { cols: 4, rows: 4, sheetW: 1254, sheetH: 1254 },
  ICE: { cols: 4, rows: 4, sheetW: 1312, sheetH: 1199 },
}

/** 프롭 인덱스 0..7 = 물 영역, 8..15 = 땅 영역. */
export const PROP_WATER_INDICES = [0, 1, 2, 3, 4, 5, 6, 7] as const
export const PROP_LAND_INDICES = [8, 9, 10, 11, 12, 13, 14, 15] as const

// ─────────────────────────────────────────────────────────────
// GUI 아이콘 인덱스 (row * 6 + col)
// ─────────────────────────────────────────────────────────────

export const GUI = {
  SETTINGS: 0, VOLUME_ON: 1, VOLUME_OFF: 2, MUSIC_ON: 3, MUSIC_OFF: 4, BACK: 5,
  CURSOR: 6, HAND: 7, ZOOM: 8, ZOOM_IN: 9, ZOOM_OUT: 10, MOVE: 11,
  COIN: 12, MEDAL: 13, SCROLL: 14, SUBMIT: 15, MAP: 16, BOOK: 17,
  PENCIL: 18, ERASER: 19, UNDO: 20, REDO: 21, TRASH: 22, PALETTE: 23,
  PENCIL_YELLOW: 24, PENCIL_RED: 25, PENCIL_BLUE: 26,
  PENCIL_GREEN: 27, PENCIL_BROWN: 28, PENCIL_BLACK: 29,
  BINOCULARS: 30, INFO: 31, HELP: 32, CLOSE: 33, CONFIRM: 34, EYE_OFF: 35,
} as const

export type GuiIcon = (typeof GUI)[keyof typeof GUI]

/** 팔레트 색상 — GUI 연필 아이콘 6종과 1:1 대응. */
export const PALETTE_COLORS = [
  { icon: GUI.PENCIL_YELLOW, hex: '#F2C230' },
  { icon: GUI.PENCIL_RED, hex: '#D8382F' },
  { icon: GUI.PENCIL_BLUE, hex: '#2F72D8' },
  { icon: GUI.PENCIL_GREEN, hex: '#49A83A' },
  { icon: GUI.PENCIL_BROWN, hex: '#8A5A2B' },
  { icon: GUI.PENCIL_BLACK, hex: '#2B2B2B' },
] as const

// ─────────────────────────────────────────────────────────────
// 폰트
// ─────────────────────────────────────────────────────────────

/** 시트의 글자 배열 순서. 정확히 36자 = 6×6. */
export const FONT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// ─────────────────────────────────────────────────────────────
// 로밍 박스 (정규화 좌표) — docs/01-assets.md §1.1
// ─────────────────────────────────────────────────────────────

export type Habitat = 'SKY' | 'LAND' | 'WATER'

export interface RoamBox {
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly y1: number
}

export const ROAM_BOX: Record<Habitat, RoamBox> = {
  // SKY 상단은 HUD(일자·시계·우리 이름)가 차지한다. 0.04 로 두면 글자와 겹친다.
  SKY: { x0: 0.04, x1: 0.96, y0: 0.10, y1: 0.26 },
  LAND: { x0: 0.04, x1: 0.96, y0: 0.52, y1: 0.66 },
  // 0.72 는 물가 잔디 경계라 동물이 뭍에 걸쳐 보인다. 확실히 물속으로 내린다.
  WATER: { x0: 0.04, x1: 0.96, y0: 0.75, y1: 0.96 },
}

// ─────────────────────────────────────────────────────────────
// 펜스 / 손님
// ─────────────────────────────────────────────────────────────

/** 펜스 Y 오프셋 (화면 높이 비율). 상세보기에서 펜스를 내려 물 영역을 노출한다. */
export const FENCE_OFFSET_ZOO = 0
export const FENCE_OFFSET_DETAIL = 0.2

/**
 * 손님의 발이 놓이는 기준선 (정규화 y).
 *
 * 손님은 펜스보다 **앞에**, 즉 관람로 위에 선다. 그러려면 발이 화면 바닥에
 * 닿거나 조금 더 아래에서 시작해야 크기 비율이 맞는다.
 *
 * 한 줄로 세우면 종잇장처럼 평평해 보인다. 개체마다 앞뒤로 흩어 놓아
 * **관람로에 깊이가 있는 것처럼** 만든다 — `far` 가 뒤(위), `near` 가 앞(아래)이다.
 */
export const VISITOR_BASELINE = { far: 0.97, near: 1.1 } as const

/** 앞에 선 손님일수록 크게 보인다. */
export const VISITOR_PERSPECTIVE = { far: 0.84, near: 1.1 } as const

/**
 * 손님 높이의 기준값 (정규화).
 * **가장 큰 스프라이트**가 이 높이가 되고, 나머지는 원본 비율만큼 작아진다.
 */
export const VISITOR_HEIGHT = 0.46

// ─────────────────────────────────────────────────────────────
// 동물 / 프롭 크기 (정규화 높이)
// ─────────────────────────────────────────────────────────────

/**
 * 서식지별 동물 기본 높이.
 *
 * 화면은 위가 멀고 아래가 가깝다 — 하늘(y 0.10~0.26)이 가장 멀고,
 * 땅(0.52~0.66)이 중간, 물(0.75~0.96)이 카메라에 가장 가깝다.
 * 따라서 크기는 **물 > 땅 > 하늘** 순이어야 원근이 맞는다.
 */
export const ANIMAL_HEIGHT: Record<Habitat, number> = {
  SKY: 0.075,
  LAND: 0.11,
  // 물은 화면 맨 아래라 원근 배율(최대 1.18)까지 곱해진다. 기준값을 땅보다 조금만 크게 둔다.
  WATER: 0.12,
}

/** y 가 클수록(카메라에 가까울수록) 크게 보이는 원근 배율 범위. */
export const PERSPECTIVE_SCALE = { near: 1.18, far: 0.82 } as const

/** 프롭도 같은 원근을 따른다. 땅이 물보다 멀다. */
export const PROP_HEIGHT = { LAND: 0.1, WATER: 0.14 } as const

/** 우리 하나에 배치되는 프롭 개수. */
export const PROP_COUNT = { LAND: 4, WATER: 3 } as const
