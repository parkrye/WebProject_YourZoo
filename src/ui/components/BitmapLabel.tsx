import { useEffect, useRef } from 'react'
import { getAssets } from '@/assets/AssetStore'
import type { TextStyle } from '@/render/BitmapText'

interface BitmapLabelProps {
  text: string
  size?: number
  align?: TextStyle['align']
  letterSpacing?: number
  className?: string
  /**
   * 어느 폰트로 그릴지.
   *
   * `AUTO` 는 크기로 정한다 — 큰 폰트는 획이 굵어 작게 줄이면 뭉개지고,
   * 작은 폰트는 크게 키우면 픽셀이 도드라진다. 각자 잘하는 크기가 다르다.
   */
  font?: 'AUTO' | 'BIG' | 'SMALL'
}

/** 이 크기 아래로는 작은 폰트가 더 잘 읽힌다. */
const SMALL_FONT_MAX = 18

/**
 * 캔버스 여백. 글자 자체는 y..y+size 안에 들어가므로 이 정도면 넉넉하다.
 * 예전엔 높이를 size 의 1.35배로 잡았는데, 큰 폰트는 디센더가 없어 그만큼이 전부 빈 공간이었고
 * 라벨이 많은 화면(요청서 등)에서 세로가 그만큼 모자랐다.
 */
const PADDING = 4
const HEIGHT_RATIO = 1.14

/**
 * 스프라이트 폰트 텍스트를 DOM 안에 배치한다.
 * 폰트에 A-Z / 0-9 밖에 없으므로 지원되지 않는 문자는 조용히 무시된다.
 */
export function BitmapLabel({
  text, size = 32, align = 'left', letterSpacing, className, font: which = 'AUTO',
}: BitmapLabelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const assets = getAssets()
    const small = which === 'SMALL' || (which === 'AUTO' && size <= SMALL_FONT_MAX)
    const font = small ? assets.fontSmall : assets.font
    const style: TextStyle = { size, align: 'left', ...(letterSpacing !== undefined && { letterSpacing }) }

    const dpr = window.devicePixelRatio || 1
    const w = Math.ceil(font.measureWidth(text, style)) + PADDING * 2
    const h = Math.ceil(size * HEIGHT_RATIO) + PADDING * 2

    canvas.width = Math.max(1, w * dpr)
    canvas.height = Math.max(1, h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.imageSmoothingQuality = 'high'
    font.draw(ctx, text, PADDING, PADDING, style)
  }, [text, size, letterSpacing, which])

  return <canvas ref={canvasRef} className={className} style={{ display: 'block', margin: alignMargin(align) }} />
}

function alignMargin(align: TextStyle['align']): string {
  if (align === 'center') return '0 auto'
  if (align === 'right') return '0 0 0 auto'
  return '0'
}
