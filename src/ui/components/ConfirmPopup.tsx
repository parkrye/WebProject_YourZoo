import { GUI } from '@/assets/manifest'
import { BitmapLabel } from './BitmapLabel'
import { IconButton } from './IconButton'
import { Popup } from './Popup'

interface ConfirmPopupProps {
  title: string
  /** 한 줄씩 그린다. 폰트가 비트맵이라 자동 줄바꿈이 없다. */
  lines: readonly string[]
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 되돌릴 수 없는 행동 앞에 한 번 묻는다.
 *
 * 문구는 전부 대문자 영문이다 — 폰트 시트에 A-Z, 0-9, 공백밖에 없다.
 * 자동 줄바꿈도 없어서 줄은 호출하는 쪽이 나눠 넘긴다.
 */
export function ConfirmPopup({ title, lines, onConfirm, onCancel }: ConfirmPopupProps) {
  return (
    <Popup title={title} width={620} height={360} onClose={onCancel}>
      <div className="confirm">
        <div className="confirm-lines">
          {lines.map((line) => (
            <BitmapLabel key={line} text={line} size={26} align="center" />
          ))}
        </div>
        <div className="confirm-actions">
          <IconButton icon={GUI.CLOSE} size={64} title="CANCEL" onClick={onCancel} />
          <IconButton icon={GUI.CONFIRM} size={64} title="CONFIRM" onClick={onConfirm} />
        </div>
      </div>
    </Popup>
  )
}
