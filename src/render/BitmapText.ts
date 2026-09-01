import type { Atlas, Frame } from '@/assets/atlas'
import { FONT_CHARS, type GridSpec } from '@/assets/manifest'

export interface TextStyle {
  /** 렌더 높이(px). 가장 큰 글리프가 이 높이가 되도록 등비 스케일된다. */
  size: number
  /** 자간 (size 비율) */
  letterSpacing?: number
  /** 공백 폭 (size 비율) */
  spaceWidth?: number
  align?: 'left' | 'center' | 'right'
}

const DEFAULT_LETTER_SPACING = 0.05
const DEFAULT_SPACE_WIDTH = 0.3

/**
 * 스프라이트 폰트 렌더러.
 *
 * 시트는 명목상 6×6 균등 그리드지만 행마다 글자 크기·위치가 달라
 * 균등 분할을 그대로 믿으면 베이스라인이 튄다. 그래서 `Atlas({detect:true})` 로
 * 알파 투영 검출한 **실제 잉크 박스**를 받아 쓰고, 세로는 **하단(베이스라인) 정렬**한다.
 *
 * 지원 문자: A-Z, 0-9, 공백. 그 외는 무시된다.
 * @see docs/01-assets.md §2.2
 */
export class BitmapFont {
  private readonly glyphs = new Map<string, Frame>()
  /** style.size 가 대응하는 기준 높이 = 가장 큰 글리프 높이 */
  private readonly refH: number

  /**
   * 글자마다 잉크가 칸 안에서 차지하는 세로 구간 (칸 높이 대비 0..1).
   *
   * 시트의 칸에는 글자 위아래로 빈 줄이 있다. `detectColumnsInGrid` 는 베이스라인을
   * 지키려고 세로를 칸 그대로 두는데(그게 맞다), 그 빈 줄이 그린 상자 안에 그대로 남는다.
   * 그래서 라벨 상자를 세로 가운데 정렬해도 글자는 늘 위로 떠 보였다 —
   * 상자 아래쪽 1/4 이 아무것도 없는 공간이었기 때문이다.
   */
  private readonly ink = new Map<string, { top: number; bottom: number }>()

  constructor(readonly sheet: CanvasImageSource, atlas: Atlas) {
    let maxH = 1
    for (let i = 0; i < FONT_CHARS.length && i < atlas.count; i++) {
      const ch = FONT_CHARS[i]
      if (!ch) continue
      const f = atlas.frame(i)
      this.glyphs.set(ch, f)
      if (f.sh > maxH) maxH = f.sh
    }
    this.refH = maxH
    measureInk(sheet, atlas.grid, this.glyphs, this.ink)
  }

  /**
   * **이 글의** 잉크가 베이스라인에서 위아래로 얼마나 뻗는가 (px).
   *
   * 폰트 전체로 하나만 재면 쓸모가 없다 — 쉼표와 괄호까지 합친 구간은 결국
   * 칸 전체가 되어, 재기 전과 똑같이 상자 아래에 죽은 공간이 남는다.
   * 글자에 따라 상자 높이가 달라지지만, 그 상자는 늘 잉크를 정확히 감싼다.
   */
  inkBand(text: string, style: TextStyle): { above: number; below: number } {
    const scale = style.size / this.refH
    let above = -Infinity
    let below = Infinity

    for (const ch of text.toUpperCase()) {
      const g = this.glyphs.get(ch)
      const ink = this.ink.get(ch)
      if (!g || !ink) continue
      const dh = g.sh * scale
      above = Math.max(above, dh * (1 - ink.top))
      below = Math.min(below, dh * (1 - ink.bottom))
    }
    // 그릴 글자가 하나도 없으면(공백뿐) 한 줄 높이를 그대로 준다.
    return Number.isFinite(above) ? { above, below } : { above: style.size, below: 0 }
  }

