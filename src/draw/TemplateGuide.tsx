import { useEffect, useRef } from 'react'
import type { GuideShape } from '@/domain/templates'

interface TemplateGuideProps {
  /** 밑그림 도형. 동물 템플릿이든 프롭 템플릿이든 여기서는 같은 도형일 뿐이다. */
  guide: readonly GuideShape[]
  size: number
}

const GUIDE_COLOR = 'rgba(138, 90, 43, 0.34)'
const GUIDE_DASH = [7, 6]

/**
 * 그림판 바탕에 깔리는 템플릿 가이드.
 *
 * **캔버스 뒤 별도 레이어다.** 그림 캔버스에 직접 그리면 내보낸 PNG 에 가이드가 섞인다.
 * 새 템플릿을 고르면 날개가 어디쯤인지 보이므로, 그린 그림과 움직임 프로파일이 어긋나지 않는다.
 */
export function TemplateGuide({ guide, size }: TemplateGuideProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, size, size)

    ctx.strokeStyle = GUIDE_COLOR
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.setLineDash(GUIDE_DASH)

    for (const shape of guide) {
      ctx.beginPath()
      if (shape.kind === 'ELLIPSE') {
        ctx.ellipse(shape.cx * size, shape.cy * size, shape.rx * size, shape.ry * size, 0, 0, Math.PI * 2)
      } else {
        shape.points.forEach(([x, y], i) => {
          const px = x * size
          const py = y * size
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        })
        if (shape.closed) ctx.closePath()
      }
      ctx.stroke()
    }
  }, [guide, size])

  return <canvas ref={canvasRef} className="drawing-guide-canvas" style={{ width: size, height: size }} />
}
