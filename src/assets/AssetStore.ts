import { Atlas } from './atlas'
import { cutoutBackground, cutoutBlackBackground } from './cutout'
import { loadImages, type ProgressFn } from './loader'
import {
  AREA_SRC, FENCE_SRC, FONT_GRID, FONT_SRC, GUI_GRID, GUI_SRC,
  POPUP_SRC, PROP_GRID, PROP_SRC, SKY_SRC, VISITOR_GRID, VISITOR_SRC,
  type BiomeId, type SkyPhase,
} from './manifest'
import { BitmapFont } from '@/render/BitmapText'

export interface Assets {
  readonly sky: Record<SkyPhase, HTMLImageElement>
  readonly area: Record<BiomeId, HTMLImageElement>
  readonly prop: Record<BiomeId, Atlas>
  readonly fence: HTMLImageElement
  readonly visitor: Atlas
  readonly gui: Atlas
  readonly guiSrc: string
  readonly popup: HTMLImageElement
  readonly font: BitmapFont
  /** 컷아웃된 폰트 시트. 디버그 페이지에서 눈으로 검증할 때 쓴다. */
  readonly fontSheet: HTMLCanvasElement
}

let cached: Assets | null = null

export function getAssets(): Assets {
  if (!cached) throw new Error('AssetStore: loadAssets() 가 먼저 완료되어야 한다')
  return cached
}

export async function loadAssets(onProgress?: ProgressFn): Promise<Assets> {
  if (cached) return cached

  const srcs = [
    ...Object.values(SKY_SRC),
    ...Object.values(AREA_SRC),
    ...Object.values(PROP_SRC),
    FENCE_SRC, VISITOR_SRC, GUI_SRC, FONT_SRC, POPUP_SRC,
  ]

  const images = await loadImages(srcs, onProgress)
  const pick = (src: string): HTMLImageElement => {
    const img = images.get(src)
    if (!img) throw new Error(`AssetStore: 누락된 에셋 ${src}`)
    return img
  }

  // 폰트 시트는 불투명 갈색 배경이 깔려 있어 그대로 못 쓴다. (docs/01-assets.md §2.2)
  const fontSheet = cutoutBackground(pick(FONT_SRC))
  const fontAtlas = new Atlas(fontSheet, FONT_GRID, { detect: true })

  // 손님 시트와 사막 프롭 시트는 알파 채널이 아예 없다(RGB). 검은 배경을 걷어내야 한다.
  const visitorSheet = cutoutBlackBackground(pick(VISITOR_SRC))
  const propDesertSheet = cutoutBlackBackground(pick(PROP_SRC.DESERT))

  cached = {
    sky: {
      DAY: pick(SKY_SRC.DAY),
      AFTERNOON: pick(SKY_SRC.AFTERNOON),
      NIGHT: pick(SKY_SRC.NIGHT),
    },
    area: {
      FIELD: pick(AREA_SRC.FIELD),
      DESERT: pick(AREA_SRC.DESERT),
      ICE: pick(AREA_SRC.ICE),
    },
    // 프롭·손님 시트도 그림이 명목 셀 경계를 넘나든다. 검출한 실제 박스를 쓴다.
    prop: {
      FIELD: new Atlas(pick(PROP_SRC.FIELD), PROP_GRID.FIELD, { detect: true }),
      DESERT: new Atlas(propDesertSheet, PROP_GRID.DESERT, { detect: true }),
      ICE: new Atlas(pick(PROP_SRC.ICE), PROP_GRID.ICE, { detect: true }),
    },
    fence: pick(FENCE_SRC),
    visitor: new Atlas(visitorSheet, VISITOR_GRID, { detect: true }),
    // GUI 아이콘은 명목 셀 경계를 넘나든다 → 알파 검출로 실제 박스를 쓴다.
    gui: new Atlas(pick(GUI_SRC), GUI_GRID, { detect: true }),
    guiSrc: GUI_SRC,
    popup: pick(POPUP_SRC),
    font: new BitmapFont(fontSheet, fontAtlas),
    fontSheet,
  }

  return cached
}
