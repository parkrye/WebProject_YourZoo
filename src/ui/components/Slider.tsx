import type { GuiIcon } from '@/assets/manifest'
import { BitmapLabel } from './BitmapLabel'
import { IconGlyph } from './IconGlyph'

interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  /**
   * 켜고 끄는 단추에 쓸 아이콘 한 쌍. 주면 라벨 앞에 단추가 붙는다.
   *
   * 소리를 잠깐 끄는 데 손잡이를 왼쪽 끝까지 끌었다가 다시 원하는 자리로
   * 되돌리는 건 번거롭다. 단추 하나로 0 과 **직전 값** 사이를 오간다.
   */
  icon?: { on: GuiIcon; off: GuiIcon }
  onToggle?: () => void
}

export function Slider({ label, value, onChange, icon, onToggle }: SliderProps) {
  const on = value > 0

  return (
    <div className="slider-row">
      <div className="slider-head">
        {icon && onToggle && (
          <button type="button" className="slider-toggle" title={label} onClick={onToggle}>
            <IconGlyph icon={on ? icon.on : icon.off} size={30} />
          </button>
        )}
        <BitmapLabel text={label} size={26} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <BitmapLabel text={String(Math.round(value * 100))} size={26} align="right" />
    </div>
  )
}
