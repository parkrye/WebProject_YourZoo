import { useMemo, type CSSProperties } from 'react'
import { frameToBackgroundStyle } from '@/assets/atlas'
import { guiSheet } from '@/assets/guiSheet'
import { type GuiIcon } from '@/assets/manifest'

interface IconButtonProps {
  icon: GuiIcon
  size?: number
  disabled?: boolean
  title?: string
  onClick?: () => void
}

export function IconButton({ icon, size = 72, disabled = false, title, onClick }: IconButtonProps) {
  const style = useMemo<CSSProperties>(() => {
    const { atlas, src, grid, index } = guiSheet(icon)
    return frameToBackgroundStyle(src, atlas.frame(index), grid.sheetW, grid.sheetH, size, size) as CSSProperties
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
