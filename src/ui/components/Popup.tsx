import { useCallback, useState, type ReactNode } from 'react'
import { GUI } from '@/assets/manifest'
import { BitmapLabel } from './BitmapLabel'
import { IconButton } from './IconButton'

interface PopupProps {
  title: string
  width: number
  height: number
  onClose: () => void
  children?: ReactNode
}

/** 퇴장 애니메이션 길이. CSS 의 popup-out 과 맞춰야 한다. */
const EXIT_MS = 170

/**
 * 팝업 프레임.
 *
 * 나무 테두리와 종이 본문을 **CSS 로 그린다.** 원래는 시트의 프레임 이미지를
 * 9-슬라이스로 늘려 썼는데 임의 크기에서 종이와 테두리가 계속 어긋났다.
 * 코너를 원본 크기로 두면 작은 팝업에서 테두리가 내용을 잡아먹고,
 * 크기에 맞춰 늘리면 상단 엠블럼이 복제되거나 타일 이음매가 드러났다.
 * 어떤 크기에도 정확히 맞아야 하는 UI 틀은 이미지보다 CSS 가 맞다.
 */
export function Popup({ title, width, height, onClose, children }: PopupProps) {
  const [closing, setClosing] = useState(false)

  // 닫기 요청은 곧바로 언마운트하지 않는다. 퇴장 연출이 끝난 뒤에 실제로 닫는다.
  const requestClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, EXIT_MS)
  }, [closing, onClose])

  return (
    <div className="popup-backdrop" onPointerDown={requestClose}>
      <div
        className={closing ? 'popup is-closing' : 'popup'}
        style={{ width, height }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="popup-header">
          <BitmapLabel text={title} size={28} />
          <IconButton icon={GUI.CLOSE} size={46} title="CLOSE" onClick={requestClose} />
        </header>
        <div className="popup-content">{children}</div>
      </div>
    </div>
  )
}
