/**
 * 불투명 배경 제거 (폰트 / 팝업 시트용).
 *
 * 시트 테두리에서 시작하는 "이웃 델타 허용" 플러드 필.
 * 전역 색상이 아니라 **인접 픽셀과의 색 거리**로 전파 여부를 판단하므로
 * 그라디언트 배경에서도 동작하고, 글자의 어두운 아웃라인에서 정확히 멈춘다.
 *
 * @see docs/01-assets.md §2.2
 */

export interface CutoutOptions {
  /** 이웃 픽셀과의 RGB 제곱거리 허용치. 클수록 더 많이 지운다. */
  tolerance?: number
  /** 시드 픽셀(테두리)과의 RGB 제곱거리 상한. 폭주 방지용 앵커. */
  seedTolerance?: number
  /** 경계 1px 를 반투명 처리해 계단 현상을 완화한다. */
  feather?: boolean
}

const DEFAULTS: Required<CutoutOptions> = {
  tolerance: 900,
  seedTolerance: 14000,
  feather: true,
}

export function cutoutBackground(image: HTMLImageElement, options: CutoutOptions = {}): HTMLCanvasElement {
  const opt = { ...DEFAULTS, ...options }
  const w = image.naturalWidth
  const h = image.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('cutoutBackground: 2d context unavailable')

  ctx.drawImage(image, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)
  const px = img.data

  const visited = new Uint8Array(w * h)
  const stack: number[] = []

  const pushSeed = (x: number, y: number): void => {
    const i = y * w + x
    if (visited[i]) return
    visited[i] = 1
    stack.push(i)
  }

  for (let x = 0; x < w; x++) {
    pushSeed(x, 0)
    pushSeed(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    pushSeed(0, y)
    pushSeed(w - 1, y)
  }

  // 시드 앵커 = 네 모서리 평균색. 배경이 국소적으로 밝아져도 여기서 크게 벗어나면 멈춘다.
  const anchor = averageCorners(px, w, h)

  const cleared = new Uint8Array(w * h)

  while (stack.length > 0) {
    const i = stack.pop() as number
    const p = i * 4
    const r = px[p] as number
    const g = px[p + 1] as number
    const b = px[p + 2] as number

    if (dist2(r, g, b, anchor.r, anchor.g, anchor.b) > opt.seedTolerance) continue

    cleared[i] = 1
    px[p + 3] = 0

    const x = i % w
    const y = (i / w) | 0

    tryNeighbor(x - 1, y)
    tryNeighbor(x + 1, y)
    tryNeighbor(x, y - 1)
    tryNeighbor(x, y + 1)

    function tryNeighbor(nx: number, ny: number): void {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return
      const ni = ny * w + nx
      if (visited[ni]) return
      const np = ni * 4
      const d = dist2(r, g, b, px[np] as number, px[np + 1] as number, px[np + 2] as number)
      if (d > opt.tolerance) return
      visited[ni] = 1
      stack.push(ni)
    }
  }

  if (opt.feather) featherEdges(px, cleared, w, h)

  ctx.putImageData(img, 0, 0)
  return canvas
}

function dist2(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return dr * dr + dg * dg + db * db
}

function averageCorners(px: Uint8ClampedArray, w: number, h: number): { r: number; g: number; b: number } {
  const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4]
  let r = 0
  let g = 0
  let b = 0
  for (const c of corners) {
    r += px[c] as number
    g += px[c + 1] as number
    b += px[c + 2] as number
  }
  return { r: r / 4, g: g / 4, b: b / 4 }
}

/** 지워진 영역과 맞닿은 불투명 픽셀의 알파를 낮춰 경계를 부드럽게 한다. */
function featherEdges(px: Uint8ClampedArray, cleared: Uint8Array, w: number, h: number): void {
  const targets: number[] = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (cleared[i]) continue
      if (px[i * 4 + 3] === 0) continue
      if (cleared[i - 1] || cleared[i + 1] || cleared[i - w] || cleared[i + w]) targets.push(i)
    }
  }
  for (const i of targets) px[i * 4 + 3] = 150
}

// ─────────────────────────────────────────────────────────────
// 검은 배경 컷아웃
// ─────────────────────────────────────────────────────────────

export interface BlackCutoutOptions {
  /** 이 밝기 미만이면 배경 후보. 0~255. */
  luminance?: number
  /** 경계 픽셀의 알파를 밝기에 비례해 낮춰 검은 테두리를 없앤다. */
  feather?: boolean
}

const BLACK_DEFAULTS: Required<BlackCutoutOptions> = {
  luminance: 34,
  feather: true,
}

/**
 * 알파 채널이 없는(RGB) 시트의 검은 배경을 제거한다.
 *
 * `sprite_human_visitor.png` 와 `sprite_prop_desert.png` 는 알파가 없어 검은 사각형이
 * 그대로 화면에 찍힌다. 밝기 임계값만으로 지우면 캐릭터의 검은 옷·눈동자까지 뚫리므로,
 * **테두리에서 시작하는 플러드 필**로 바깥과 연결된 어두운 영역만 지운다.
 * 스프라이트 내부의 검정은 바깥과 연결되어 있지 않아 살아남는다.
 */
export function cutoutBlackBackground(
  image: HTMLImageElement,
  options: BlackCutoutOptions = {},
): HTMLCanvasElement {
  const opt = { ...BLACK_DEFAULTS, ...options }
  const w = image.naturalWidth
  const h = image.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('cutoutBlackBackground: 2d context unavailable')

  ctx.drawImage(image, 0, 0)
  const img = ctx.getImageData(0, 0, w, h)
  const px = img.data

  const visited = new Uint8Array(w * h)
  const cleared = new Uint8Array(w * h)
  const stack: number[] = []

  const isDark = (i: number): boolean => luminance(px, i) < opt.luminance

  const push = (x: number, y: number): void => {
    const i = y * w + x
    if (visited[i]) return
    visited[i] = 1
    if (!isDark(i)) return
    stack.push(i)
  }

  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }

  while (stack.length > 0) {
    const i = stack.pop() as number
    cleared[i] = 1
    px[i * 4 + 3] = 0

    const x = i % w
    const y = (i / w) | 0
    if (x > 0) push(x - 1, y)
    if (x < w - 1) push(x + 1, y)
    if (y > 0) push(x, y - 1)
    if (y < h - 1) push(x, y + 1)
  }

  if (opt.feather) featherBlackEdges(px, cleared, w, h, opt.luminance)

  ctx.putImageData(img, 0, 0)
  return canvas
}

function luminance(px: Uint8ClampedArray, i: number): number {
  const p = i * 4
  return 0.299 * (px[p] as number) + 0.587 * (px[p + 1] as number) + 0.114 * (px[p + 2] as number)
}

/**
 * 지워진 영역과 맞닿은 어두운 픽셀은 배경이 섞여 들어간 안티에일리어싱 경계다.
 * 밝기에 비례해 알파를 낮추면 검은 테두리가 사라진다.
 */
function featherBlackEdges(
  px: Uint8ClampedArray,
  cleared: Uint8Array,
  w: number,
  h: number,
  threshold: number,
): void {
  const ramp = threshold * 3
  const targets: number[] = []

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (cleared[i]) continue
      if (!(cleared[i - 1] || cleared[i + 1] || cleared[i - w] || cleared[i + w])) continue
      const lum = luminance(px, i)
      if (lum >= ramp) continue
      targets.push(i, Math.round((lum / ramp) * 255))
    }
  }

  for (let k = 0; k < targets.length; k += 2) {
    px[(targets[k] as number) * 4 + 3] = targets[k + 1] as number
  }
}
