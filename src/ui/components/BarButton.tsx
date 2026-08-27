import type { GuiIcon } from '@/assets/manifest'
import { BitmapLabel } from './BitmapLabel'
import { IconGlyph } from './IconGlyph'

interface BarButtonProps {
  icon: GuiIcon
  label: string
  disabled?: boolean
  active?: boolean
  onClick?: () => void
  /** 튜토리얼이 이 버튼을 찾을 때 쓰는 표식 */
  'data-tutorial'?: string
}

const ICON_SIZE = 56

/** 하단 도구 바 버튼. 아이콘만으로는 무엇인지 알기 어려워 라벨을 함께 세운다. */
export function BarButton({
  icon, label, disabled = false, active = false, onClick, ...rest
}: BarButtonProps) {
  return (
    <button
      type="button"
      className={active ? 'bar-button is-active' : 'bar-button'}
      disabled={disabled}
      title={label}
      onClick={onClick}
      {...rest}
    >
      <IconGlyph icon={icon} size={ICON_SIZE} className="bar-button-icon" />
      <BitmapLabel text={label} size={15} align="center" />
    </button>
  )
}
