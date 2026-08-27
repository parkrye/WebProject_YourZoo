import type { SheetMeta } from '@/domain/animal'
import type { AnimalRenderer, AnimalRenderState, ViewBox } from './AnimalRenderer'

/**
 * 8프레임 × 3모션 스프라이트 시트 렌더러.
 *
 * 외부 SDK 가 그림 1장에서 시트를 생성해 주면 여기로 갈아탄다.
 * `Animal.spriteSheet` 가 채워지면 팩토리가 이 렌더러를 고른다.
 * 시트 규격이 흔들려도 견디도록 행·열·fps 를 메타에서 받는다.
 *
 * @see docs/02-architecture.md §3.1
 */
export class SheetRenderer implements AnimalRenderer {
  private readonly frameW: number
  private readonly frameH: number

  constructor(
    private readonly sheet: ImageBitmap,
    private readonly meta: SheetMeta,
  ) {
    this.frameW = sheet.width / meta.cols
    this.frameH = sheet.height / meta.rows
  }

  draw(ctx: CanvasRenderingContext2D, state: AnimalRenderState, view: ViewBox): void {
    const row = Math.max(0, this.meta.motions.indexOf(state.motion))
    const frame = Math.floor(state.motionTime * this.meta.fps) % this.meta.cols

    const height = state.scale * view.height
    const width = height * (this.frameW / this.frameH)

    ctx.save()
    ctx.translate(state.x * view.width, state.y * view.height)
    ctx.scale(state.facing, 1)
    ctx.drawImage(
      this.sheet,
      frame * this.frameW, row * this.frameH, this.frameW, this.frameH,
      -width / 2, -height, width, height,
    )
    ctx.restore()
  }
}
