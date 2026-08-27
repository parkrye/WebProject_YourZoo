/**
 * 모든 원본 에셋의 경로와 슬라이싱 스펙.
 * docs/01-assets.md 의 구현체이며, 문서와 항상 동기화되어야 한다.
 */

/** 논리 해상도. 모든 게임 좌표는 이 공간의 정규화값(0..1)이다. */
export const LOGICAL_WIDTH = 1672
export const LOGICAL_HEIGHT = 941
export const LOGICAL_ASPECT = LOGICAL_WIDTH / LOGICAL_HEIGHT

export type SkyPhase = 'DAY' | 'AFTERNOON' | 'NIGHT'
export type BiomeId = 'FIELD' | 'DESERT' | 'ICE'

export const SKY_SRC: Record<SkyPhase, string> = {
  DAY: '/bg_sky_day.png',
  AFTERNOON: '/bg_sky_afternoon.png',
  NIGHT: '/bg_sky_night.png',
}

export const AREA_SRC: Record<BiomeId, string> = {
  FIELD: '/bg_area_field.png',
  DESERT: '/bg_area_desert.png',
  ICE: '/bg_area_ice.png',
}

export const PROP_SRC: Record<BiomeId, string> = {
  FIELD: '/sprite_prop_field.png',
  DESERT: '/sprite_prop_desert.png',
  ICE: '/sprite_prop_ice.png',
}

export const FENCE_SRC = '/bg_forward_fence.png'
export const VISITOR_SRC = '/sprite_human_visitor.png'
export const GUI_SRC = '/sprite_icon_gui.png'
export const FONT_SRC = '/sprite_icon_font.png'
export const POPUP_SRC = '/sprite_ui_popup.png'

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
 * 손님의 발이 놓이는 기준선 (정규화 y). 펜스 스톤 베이스 상단.
 * 이 값과 VISITOR_HEIGHT 의 차이가 머리 높이이고, 펜스 난간 상단(≈0.56)보다
 * 위에 와야 "난간에 서서 들여다보는" 뒷모습으로 읽힌다.
 */
export const VISITOR_BASELINE_Y = 0.82

/** 손님 스프라이트의 화면상 높이 (정규화). 검출된 실제 잉크 높이 기준이다. */
export const VISITOR_HEIGHT = 0.32

// ─────────────────────────────────────────────────────────────
// 동물 / 프롭 크기 (정규화 높이)
// ─────────────────────────────────────────────────────────────

/** 서식지별 동물 기본 높이. 하늘은 원경이라 작게, 땅은 가장 크게. */
export const ANIMAL_HEIGHT: Record<Habitat, number> = {
  SKY: 0.09,
  LAND: 0.15,
  WATER: 0.11,
}

/** y 가 클수록(카메라에 가까울수록) 크게 보이는 원근 배율 범위. */
export const PERSPECTIVE_SCALE = { near: 1.18, far: 0.82 } as const

export const PROP_HEIGHT = { LAND: 0.17, WATER: 0.1 } as const

/** 우리 하나에 배치되는 프롭 개수. */
export const PROP_COUNT = { LAND: 4, WATER: 3 } as const

// ─────────────────────────────────────────────────────────────
// 팝업 9-슬라이스 (frame 0: 표준 팝업)
// ─────────────────────────────────────────────────────────────

export const POPUP_FRAME_0 = { sx: 45, sy: 18, sw: 570, sh: 362 } as const
/** 9-슬라이스 인셋 (프레임 0 로컬 px). 코너 금속 장식이 잘리지 않는 최소값. */
export const POPUP_INSET = { top: 118, right: 92, bottom: 84, left: 92 } as const
