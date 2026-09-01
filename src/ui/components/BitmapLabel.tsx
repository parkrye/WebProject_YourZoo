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
 * 캔버스 여백.
 *
 * 캔버스 높이는 `size` 가 아니라 **이 글의 잉크가 차지하는 높이**에 맞춘다
 * (`BitmapFont.inkBand`). 폰트 시트의 칸에는 글자 아래로 빈 줄이 있어서
 * size 를 그대로 쓰면 상자의 1/4 이 죽은 공간이 된다. 그만큼 글자의 시각적
 * 중심이 상자 중심보다 위로 올라가, 옆에 놓인 아이콘이나 시계는 세로 가운데
 * 정렬을 해도 늘 조금 내려앉아 보였다.
 */
const PADDING = 4

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
    const band = font.inkBand(text, style)
    const w = Math.ceil(font.measureWidth(text, style)) + PADDING * 2
    const h = Math.ceil(band.above - band.below) + PADDING * 2

    canvas.width = Math.max(1, w * dpr)
    canvas.height = Math.max(1, h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.imageSmoothingQuality = 'high'
    // 잉크의 윗변이 여백 바로 아래 오도록 베이스라인을 잡는다.
    font.draw(ctx, text, PADDING, PADDING + band.above - size, style)
  }, [text, size, letterSpacing, which])

  return <canvas ref={canvasRef} className={className} style={{ display: 'block', margin: alignMargin(align) }} />
}

function alignMargin(align: TextStyle['align']): string {
  if (align === 'center') return '0 auto'
  if (align === 'right') return '0 0 0 auto'
  return '0'
}
