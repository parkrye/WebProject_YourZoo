import type { MotionProfile } from '@/domain/templates'
import type { AnimalRenderer, AnimalRenderState, ViewBox } from './AnimalRenderer'

/** 물결을 만들 때 이미지를 세로로 자르는 조각 수. 많을수록 매끄럽지만 draw 호출이 늘어난다. */
const WAVE_SLICES = 12
const SIGNATURE_DURATION = 1.2

/**
 * 단일 비트맵 절차적 렌더러.
 *
 * 프레임 애니메이션이 없으므로 **이미지를 세로로 얇게 잘라 서로 다른 위상으로 밀어**
 * 몸이 물결치게 만든다. 통짜 변형보다 훨씬 살아 있어 보이고, 조각이 12개뿐이라 비용도 낮다.
 * 물결 세기·파장·속도는 그림 템플릿의 `MotionProfile` 이 정한다 — 물고기는 꼬리에서
 * 머리로 흐르는 큰 파동, 새는 빠른 날갯짓, 뱀은 몸 전체의 큰 굽이.
 *
 * 그림이 어떻게 생겼든 동작하는 것이 이 방식의 핵심 장점이다.
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
    const anim = this.frameParams(state, height)

    ctx.save()
    ctx.translate(state.x * view.width, state.y * view.height - anim.lift)
    if (anim.spin !== 0) ctx.rotate(anim.spin)
    ctx.rotate(anim.lean)
    // 가로는 facing 으로 뒤집고, 세로 스쿼시만큼 가로를 반대로 눌러 부피를 유지한다.
    ctx.scale(state.facing / anim.squash, anim.squash)

    if (anim.waveAmplitude <= 0) {
      ctx.drawImage(this.bitmap, -width / 2, -height, width, height)
      ctx.restore()
      return
    }

    this.drawWaved(ctx, width, height, anim.wavePhase, anim.waveAmplitude * height)
    ctx.restore()
  }

  /**
   * 세로 조각마다 y 를 어긋나게 그려 진행파를 만든다.
   * 조각을 1px 넓게 그려 이음매가 벌어지는 걸 막는다.
   */
  private drawWaved(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    phase: number,
    amplitude: number,
  ): void {
    const srcStep = this.bitmap.width / WAVE_SLICES
    const dstStep = width / WAVE_SLICES
    const left = -width / 2
    const cycles = this.motion.waveCycles * Math.PI * 2

    for (let i = 0; i < WAVE_SLICES; i++) {
      const t = i / WAVE_SLICES
      const offset = Math.sin(phase + t * cycles) * amplitude
      ctx.drawImage(
        this.bitmap,
        i * srcStep, 0, srcStep, this.bitmap.height,
        left + i * dstStep, -height + offset, dstStep + 1, height,
      )
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
        wavePhase: t * m.waveSpeed,
        waveAmplitude: m.waveAmplitude * 1.4,
      }
    }

    // 멈춰 있어도 물결과 숨은 남는다. 완전히 굳어 보이면 죽은 것처럼 읽힌다.
    const intensity = state.motion === 'MOVE' ? Math.max(0.4, state.speed01) : 0.35

    return {
      lift: Math.abs(Math.sin(t * m.bobSpeed * intensity)) * height * m.bob * intensity,
      squash: 1 + Math.sin(t * m.bobSpeed * intensity * 2) * 0.045 * intensity,
      lean: state.motion === 'MOVE' ? m.lean * intensity * state.facing : 0,
      spin: 0,
      wavePhase: t * m.waveSpeed * (0.5 + intensity),
      waveAmplitude: m.waveAmplitude * intensity,
    }
  }
}
