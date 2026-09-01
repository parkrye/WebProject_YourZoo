import { orderedParts, partRect, type RigSpec } from '@/domain/rig'

/** 합성에 쓰는 그림 상자. 렌더러가 정사각 상자를 쓰므로 여기서도 정사각이다. */
const BOX = 512
/** 다 굽고 나서 여백을 잘라 낸 뒤 긴 변을 맞추는 크기. 그린 그림 한 장(`draw/export`)과 같다. */
const TARGET_LONG_EDGE = 256
const ALPHA_THRESHOLD = 16

/**
 * 파츠를 정지 자세로 합쳐 **한 장**으로 굽는다.
 *
 * 리그 동물의 대표 그림은 오래도록 몸통 한 조각이었다. 파츠가 따로 저장되니
 * 그중 하나를 골라 쓴 것인데, 그러다 보니 창고에도 도착 알림에도 동물 카드에도
 * 노란 덩어리 하나가 떴다 — 사슴을 그린 사람이 사슴을 어디서도 볼 수 없었다.
 *
 * 자리는 렌더러와 같은 `partRect` 에서 나온다. 굽는 쪽이 제 나름대로 자리를 잡으면
 * 창고에서 본 모습과 우리 안에서 본 모습이 어긋난다.
 */
export async function composeRig(
  spec: RigSpec,
  parts: ReadonlyMap<string, ImageBitmap>,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = BOX
  canvas.height = BOX
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  let drew = false
  for (const part of orderedParts(spec)) {
    const bitmap = parts.get(part.id)
    if (!bitmap) continue
    const box = partRect(part, BOX, BOX)
    ctx.drawImage(bitmap, box.x, box.y, box.w, box.h)
    drew = true
  }
  if (!drew) return null

  return trim(canvas, ctx)
}

/**
 * 그린 자리만 남기고 잘라 긴 변을 맞춘다.
 *
 * 파츠 상자는 그림 상자를 다 채우지 않는다. 그대로 두면 여백이 그림의 절반이라
 * 목록에서 리그 동물만 유독 작게 보인다.
 */
async function trim(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Promise<Blob | null> {
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const bounds = alphaBounds(data, canvas.width, canvas.height)
  if (!bounds) return null

  const scale = TARGET_LONG_EDGE / Math.max(bounds.w, bounds.h)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(bounds.w * scale))
  out.height = Math.max(1, Math.round(bounds.h * scale))
  const outCtx = out.getContext('2d')
  if (!outCtx) return null
  outCtx.imageSmoothingQuality = 'high'
  outCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, out.width, out.height)

  return new Promise((resolve) => out.toBlob(resolve, 'image/png'))
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
