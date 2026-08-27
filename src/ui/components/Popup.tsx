import { useCallback, useState, type ReactNode } from 'react'
import { GUI } from '@/assets/manifest'
import { popupInsetFor } from '@/render/NineSlice'
import { BitmapLabel } from './BitmapLabel'
import { FrameCanvas } from './FrameCanvas'
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
 * 9-슬라이스 팝업 프레임.
 *
 * 제목과 닫기 버튼은 **종이 영역 안**에 둔다. 프레임 상단 나무 바 중앙에
 * 발바닥 엠블럼이 박혀 있어서, 거기에 제목을 얹으면 글자와 겹친다.
 *
 * 여백은 프레임 배율을 따라간다. 코너가 팝업 크기에 맞춰 줄고 늘기 때문에
 * 고정 여백을 쓰면 작은 팝업에서 내용이 테두리를 침범한다.
 */
export function Popup({ title, width, height, onClose, children }: PopupProps) {
  const [closing, setClosing] = useState(false)
  const inset = popupInsetFor(width, height)

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
        <FrameCanvas width={width} height={height} />
        <div
          className="popup-body"
          style={{
            paddingTop: inset.top,
            paddingRight: inset.right,
            paddingBottom: inset.bottom,
            paddingLeft: inset.left,
          }}
        >
          <header className="popup-header">
            <BitmapLabel text={title} size={30} />
            <IconButton icon={GUI.CLOSE} size={50} title="CLOSE" onClick={requestClose} />
          </header>
          <div className="popup-content">{children}</div>
        </div>
      </div>
    </div>
  )
}