  /** 렌더하지 않고 폭만 계산한다. */
  measureWidth(text: string, style: TextStyle): number {
    const spacing = (style.letterSpacing ?? DEFAULT_LETTER_SPACING) * style.size
    const spaceW = (style.spaceWidth ?? DEFAULT_SPACE_WIDTH) * style.size
    const scale = style.size / this.refH

    let w = 0
    for (const ch of text.toUpperCase()) {
      if (ch === ' ') {
        w += spaceW + spacing
        continue
      }
      const g = this.glyphs.get(ch)
      if (!g) continue
      w += g.sw * scale + spacing
    }
    return Math.max(0, w - spacing)
  }

  /** `y` 는 텍스트 블록의 **상단**이다. 블록 높이는 style.size 와 같다. */
  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle): void {
    const spacing = (style.letterSpacing ?? DEFAULT_LETTER_SPACING) * style.size
    const spaceW = (style.spaceWidth ?? DEFAULT_SPACE_WIDTH) * style.size
    const scale = style.size / this.refH
    const align = style.align ?? 'left'
    const baseline = y + style.size

    let cursor = x
    if (align !== 'left') {
      const total = this.measureWidth(text, style)
      cursor = align === 'center' ? x - total / 2 : x - total
    }

    for (const ch of text.toUpperCase()) {
      if (ch === ' ') {
        cursor += spaceW + spacing
        continue
      }
      const g = this.glyphs.get(ch)
      if (!g) continue
      const dw = g.sw * scale
      const dh = g.sh * scale
      ctx.drawImage(this.sheet, g.sx, g.sy, g.sw, g.sh, cursor, baseline - dh, dw, dh)
      cursor += dw + spacing
    }
  }

  has(ch: string): boolean {
    return this.glyphs.has(ch.toUpperCase())
  }

  /** 입력 필드용: 지원되지 않는 문자를 제거한다. */
  static sanitize(input: string, maxLength: number): string {
    const out: string[] = []
    for (const ch of input.toUpperCase()) {
      if (out.length >= maxLength) break
      if (ch === ' ' || FONT_CHARS.includes(ch)) out.push(ch)
    }
    return out.join('')
  }
}

/**
 * 글자마다 잉크가 칸 안에서 차지하는 세로 구간을 잰다 (칸 높이 대비 0..1).
 *
 * 알파를 못 읽는 자리(캔버스가 없는 환경)에서는 아무것도 채우지 않는다 —
 * `inkBand` 가 칸 전체를 쓰게 되어 재기 전과 같은 모양이 된다.
 */
function measureInk(
  sheet: CanvasImageSource,
  grid: GridSpec,
  glyphs: ReadonlyMap<string, Frame>,
  out: Map<string, { top: number; bottom: number }>,
): void {
  const canvas = document.createElement('canvas')
  canvas.width = grid.sheetW
  canvas.height = grid.sheetH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  ctx.drawImage(sheet, 0, 0)
  const data = ctx.getImageData(0, 0, grid.sheetW, grid.sheetH).data

  for (const [ch, f] of glyphs) {
    if (f.sh <= 0 || f.sw <= 0) continue
    let top = -1
    let bottom = -1
    for (let y = f.sy; y < f.sy + f.sh; y++) {
      if (!hasInk(data, grid.sheetW, y, f.sx, f.sx + f.sw)) continue
      if (top < 0) top = y
      bottom = y
    }
    // 잉크를 못 찾은 글자는 넣지 않는다. 잰 값을 지어내는 것보다 빠지는 편이 낫다.
    if (top < 0) continue
    out.set(ch, { top: (top - f.sy) / f.sh, bottom: (bottom + 1 - f.sy) / f.sh })
  }
}

/** 알파 임계. 외곽선의 반투명 가장자리까지 글자로 친다. */
const INK_ALPHA = 8

function hasInk(data: Uint8ClampedArray, width: number, y: number, x0: number, x1: number): boolean {
  const row = y * width
  for (let x = x0; x < x1; x++) {
    if ((data[(row + x) * 4 + 3] ?? 0) > INK_ALPHA) return true
  }
  return false
}
