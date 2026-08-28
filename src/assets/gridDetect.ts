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

  const rowBands = findBands(rowSums(data, sheetW, sheetH), rows, sheetH / rows)
  if (!rowBands) return uniformFrames(grid)

  const paddedRows = padBands(rowBands, sheetH)
  const pitch = sheetW / cols

  const frames: Frame[] = []
  for (let r = 0; r < rowBands.length; r++) {
    const band = rowBands[r] as Band
    const colBands = findBands(colSums(data, sheetW, band.start, band.end), cols, pitch)
    if (!colBands) return uniformFrames(grid)

    const row = paddedRows[r] as Band
    const padded = padBands(colBands, sheetW)

    /*
      찾은 밴드를 **자리에 앉힌다.** 개수가 맞으면 순서대로 들어가고,
      모자라면 빈 자리가 생긴다 — 그 자리는 아무도 참조하지 않는 빈 프레임이 된다.

      자리는 밴드의 가운데가 어느 칸에 떨어지는지로 정한다. 다만 자리가 뒤로 가는 일은
      없으므로, 이미 찬 자리가 나오면 그 다음 빈 자리로 민다.
    */
    const slots: (Band | undefined)[] = new Array<Band | undefined>(cols)
    let next = 0
    for (const col of padded) {
      const centre = (col.start + col.end) / 2
      const wanted = Math.min(cols - 1, Math.max(next, Math.floor(centre / pitch)))
      slots[wanted] = col
      next = wanted + 1
    }

    for (let c = 0; c < cols; c++) {
      const col = slots[c]
      frames.push(col
        ? { sx: col.start, sy: row.start, sw: col.end - col.start + 1, sh: row.end - row.start + 1 }
        : { sx: Math.round(pitch * c), sy: row.start, sw: 1, sh: row.end - row.start + 1 })
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

/**
 * 이 알파 이상이면 잉크로 친다.
 * 값이 크면 안티에일리어싱된 외곽 1~2px 가 프레임 밖으로 밀려나 테두리가 잘려 보인다.
 */
const ALPHA_THRESHOLD = 6

/** 검출된 프레임을 이만큼 넓혀 외곽 안티에일리어싱을 품는다. 이웃 밴드와는 겹치지 않게 잘린다. */
const FRAME_PADDING = 2

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
function findBands(sums: Uint32Array, expected: number, pitch: number): Band[] | null {
  const bands = splitBands(sums, 1)
  if (bands.length === 0) return null

  /*
    모자란 개수를 채우려고 쪼갤 때, **명목 칸 폭보다 좁은 밴드는 쪼개지 않는다.**

    개수가 모자란 데는 두 가지 이유가 있다. 글자 둘이 붙었거나, 칸이 비었거나.
    앞은 쪼개는 게 맞지만 뒤는 멀쩡한 글자를 반으로 자른다.
    둘은 폭으로 갈린다 — 두 글자가 붙었다면 그 밴드는 한 칸보다 넓다.

    폰트 시트의 마지막 줄이 이렇다. 49칸에 글자가 48개라 마지막 줄이 6개뿐인데,
    이 조건이 없으면 개수를 맞추려고 `>` 를 반으로 잘라 두 칸에 담았다.
  */
  while (bands.length < expected) {
    if (!splitWidest(bands, sums, pitch)) break
  }
  while (bands.length > expected) {
    mergeClosest(bands)
  }

  return bands
}

/**
 * 밴드를 FRAME_PADDING 만큼 넓힌다.
 * 이웃 밴드 사이의 여백 절반까지만 확장해 서로 침범하지 않게 한다.
 */
function padBands(bands: readonly Band[], limit: number): Band[] {
  return bands.map((band, i) => {
    const prev = bands[i - 1]
    const next = bands[i + 1]
    const backRoom = prev ? Math.floor((band.start - prev.end - 1) / 2) : band.start
    const frontRoom = next ? Math.floor((next.start - band.end - 1) / 2) : limit - 1 - band.end
    return {
      start: Math.max(0, band.start - Math.min(FRAME_PADDING, Math.max(0, backRoom))),
      end: Math.min(limit - 1, band.end + Math.min(FRAME_PADDING, Math.max(0, frontRoom))),
    }
  })
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
function splitWidest(bands: Band[], sums: Uint32Array, pitch: number): boolean {
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
  // 한 칸에도 못 미치는 밴드는 글자 하나다. 여기서 멈추면 남는 자리는 빈 칸이 된다.
  if (width < pitch) return false
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

  // cutAt 컬럼을 버리면 글자 외곽선 한 줄이 통째로 사라진다. 앞쪽 밴드에 포함시킨다.
  bands.splice(target, 1, { start: band.start, end: cutAt }, { start: cutAt + 1, end: band.end })
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
