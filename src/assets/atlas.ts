import { detectFrames, uniformFrames } from './gridDetect'
import type { GridSpec } from './manifest'

export interface Frame {
  readonly sx: number
  readonly sy: number
  readonly sw: number
  readonly sh: number
}

export interface AtlasOptions {
  /**
   * 알파 투영으로 실제 셀 경계를 검출한다.
   * 그림이 명목상 셀 경계를 넘나드는 시트(GUI, 폰트)에 필요하다.
   * 배경이 불투명한 원본에는 쓸 수 없다 — 컷아웃 이후에만 의미가 있다.
   */
  detect?: boolean
}

/** 그리드 시트를 인덱스로 슬라이싱한다. */
export class Atlas {
  readonly frames: readonly Frame[]
  readonly count: number

  constructor(
    readonly image: CanvasImageSource,
    readonly grid: GridSpec,
    options: AtlasOptions = {},
  ) {
    this.frames = options.detect ? detectFrames(image, grid) : uniformFrames(grid)
    this.count = this.frames.length
  }

  frame(index: number): Frame {
    const f = this.frames[index]
    if (!f) throw new Error(`Atlas: 범위를 벗어난 인덱스 ${index}`)
    return f
  }

  draw(ctx: CanvasRenderingContext2D, index: number, dx: number, dy: number, dw: number, dh: number): void {
    const f = this.frame(index)
    ctx.drawImage(this.image, f.sx, f.sy, f.sw, f.sh, dx, dy, dw, dh)
  }

  /** 프레임 비율을 유지하며 dw×dh 박스 안에 중앙 정렬해 그린다. */
  drawContained(
    ctx: CanvasRenderingContext2D,
    index: number,
    dx: number, dy: number, dw: number, dh: number,
  ): void {
    const f = this.frame(index)
    const scale = Math.min(dw / f.sw, dh / f.sh)
    const w = f.sw * scale
    const h = f.sh * scale
    ctx.drawImage(this.image, f.sx, f.sy, f.sw, f.sh, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h)
  }
}

/** 프레임을 CSS background 로 쓰기 위한 스타일 조각. DOM 아이콘 버튼용. */
export function frameToBackgroundStyle(
  src: string,
  f: Frame,
  sheetW: number,
  sheetH: number,
  boxW: number,
  boxH: number,
): Record<string, string> {
  const scale = Math.min(boxW / f.sw, boxH / f.sh)
  return {
    backgroundImage: `url(${src})`,
    backgroundSize: `${sheetW * scale}px ${sheetH * scale}px`,
    backgroundPosition: `${-f.sx * scale}px ${-f.sy * scale}px`,
    backgroundRepeat: 'no-repeat',
    width: `${f.sw * scale}px`,
    height: `${f.sh * scale}px`,
  }
}
