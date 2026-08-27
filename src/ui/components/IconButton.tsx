import { useMemo, type CSSProperties } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { frameToBackgroundStyle } from '@/assets/atlas'
import { GUI_GRID, type GuiIcon } from '@/assets/manifest'

interface IconButtonProps {
  icon: GuiIcon
  size?: number
  disabled?: boolean
  title?: string
  onClick?: () => void
}

export function IconButton({ icon, size = 72, disabled = false, title, onClick }: IconButtonProps) {
  const style = useMemo<CSSProperties>(() => {
    const { gui, guiSrc } = getAssets()
    return frameToBackgroundStyle(guiSrc, gui.frame(icon), GUI_GRID.sheetW, GUI_GRID.sheetH, size, size) as CSSProperties
  }, [icon, size])

  return (
    <button
      type="button"
      className="icon-button"
      style={style}
      disabled={disabled}
      title={title}
      onClick={onClick}
    />
  )
}
