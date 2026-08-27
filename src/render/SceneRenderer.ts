import { getAssets } from '@/assets/AssetStore'
import {
  LOGICAL_HEIGHT, LOGICAL_WIDTH, VISITOR_BASELINE_Y, VISITOR_HEIGHT,
  type BiomeId,
} from '@/assets/manifest'
import { phaseBlend } from '@/domain/clock'
import type { VisitorAgent } from '@/sim/VisitorAgent'

export interface SceneInput {
  biome: BiomeId
  /** 오늘 경과 초 */
  elapsed: number
  visitors: readonly VisitorAgent[]
  /** 펜스 Y 오프셋 (화면 높이 비율). 상세보기에서 펜스를 내린다. */
  fenceOffset: number
}

/**
 * 우리 화면의 레이어 합성.
 *
 * z0 하늘 → z1 바이옴 → z2 하늘동물 → z3 땅프롭+땅동물 → z4 물프롭+물동물
 * → z5 손님 → z6 펜스   (docs/01-assets.md §3)
 *
 * 현재 수직 슬라이스는 z0 / z1 / z5 / z6 만 구현한다.
 */
export class SceneRenderer {
  draw(ctx: CanvasRenderingContext2D, input: SceneInput): void {
    const w = LOGICAL_WIDTH
    const h = LOGICAL_HEIGHT

    ctx.clearRect(0, 0, w, h)
    this.drawSky(ctx, input.elapsed, w, h)
    this.drawArea(ctx, input.biome, w, h)
    this.drawVisitors(ctx, input.visitors, input.fenceOffset, w, h)
    this.drawFence(ctx, input.fenceOffset, w, h)
  }

  private drawSky(ctx: CanvasRenderingContext2D, elapsed: number, w: number, h: number): void {
    const { sky } = getAssets()
    const blend = phaseBlend(elapsed)

    ctx.globalAlpha = 1
    ctx.drawImage(sky[blend.from], 0, 0, w, h)

    if (blend.t <= 0) return
    ctx.globalAlpha = blend.t
    ctx.drawImage(sky[blend.to], 0, 0, w, h)
    ctx.globalAlpha = 1
  }

  private drawArea(ctx: CanvasRenderingContext2D, biome: BiomeId, w: number, h: number): void {
    ctx.drawImage(getAssets().area[biome], 0, 0, w, h)
  }

  private drawVisitors(
    ctx: CanvasRenderingContext2D,
    visitors: readonly VisitorAgent[],
    fenceOffset: number,
    w: number,
    h: number,
  ): void {
    const { visitor } = getAssets()
    const drawH = VISITOR_HEIGHT * h

    for (const v of visitors) {
      // 검출된 프레임은 손님마다 종횡비가 다르다. 프레임별로 폭을 계산해야 찌그러지지 않는다.
      const frame = visitor.frame(v.spriteIndex)
      const footY = (VISITOR_BASELINE_Y + fenceOffset + v.bobOffset) * h
      const sq = v.squash
      const vh = drawH * sq
      const vw = (drawH * (frame.sw / frame.sh)) / sq
      visitor.draw(ctx, v.spriteIndex, v.x * w - vw / 2, footY - vh, vw, vh)
    }
  }

  private drawFence(ctx: CanvasRenderingContext2D, fenceOffset: number, w: number, h: number): void {
    ctx.drawImage(getAssets().fence, 0, fenceOffset * h, w, h)
  }
}
