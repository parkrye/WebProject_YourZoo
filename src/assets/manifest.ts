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
import iconFontSmall from './images/sprite/icon-font-small.png'
import iconGui from './images/sprite/icon-gui.png'
import iconGui2 from './images/sprite/icon-gui2.png'
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
export const GUI2_SRC = iconGui2
export const FONT_SRC = iconFont
export const FONT_SMALL_SRC = iconFontSmall

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
/**
 * 두 번째 GUI 시트. 전처리에서 **균등 격자로 다시 짰다.**
 *
 * 원본은 칸 사이에 격자선이 그려져 있고 줄 높이도 균등하지 않았다(가로선이 256, 512, 745).
 * 게다가 마지막 줄 두 칸이 비어 있어, 알파 검출에 맡기면 칸 수를 맞추려고
 * 나무와 트로피를 반으로 쪼갠다. 그래서 전처리가 아이콘을 칸에 꽉 채워 다시 쌓는다.
 */
export const GUI2_GRID: GridSpec = { cols: 6, rows: 4, sheetW: 1506, sheetH: 1004 }
export const FONT_GRID: GridSpec = { cols: 7, rows: 7, sheetW: 1232, sheetH: 1491 }
/**
 * 작은 폰트. 전처리에서 **공통 여백만 잘라** 균등 격자로 다시 짰다.
 *
 * 큰 폰트와 달리 칸별 검출을 쓰지 않는다 — 이 폰트에는 디센더(g j p q y)가 있어서
 * 칸마다 아래를 맞추면 g 의 꼬리가 a 의 바닥에 붙어 글자가 들쭉날쭉해진다.
 */
export const FONT_SMALL_GRID: GridSpec = { cols: 7, rows: 7, sheetW: 903, sheetH: 1232 }
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

  // ── 두 번째 시트 (6x4) ──────────────────────────────────────
  // 번호를 이어 붙여 **아이콘 공간을 하나로 유지한다.** 호출부는 어느 시트인지
  // 알 필요가 없다 — `GUI.TREE` 나 `GUI.COIN` 이나 쓰는 법이 같다.
  COIN_STACK: 36, COIN_LARGE: 37, CLOCK_FACE: 38, CLOCK_HAND: 39, HEART: 40, STAR: 41,
  LOCK: 42, LOCK_OPEN: 43, SHOP: 44, CRATE: 45, TRUCK: 46, PAINT: 47,
  PAW: 48, BARREL: 49, CONE: 50, SIGNPOST: 51, PLANKS: 52, BUSH: 53,
  TREE: 54, TROPHY: 55, FILM: 56, PEOPLE: 57,
} as const

/** 이 번호부터는 두 번째 시트다. */
export const GUI_SHEET2_BASE = 36

/*
  시계 아이콘의 실측값. 모두 **칸 크기 대비** 비율이다.

  두 아이콘은 각자 칸을 꽉 채우도록 그려져 있어, 그냥 겹쳐 놓으면 바늘이
  문자판보다 커서 밖으로 뻗는다. 문자판의 원이 어디인지, 바늘의 축이 어디인지를
  재어 두고 그때그때 맞춘다.
*/

/** 문자판 원의 중심. 위쪽 고리 때문에 칸 한가운데가 아니다. */
export const CLOCK_FACE_CENTRE = { x: 0.498, y: 0.49 } as const

/** 바늘의 회전축(아래쪽 구슬). 칸 한가운데로 돌리면 바늘이 원을 그리며 떠다닌다. */
export const CLOCK_HAND_PIVOT = { x: 0.498, y: 0.809 } as const

/** 축에서 바늘 끝까지가 문자판 반지름(0.458)의 어디까지 닿을지. */
export const CLOCK_HAND_REACH = 0.36

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
/**
 * 시트의 칸 순서. 7x7 = 49칸 중 48칸을 쓴다.
 *
 * 기호가 없던 때는 코드가 우회하고 있었다 — 손익은 부호를 떼고 색으로만 구분했고,
 * `0 / 3` 은 `0  3` 으로, `10 + 1` 은 `10 1` 로 떴고, 천 단위는 공백으로 끊었다.
 * 이제 그럴 필요가 없다.
 *
 */
export const FONT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/+?.%:!',()>"

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
 * 손님의 몸이 화면 아래로 잠기는 비율 — **자기 키 기준**이다.
 *
 * 손님은 펜스보다 **앞에**, 즉 카메라 쪽 관람로에 선다. 그래서 아래가 잘린다.
 * 어디가 잘리느냐로 앞뒤가 읽힌다: 뒤에 선 사람은 **허리까지** 보이고,
 * 앞에 선 사람은 **어깨 위만** 화면에 걸린다.
 *
 * 절대 y 기준선을 쓰면 안 된다. 손님 스프라이트는 어른·아이가 원본부터 키가 달라서,
 * 같은 선에 발을 두면 아이는 통째로 화면 밖으로 사라지고 어른만 남는다.
 * 자기 키의 몇 %가 잠기는지로 잡아야 누구든 같은 신체 부위에서 잘린다.
 */
export const VISITOR_SUBMERGE = { far: 0.12, near: 0.67 } as const

/**
 * 앞에 선 손님일수록 크게 보인다.
 *
 * 폭이 넓다. 좁게 잡으면 잠기는 정도만 달라지고 **크기가 같아서** 깊이로 읽히지 않는다 —
 * 관람로 맨 앞 사람은 카메라 코앞이라 화면 높이의 2/3 를 넘게 차지해야 맞다.
 */
export const VISITOR_PERSPECTIVE = { far: 0.85, near: 1.5 } as const

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
