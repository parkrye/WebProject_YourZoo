import { useEffect, useRef, type ReactNode } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { GUI, POPUP_INSET } from '@/assets/manifest'
import { drawPopupFrame } from '@/render/NineSlice'
import { BitmapLabel } from './BitmapLabel'
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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    drawPopupFrame(ctx, getAssets().popup, 0, 0, width, height)
  }, [width, height])

  return (
    <div className="popup-backdrop" onPointerDown={onClose}>
      <div className="popup" style={{ width, height }} onPointerDown={(e) => e.stopPropagation()}>
        <canvas ref={canvasRef} className="popup-frame" style={{ width, height }} />
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
