import type { Atlas, Frame } from '@/assets/atlas'
import { FONT_CHARS } from '@/assets/manifest'

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
