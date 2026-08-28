import { Atlas } from './atlas'
import { loadImages, type ProgressFn } from './loader'
import {
  AREA_SRC, FENCE_SRC, FONT_GRID, FONT_SRC, GUI_GRID, GUI_SRC, GUI2_GRID, GUI2_SRC,
  FONT_SMALL_GRID, FONT_SMALL_SRC,
  PROP_GRID, PROP_SRC, SKY_SRC, VISITOR_GRID, VISITOR_SRC,
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
  readonly gui2: Atlas
  readonly gui2Src: string
  readonly font: BitmapFont
  /** 작은 글씨용. 큰 폰트를 작게 줄이면 획이 뭉개진다. */
  readonly fontSmall: BitmapFont
  /** 폰트 시트. 디버그 페이지에서 눈으로 검증할 때 쓴다. */
  readonly fontSheet: HTMLImageElement
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
    FONT_SMALL_SRC,
    FENCE_SRC, VISITOR_SRC, GUI_SRC, GUI2_SRC, FONT_SRC,
  ]

  const images = await loadImages(srcs, onProgress)
  const pick = (src: string): HTMLImageElement => {
    const img = images.get(src)
    if (!img) throw new Error(`AssetStore: 누락된 에셋 ${src}`)
    return img
  }

  // 모든 에셋은 scripts/prepare-assets.py 가 이미 알파를 정리해 두었다.
  // 런타임에서 배경을 손대지 않는다.
  const fontSheet = pick(FONT_SRC)
  const fontAtlas = new Atlas(fontSheet, FONT_GRID, { detect: true })
  // 작은 폰트는 검출하지 않는다. 여백은 전처리에서 이미 잘렸고,
  // 칸마다 다시 재면 디센더가 베이스라인을 흔든다.
  const smallSheet = pick(FONT_SMALL_SRC)
  const smallAtlas = new Atlas(smallSheet, FONT_SMALL_GRID)

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
      DESERT: new Atlas(pick(PROP_SRC.DESERT), PROP_GRID.DESERT, { detect: true }),
      ICE: new Atlas(pick(PROP_SRC.ICE), PROP_GRID.ICE, { detect: true }),
    },
    fence: pick(FENCE_SRC),
    visitor: new Atlas(pick(VISITOR_SRC), VISITOR_GRID, { detect: true }),
    // GUI 아이콘은 명목 셀 경계를 넘나든다 → 알파 검출로 실제 박스를 쓴다.
    gui: new Atlas(pick(GUI_SRC), GUI_GRID, { detect: true }),
    guiSrc: GUI_SRC,
    // 두 번째 시트는 전처리가 이미 균등 격자로 짜 두었다. 검출할 게 없다.
    gui2: new Atlas(pick(GUI2_SRC), GUI2_GRID, {}),
    gui2Src: GUI2_SRC,
    font: new BitmapFont(fontSheet, fontAtlas),
    fontSmall: new BitmapFont(smallSheet, smallAtlas),
    fontSheet,
  }

  return cached
}
