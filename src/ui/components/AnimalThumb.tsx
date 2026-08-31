import { useEffect, useRef } from 'react'
import type { SheetMeta } from '@/domain/animal'
import { ensureBitmap, getBitmap } from '@/sim/imageCache'

interface AnimalThumbProps {
  imageId: string
  size: number
  className?: string
  /**
   * 이 그림이 시트라면 그 규격.
   *
   * 시트를 통째로 줄여 넣으면 24칸이 한 덩어리로 뭉개진다. 규격을 주면
   * **IDLE 첫 칸만** 잘라 그린다 — 목록에서 보고 싶은 건 서 있는 모습 하나다.
   */
  sheet?: SheetMeta | null
}

/**
 * 동물 그림 썸네일.
 *
 * 그림은 `ImageBitmap` 으로 캐시되어 있어 `<img>` 로는 못 쓴다.
 * 캔버스에 비율을 유지해 중앙 정렬로 그린다.
 */
export function AnimalThumb({ imageId, size, className, sheet }: AnimalThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false

    const paint = (bitmap: ImageBitmap): void => {
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = size * dpr
      canvas.height = size * dpr
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, size, size)

      // 시트면 IDLE 줄의 첫 칸만 잘라 온다. 규격이 없으면 그림 한 장을 통째로 쓴다.
      const cols = sheet?.cols ?? 1
      const rows = sheet?.rows ?? 1
      const row = Math.max(0, sheet?.motions.indexOf('IDLE') ?? 0)
      const sw = bitmap.width / cols
      const sh = bitmap.height / rows

      const scale = Math.min(size / sw, size / sh)
      const w = sw * scale
      const h = sh * scale
      ctx.drawImage(bitmap, 0, row * sh, sw, sh, (size - w) / 2, (size - h) / 2, w, h)
    }

    const cached = getBitmap(imageId)
    if (cached) {
      paint(cached)
      return
    }

    void ensureBitmap(imageId).then((bitmap) => {
      if (bitmap) paint(bitmap)
    })

    return () => {
      cancelled = true
    }
  }, [imageId, size, sheet])

  return <canvas ref={canvasRef} className={className} style={{ width: size, height: size }} />
}
