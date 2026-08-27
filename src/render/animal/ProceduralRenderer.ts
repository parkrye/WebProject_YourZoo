import type { BandMotion, MotionProfile } from '@/domain/motion'
import type { AnimalRenderer, AnimalRenderState, ViewBox } from './AnimalRenderer'

/** 띠 하나를 그릴 때 쓰는 조각 수. 많을수록 매끄럽지만 draw 호출이 늘어난다. */
const SLICES = 10
/** 조각 사이가 벌어지지 않도록 겹치는 픽셀. */
const OVERLAP = 1
const SIGNATURE_DURATION = 1.2

/**
 * 단일 비트맵 절차적 렌더러.
 *
 * 프레임 애니메이션이 없으므로 그림을 **띠(band)로 나누고 띠마다 다르게 밀어** 움직임을 만든다.
 * 자르는 게 아니라 미는 것이라 이음매가 생기지 않으면서도
 * "다리만 흔들리고 몸통은 가만히 있는" 그림이 나온다.
 *
 * 어느 띠가 무슨 부위인지는 그림 템플릿이 정한다 — 템플릿을 골라 그렸다는 건
 * 어느 위치에 어느 부위가 있는지 약속했다는 뜻이기 때문이다.
 * `FREE` 로 그린 그림은 그 약속이 없으므로 무난한 숨쉬기와 기울기만 준다.
 */
export class ProceduralRenderer implements AnimalRenderer {
  private readonly ratio: number

  constructor(
    private readonly bitmap: ImageBitmap,
    private readonly motion: MotionProfile,
  ) {
    this.ratio = bitmap.width / bitmap.height
  }

  draw(ctx: CanvasRenderingContext2D, state: AnimalRenderState, view: ViewBox): void {
    const height = state.scale * view.height
    const width = height * this.ratio
    const frame = this.frameParams(state, height)

    ctx.save()
    ctx.translate(state.x * view.width, state.y * view.height - frame.lift)
    if (frame.spin !== 0) ctx.rotate(frame.spin)
    ctx.rotate(frame.lean)
    // 가로는 facing 으로 뒤집고, 세로 스쿼시만큼 가로를 반대로 눌러 부피를 유지한다.
    ctx.scale(state.facing / frame.squash, frame.squash)

    const bands = this.motion.bands
    if (bands.length === 0) {
      ctx.drawImage(this.bitmap, -width / 2, -height, width, height)
      ctx.restore()
      return
    }

    // 먼저 원본을 통째로 깔고, 띠가 덮는 영역만 변형해 덧그린다.
    // 이렇게 해야 띠가 비운 자리에 구멍이 나지 않는다.
    ctx.drawImage(this.bitmap, -width / 2, -height, width, height)
    for (const band of bands) this.drawBand(ctx, band, width, height, frame.time, frame.intensity)

    ctx.restore()
  }

  /**
   * 띠 하나를 조각내어 각 조각에 위상차를 준 뒤 다시 그린다.
   *
   * `cycles` 가 0 이면 범위 전체가 한 덩어리로 움직이고(귀, 날개),
   * 0 보다 크면 범위를 따라 파동이 흐른다(꼬리, 몸통).
   * `alternate` 는 조각을 홀짝으로 갈라 반대로 움직인다 — 네발 걸음이 이걸로 만들어진다.
   */
  private drawBand(
    ctx: CanvasRenderingContext2D,
    band: BandMotion,
    width: number,
    height: number,
    time: number,
    intensity: number,
  ): void {
    const isRow = band.axis === 'ROW'
    const source = isRow ? this.bitmap.height : this.bitmap.width
    const target = isRow ? height : width

    const srcStart = source * band.from
    const srcSpan = source * (band.to - band.from)
    if (srcSpan <= 0) return

    const dstStart = isRow ? -height + target * band.from : -width / 2 + target * band.from
    const dstSpan = target * (band.to - band.from)

    const srcStep = srcSpan / SLICES
    const dstStep = dstSpan / SLICES
    const phase = time * band.speed

    for (let i = 0; i < SLICES; i++) {
      const t = i / (SLICES - 1)
      const wave = Math.sin(phase + t * band.cycles * Math.PI * 2)
      const sign = band.alternate && i % 2 === 1 ? -1 : 1
      const amount = wave * sign * intensity

      const dx = amount * band.swayX * width
      const dy = amount * band.swayY * height
      const stretch = 1 + amount * band.stretchY

      const sx = isRow ? 0 : srcStart + i * srcStep
      const sy = isRow ? srcStart + i * srcStep : 0
      const sw = isRow ? this.bitmap.width : srcStep + OVERLAP
      const sh = isRow ? srcStep + OVERLAP : this.bitmap.height

      const baseX = isRow ? -width / 2 : dstStart + i * dstStep
      const baseY = isRow ? dstStart + i * dstStep : -height
      const dw = isRow ? width : dstStep + OVERLAP
      const dh = isRow ? (dstStep + OVERLAP) * stretch : height

      ctx.drawImage(this.bitmap, sx, sy, sw, sh, baseX + dx, baseY + dy, dw, dh)
    }
  }

  private frameParams(state: AnimalRenderState, height: number) {
    const t = state.motionTime
    const m = this.motion

    if (state.motion === 'SIGNATURE') {
      const progress = Math.min(1, t / SIGNATURE_DURATION)
      return {
        lift: Math.sin(Math.PI * progress) * height * 0.45,
        squash: 1 + Math.sin(Math.PI * progress) * 0.12,
        lean: 0,
        spin: Math.sin(Math.PI * progress) * 0.5 * state.facing,
        time: t,
        intensity: 1.5,
      }
    }

    // 멈춰 있어도 숨은 쉰다. 완전히 굳어 보이면 죽은 것처럼 읽힌다.
    const intensity = state.motion === 'MOVE' ? Math.max(0.45, state.speed01) : 0.32

    return {
      lift: Math.abs(Math.sin(t * m.bobSpeed * intensity)) * height * m.bob * intensity,
      squash: 1 + Math.sin(t * m.bobSpeed * intensity * 2) * m.squash * intensity,
      lean: state.motion === 'MOVE' ? m.lean * intensity * state.facing : 0,
      spin: 0,
      time: t,
      intensity,
    }
  }
}
