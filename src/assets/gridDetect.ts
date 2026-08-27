import type { Frame } from './atlas'
import type { GridSpec } from './manifest'

/**
 * 알파 투영으로 시트의 실제 셀 경계를 검출한다.
 *
 * 이 프로젝트의 시트들은 명목상 균등 그리드지만 실제 그림은 셀 경계를 넘나든다.
 * (GUI 아이콘 하단이 아랫 셀에 묻어 나오고, 폰트 글자는 행마다 높이가 다르다.)
 * 균등 분할을 그대로 믿으면 아이콘이 잘리고 텍스트 베이스라인이 튄다.
 *
 * 알고리즘: 알파를 y축에 투영해 빈 줄로 끊어지는 행 밴드를 찾고,
 * 각 행 밴드 안에서 다시 x축 투영으로 열을 찾는다.
 * 검출 개수가 기대와 다르면 균등 그리드로 안전하게 되돌아간다.
 */
export function detectFrames(source: CanvasImageSource, grid: GridSpec): Frame[] {
  const { sheetW, sheetH, cols, rows } = grid

  const canvas = document.createElement('canvas')
  canvas.width = sheetW
  canvas.height = sheetH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return uniformFrames(grid)

  ctx.drawImage(source, 0, 0)
  const data = ctx.getImageData(0, 0, sheetW, sheetH).data

  const rowBands = findBands(rowSums(data, sheetW, sheetH), rows)
  if (!rowBands) return uniformFrames(grid)

  const frames: Frame[] = []
  for (const band of rowBands) {
    const colBands = findBands(colSums(data, sheetW, band.start, band.end), cols)
    if (!colBands) return uniformFrames(grid)
    for (const col of colBands) {
      frames.push({
        sx: col.start,
        sy: band.start,
        sw: col.end - col.start + 1,
        sh: band.end - band.start + 1,
      })
    }
  }

  return frames
}

export function uniformFrames(grid: GridSpec): Frame[] {
  const cellW = grid.sheetW / grid.cols
  const cellH = grid.sheetH / grid.rows
  const frames: Frame[] = []
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      frames.push({ sx: c * cellW, sy: r * cellH, sw: cellW, sh: cellH })
    }
  }
  return frames
}

interface Band {
  start: number
  end: number
}

const ALPHA_THRESHOLD = 24

/** 밴드를 쪼갤 때 가장자리에서 이만큼은 건드리지 않는다. 세리프가 잘려 나가는 걸 막는다. */
const SPLIT_MARGIN_RATIO = 0.12

function rowSums(data: Uint8ClampedArray, w: number, h: number): Uint32Array {
  const sums = new Uint32Array(h)
  for (let y = 0; y < h; y++) {
    let n = 0
    const base = y * w * 4
    for (let x = 0; x < w; x++) {
      if ((data[base + x * 4 + 3] as number) >= ALPHA_THRESHOLD) n++
    }
    sums[y] = n
  }
  return sums
}

function colSums(data: Uint8ClampedArray, w: number, y0: number, y1: number): Uint32Array {
  const sums = new Uint32Array(w)
  for (let y = y0; y <= y1; y++) {
    const base = y * w * 4
    for (let x = 0; x < w; x++) {
      if ((data[base + x * 4 + 3] as number) >= ALPHA_THRESHOLD) sums[x] = (sums[x] as number) + 1
    }
  }
  return sums
}

/**
 * 정확히 `expected` 개의 밴드를 만든다.
 *
 * 임계값을 올려 가며 개수를 맞추는 방식은 못 쓴다. 임계값이 높아지면 인접 글자가 떨어지기도 하지만
 * 동시에 `V` `W` `X` 처럼 획이 얇은 글자가 두 조각으로 갈라져, 개수만 우연히 맞고 경계는 틀리는
 * 결과가 나온다. (실제로 폰트 시트에서 `X` 프레임이 `VWX` 를 덮는 버그가 났다.)
 *
 * 그래서 임계값은 1로 고정하고, 개수가 모자라면 **가장 넓은 밴드를 내부 최소 밀도 지점에서 쪼개고**,
 * 남으면 **간격이 가장 좁은 이웃끼리 합친다**. 붙어 있는 글자 사이는 그림자만 겹치므로
 * 그 지점이 항상 밴드 내부의 최소값이 된다.
 */
function findBands(sums: Uint32Array, expected: number): Band[] | null {
  const bands = splitBands(sums, 1)
  if (bands.length === 0) return null

  while (bands.length < expected) {
    if (!splitWidest(bands, sums)) return null
  }
  while (bands.length > expected) {
    mergeClosest(bands)
  }

  return bands
}

function splitBands(sums: Uint32Array, threshold: number): Band[] {
  const bands: Band[] = []
  let start = -1

  for (let i = 0; i < sums.length; i++) {
    const filled = (sums[i] as number) >= threshold
    if (filled && start < 0) start = i
    if (!filled && start >= 0) {
      bands.push({ start, end: i - 1 })
      start = -1
    }
  }
  if (start >= 0) bands.push({ start, end: sums.length - 1 })

  return bands
}

/** 가장 넓은 밴드를 내부 최소 밀도 지점에서 둘로 나눈다. 나눌 수 없으면 false. */
function splitWidest(bands: Band[], sums: Uint32Array): boolean {
  let target = -1
  let widest = 0
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i] as Band
    const width = b.end - b.start
    if (width > widest) {
      widest = width
      target = i
    }
  }
  if (target < 0) return false

  const band = bands[target] as Band
  const width = band.end - band.start + 1
  const margin = Math.max(2, Math.floor(width * SPLIT_MARGIN_RATIO))
  const from = band.start + margin
  const to = band.end - margin
  if (to <= from) return false

  let cutAt = from
  let min = Number.POSITIVE_INFINITY
  for (let i = from; i <= to; i++) {
    const v = sums[i] as number
    if (v < min) {
      min = v
      cutAt = i
    }
  }

  bands.splice(target, 1, { start: band.start, end: cutAt - 1 }, { start: cutAt + 1, end: band.end })
  return true
}

/** 간격이 가장 좁은 이웃 밴드 둘을 합친다. */
function mergeClosest(bands: Band[]): void {
  let target = 0
  let smallest = Number.POSITIVE_INFINITY
  for (let i = 0; i + 1 < bands.length; i++) {
    const gap = (bands[i + 1] as Band).start - (bands[i] as Band).end
    if (gap < smallest) {
      smallest = gap
      target = i
    }
  }
  const a = bands[target] as Band
  const b = bands[target + 1] as Band
  bands.splice(target, 2, { start: a.start, end: b.end })
}
