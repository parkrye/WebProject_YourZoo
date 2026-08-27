import { useEffect, useRef, type ReactNode } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { POPUP_INSET } from '@/assets/manifest'
import { drawPopupFrame } from '@/render/NineSlice'
import { BitmapLabel } from './BitmapLabel'
import { IconButton } from './IconButton'
import { GUI } from '@/assets/manifest'

interface PopupProps {
  title: string
  width: number
  height: number
  onClose: () => void
  children?: ReactNode
}

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
      <div
        className="popup"
        style={{ width, height }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <canvas ref={canvasRef} className="popup-frame" style={{ width, height }} />
        <div className="popup-title">
          <BitmapLabel text={title} size={30} align="center" />
        </div>
        <div
          className="popup-close"
          style={{ top: POPUP_INSET.top * 0.3, right: POPUP_INSET.right * 0.3 }}
        >
          <IconButton icon={GUI.CLOSE} size={54} onClick={onClose} title="CLOSE" />
        </div>
        <div
          className="popup-body"
          style={{
            paddingTop: POPUP_INSET.top,
            paddingRight: POPUP_INSET.right,
            paddingBottom: POPUP_INSET.bottom,
            paddingLeft: POPUP_INSET.left,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
