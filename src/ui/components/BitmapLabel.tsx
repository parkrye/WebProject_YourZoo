import { useEffect, useRef } from 'react'
import { getAssets } from '@/assets/AssetStore'
import type { TextStyle } from '@/render/BitmapText'

interface BitmapLabelProps {
  text: string
  size?: number
  align?: TextStyle['align']
  letterSpacing?: number
  className?: string
}

const PADDING = 6

/**
 * 스프라이트 폰트 텍스트를 DOM 안에 배치한다.
 * 폰트에 A-Z / 0-9 밖에 없으므로 지원되지 않는 문자는 조용히 무시된다.
 */
export function BitmapLabel({ text, size = 32, align = 'left', letterSpacing, className }: BitmapLabelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { font } = getAssets()
    const style: TextStyle = { size, align: 'left', ...(letterSpacing !== undefined && { letterSpacing }) }

    const dpr = window.devicePixelRatio || 1
    const w = Math.ceil(font.measureWidth(text, style)) + PADDING * 2
    const h = Math.ceil(size * 1.35) + PADDING * 2

    canvas.width = Math.max(1, w * dpr)
    canvas.height = Math.max(1, h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.imageSmoothingQuality = 'high'
    font.draw(ctx, text, PADDING, PADDING, style)
  }, [text, size, letterSpacing])

  return <canvas ref={canvasRef} className={className} style={{ display: 'block', margin: alignMargin(align) }} />
}

function alignMargin(align: TextStyle['align']): string {
  if (align === 'center') return '0 auto'
  if (align === 'right') return '0 0 0 auto'
  return '0'
}
