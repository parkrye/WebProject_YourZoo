import { useEffect, useRef } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { drawPopupFrame } from '@/render/NineSlice'

interface FrameCanvasProps {
  width: number
  height: number
  className?: string
}

/** 9-슬라이스 팝업 프레임만 그리는 캔버스. 팝업과 인라인 패널이 함께 쓴다. */
export function FrameCanvas({ width, height, className = 'popup-frame' }: FrameCanvasProps) {
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

  return <canvas ref={canvasRef} className={className} style={{ width, height }} />
}
