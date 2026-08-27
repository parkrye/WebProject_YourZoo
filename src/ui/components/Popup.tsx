import type { ReactNode } from 'react'
import { GUI, POPUP_INSET } from '@/assets/manifest'
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

/**
 * 9-슬라이스 팝업 프레임.
 *
 * 제목과 닫기 버튼은 **종이 영역 안**에 둔다. 프레임 상단 나무 바 중앙에
 * 발바닥 엠블럼이 박혀 있어서, 거기에 제목을 얹으면 글자와 겹친다.
 */
export function Popup({ title, width, height, onClose, children }: PopupProps) {
  return (
    <div className="popup-backdrop" onPointerDown={onClose}>
      <div className="popup" style={{ width, height }} onPointerDown={(e) => e.stopPropagation()}>
        <FrameCanvas width={width} height={height} />
        <div
          className="popup-body"
          style={{
            paddingTop: POPUP_INSET.top,
            paddingRight: POPUP_INSET.right,
            paddingBottom: POPUP_INSET.bottom,
            paddingLeft: POPUP_INSET.left,
          }}
        >
          <header className="popup-header">
            <BitmapLabel text={title} size={30} />
            <IconButton icon={GUI.CLOSE} size={50} title="CLOSE" onClick={onClose} />
          </header>
          <div className="popup-content">{children}</div>
        </div>
      </div>
    </div>
  )
}
