import { BitmapLabel } from './BitmapLabel'

interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
}

export function Slider({ label, value, onChange }: SliderProps) {
  return (
    <div className="slider-row">
      <BitmapLabel text={label} size={26} />
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
