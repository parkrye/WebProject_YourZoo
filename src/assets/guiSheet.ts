import { getAssets } from './AssetStore'
import type { Atlas } from './atlas'
import { GUI_GRID, GUI2_GRID, GUI_SHEET2_BASE, type GridSpec, type GuiIcon } from './manifest'

export interface GuiSheet {
  readonly atlas: Atlas
  readonly src: string
  readonly grid: GridSpec
  /** 그 시트 안에서의 칸 번호. */
  readonly index: number
}

/**
 * 아이콘 번호가 어느 시트의 몇 번째 칸인지.
 *
 * 두 시트를 하나의 번호 공간으로 이어 붙였다. 호출부가 시트를 골라야 하면
 * 아이콘을 바꿀 때마다 시트도 같이 바꿔야 하고, 그러다 한쪽만 바꾸면
 * 엉뚱한 그림이 나온다. 번호만 주면 여기서 가른다.
 */
export function guiSheet(icon: GuiIcon): GuiSheet {
  const { gui, guiSrc, gui2, gui2Src } = getAssets()
  if (icon < GUI_SHEET2_BASE) {
    return { atlas: gui, src: guiSrc, grid: GUI_GRID, index: icon }
  }
  return { atlas: gui2, src: gui2Src, grid: GUI2_GRID, index: icon - GUI_SHEET2_BASE }
}
