import { useEffect, useRef } from 'react'
import { ensureBitmap, getBitmap } from '@/sim/imageCache'

interface AnimalThumbProps {
  imageId: string
  size: number
  className?: string
}

/**
 * 동물 그림 썸네일.
 *
 * 그림은 `ImageBitmap` 으로 캐시되어 있어 `<img>` 로는 못 쓴다.
 * 캔버스에 비율을 유지해 중앙 정렬로 그린다.
 */
export function AnimalThumb({ imageId, size, className }: AnimalThumbProps) {
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

      const scale = Math.min(size / bitmap.width, size / bitmap.height)
      const w = bitmap.width * scale
      const h = bitmap.height * scale
      ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
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
  }, [imageId, size])

  return <canvas ref={canvasRef} className={className} style={{ width: size, height: size }} />
}
