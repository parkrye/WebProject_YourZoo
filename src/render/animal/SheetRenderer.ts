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
    // 줄마다 프레임 수가 다를 수 있다. 모르면 빈 칸에서 동물이 한 번씩 사라진다.
    const count = this.meta.frames?.[row] ?? this.meta.cols
    const frame = Math.floor(state.motionTime * this.meta.fps) % Math.max(1, count)

    // `scale` 은 **동물의 높이**지 프레임의 높이가 아니다.
    // 여백이 있는 시트는 프레임을 그만큼 크게 그려야 동물이 제 크기로 나온다.
    const fit = this.meta.fit ?? 1
    const baseline = this.meta.baseline ?? 1
    const cellH = (state.scale * view.height) / fit
    const cellW = cellH * (this.frameW / this.frameH)

    ctx.save()
    // 발끝을 state.y 에 맞춘다. 프레임 아래변이 아니라 프레임 안의 기준선이 발이다.
    ctx.translate(state.x * view.width, state.y * view.height - baseline * cellH)
    ctx.scale(state.facing, 1)
    ctx.drawImage(
      this.sheet,
      frame * this.frameW, row * this.frameH, this.frameW, this.frameH,
      -cellW / 2, 0, cellW, cellH,
    )
    ctx.restore()
  }
}
