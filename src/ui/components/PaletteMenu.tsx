import { GUI, PALETTE_COLORS } from '@/assets/manifest'
import { IconButton } from './IconButton'

interface PaletteMenuProps {
  selected: string
  onSelect: (hex: string) => void
  onClose: () => void
}

/** 팔레트 팝오버. 색상은 GUI 시트의 연필 6색 아이콘과 1:1 대응한다. */
export function PaletteMenu({ selected, onSelect, onClose }: PaletteMenuProps) {
  return (
    <div className="palette-menu">
      {PALETTE_COLORS.map((c) => (
        <div key={c.hex} className={c.hex === selected ? 'palette-slot is-selected' : 'palette-slot'}>
          <IconButton
            icon={c.icon}
            size={54}
            title={c.hex}
            onClick={() => {
              onSelect(c.hex)
              onClose()
            }}
          />
        </div>
      ))}
      <IconButton icon={GUI.CLOSE} size={44} title="CLOSE" onClick={onClose} />
    </div>
  )
}
