/** 내보낼 때 긴 변을 이 크기로 맞춘다. 동물이 화면에서 일정한 크기로 보이게 하는 기준. */
const TARGET_LONG_EDGE = 256
/** 색상 가짓수를 셀 때 쓰는 양자화 단계. 안티에일리어싱 중간색이 따로 세어지는 걸 막는다. */
const COLOR_QUANTIZE = 48
const ALPHA_THRESHOLD = 16

export interface ExportedDrawing {
  blob: Blob
  width: number
  height: number
  /** appeal 계산에 쓰이는 색상 가짓수 */
  colorCount: number
}

/**
 * 그림판 캔버스를 저장 가능한 PNG 로 만든다.
 *
 * 알파 바운딩박스로 여백을 잘라내고 긴 변 기준으로 정규화한다.
 * 이걸 안 하면 구석에 점 하나 찍은 동물과 화면 가득 그린 동물이
 * 우리 안에서 전혀 다른 크기로 나온다. (docs/02-architecture.md R3)
 *
 * 아무것도 안 그렸으면 null.
 */
export async function exportDrawing(source: HTMLCanvasElement): Promise<ExportedDrawing | null> {
  const ctx = source.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const { width: sw, height: sh } = source
  const image = ctx.getImageData(0, 0, sw, sh)
  const bounds = alphaBounds(image.data, sw, sh)
  if (!bounds) return null

  const scale = TARGET_LONG_EDGE / Math.max(bounds.w, bounds.h)
  const dw = Math.max(1, Math.round(bounds.w * scale))
  const dh = Math.max(1, Math.round(bounds.h * scale))

  const out = document.createElement('canvas')
  out.width = dw
  out.height = dh
  const outCtx = out.getContext('2d')
  if (!outCtx) return null
  outCtx.imageSmoothingQuality = 'high'
  outCtx.drawImage(source, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, dw, dh)

  const blob = await toBlob(out)
  if (!blob) return null

  return { blob, width: dw, height: dh, colorCount: countColors(image.data) }
}

interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

function alphaBounds(data: Uint8ClampedArray, w: number, h: number): Bounds | null {
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((data[(y * w + x) * 4 + 3] as number) < ALPHA_THRESHOLD) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < minX || maxY < minY) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function countColors(data: Uint8ClampedArray): number {
  const seen = new Set<number>()
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] as number) < ALPHA_THRESHOLD) continue
    const r = Math.round((data[i] as number) / COLOR_QUANTIZE)
    const g = Math.round((data[i + 1] as number) / COLOR_QUANTIZE)
    const b = Math.round((data[i + 2] as number) / COLOR_QUANTIZE)
    seen.add((r << 10) | (g << 5) | b)
  }
  return seen.size
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}
