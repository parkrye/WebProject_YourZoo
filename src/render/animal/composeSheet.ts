import type { SheetMeta } from '@/domain/animal'
import { DETAIL_COLS, DETAIL_ROWS, DETAIL_ROW_LABELS } from '@/domain/craft'

/** 합쳐진 시트의 칸 크기. 화면에서 동물은 100px 안팎이라 이 이상은 낭비다. */
const CELL = 200

/** 초당 넘어가는 프레임 수. 8프레임이 1초에 한 바퀴 돈다. */
const FPS = 8

export interface ComposedSheet {
  readonly blob: Blob
  readonly meta: Omit<SheetMeta, 'imageId'>
}

/**
 * 손으로 그린 칸들을 한 장의 스프라이트 시트로 합친다.
 *
 * 빈 칸은 **그 줄에서 마지막으로 그린 칸**으로 메운다. 24칸을 다 채워야만
 * 제출할 수 있게 하면 대부분은 중간에 그만둔다 — 걷기를 네 칸만 그리고
 * 나머지를 반복해도 움직임은 충분히 산다.
 *
 * 그린 칸이 하나도 없는 줄은 첫 줄(IDLE)에서 가져온다.
 * 서 있는 모습이라도 있으면 동물은 화면에 나타난다.
 */
export async function composeSheet(frames: readonly (Blob | null)[]): Promise<ComposedSheet> {
  const bitmaps = await Promise.all(frames.map((f) => (f ? createImageBitmap(f) : null)))
  const filled = fillGaps(bitmaps)

  const canvas = document.createElement('canvas')
  canvas.width = CELL * DETAIL_COLS
  canvas.height = CELL * DETAIL_ROWS
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('시트를 합칠 캔버스를 만들 수 없다')

  for (let row = 0; row < DETAIL_ROWS; row++) {
    for (let col = 0; col < DETAIL_COLS; col++) {
      const bitmap = filled[row * DETAIL_COLS + col]
      if (!bitmap) continue
      drawContained(ctx, bitmap, col * CELL, row * CELL)
    }
  }

  const blob = await toBlob(canvas)
  return {
    blob,
    meta: {
      cols: DETAIL_COLS,
      rows: DETAIL_ROWS,
      fps: FPS,
      motions: [...DETAIL_ROW_LABELS],
      // 그린 칸을 그대로 쓰므로 프레임이 곧 동물의 상자다. 여백은 그린 사람의 몫이다.
      fit: 1,
      baseline: 1,
    },
  }
}

/** 프롭용. 한 줄짜리 시트를 만든다. */
export async function composeStrip(frames: readonly (Blob | null)[]): Promise<{
  blob: Blob
  frames: number
  fps: number
}> {
  const bitmaps = await Promise.all(frames.map((f) => (f ? createImageBitmap(f) : null)))
  const filled = carryForward(bitmaps)
  const count = filled.length

  const canvas = document.createElement('canvas')
  canvas.width = CELL * count
  canvas.height = CELL
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('시트를 합칠 캔버스를 만들 수 없다')

  for (let i = 0; i < count; i++) {
    const bitmap = filled[i]
    if (bitmap) drawContained(ctx, bitmap, i * CELL, 0)
  }

  return { blob: await toBlob(canvas), frames: count, fps: FPS }
}

/** 칸 안에 비율을 지켜 가운데로 그린다. 그림판은 정사각이라 보통 그대로 들어간다. */
function drawContained(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  x: number,
  y: number,
): void {
  const scale = Math.min(CELL / bitmap.width, CELL / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, x + (CELL - w) / 2, y + (CELL - h) / 2, w, h)
}

/** 줄마다 앞의 칸을 이어 받아 빈 칸을 메우고, 통째로 빈 줄은 IDLE 로 채운다. */
function fillGaps(bitmaps: readonly (ImageBitmap | null)[]): (ImageBitmap | null)[] {
  const out: (ImageBitmap | null)[] = []

  for (let row = 0; row < DETAIL_ROWS; row++) {
    const start = row * DETAIL_COLS
    const line = carryForward(bitmaps.slice(start, start + DETAIL_COLS))
    out.push(...line)
  }

  const idle = out.slice(0, DETAIL_COLS)
  for (let row = 1; row < DETAIL_ROWS; row++) {
    const start = row * DETAIL_COLS
    if (out.slice(start, start + DETAIL_COLS).some(Boolean)) continue
    for (let col = 0; col < DETAIL_COLS; col++) out[start + col] = idle[col] ?? null
  }

  return out
}

/**
 * 빈 칸을 **앞 칸으로** 메운다. 앞에도 없으면 뒤에서 처음 나오는 칸을 쓴다 —
 * 3번 칸부터 그린 사람에게 앞 세 칸이 빈 채로 남으면 깜빡이는 것처럼 보인다.
 */
function carryForward(line: readonly (ImageBitmap | null)[]): (ImageBitmap | null)[] {
  const first = line.find((b) => b !== null) ?? null
  const out: (ImageBitmap | null)[] = []
  let last: ImageBitmap | null = first

  for (const bitmap of line) {
    if (bitmap) last = bitmap
    out.push(last)
  }
  return out
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('시트를 PNG 로 만들지 못했다'))
    }, 'image/png')
  })
}
