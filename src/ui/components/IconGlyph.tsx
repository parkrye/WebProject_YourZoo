import { useMemo, type CSSProperties } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { frameToBackgroundStyle } from '@/assets/atlas'
import { GUI_GRID, type GuiIcon } from '@/assets/manifest'

interface IconGlyphProps {
  icon: GuiIcon
  size: number
  className?: string
}

/**
 * 클릭을 받지 않는 아이콘. 버튼 안에 아이콘을 넣을 때 쓴다.
 * `IconButton` 을 그대로 넣으면 `<button>` 안에 `<button>` 이 중첩된다.
 */
export function IconGlyph({ icon, size, className = 'icon-glyph' }: IconGlyphProps) {
  const style = useMemo<CSSProperties>(() => {
    const { gui, guiSrc } = getAssets()
    return frameToBackgroundStyle(
      guiSrc, gui.frame(icon), GUI_GRID.sheetW, GUI_GRID.sheetH, size, size,
    ) as CSSProperties
  }, [icon, size])

  return <span className={className} style={style} aria-hidden />
}
