import type { RigPart, RigSpec } from '@/domain/rig'
import type { AnimalRenderer, AnimalRenderState, ViewBox } from './AnimalRenderer'

const SIGNATURE_DURATION = 1.2
/** 걸음 한 번의 길이(초). 파츠의 위상은 전부 이 하나의 파에서 나온다. */
const STRIDE_SEC = 0.62

/**
 * 파츠를 관절로 돌려 움직이는 렌더러.
 *
 * 통짜 비트맵을 띠로 밀던 `ProceduralRenderer` 와 다르다 — 여기서는 다리가
 * **엉덩이를 축으로 실제로 돈다.** 앞뒤 다리에 위상을 반대로 주면 걸음이 걸음처럼 보인다.
 *
 * 그린 사람은 부위만 그리면 된다. 24칸을 그리는 것보다 훨씬 덜 힘든데
 * 결과는 통짜 변형보다 살아 있다 — 그게 이 방식이 있는 이유다.
 */
export class RigRenderer implements AnimalRenderer {
  private readonly ordered: readonly RigPart[]

  constructor(
    private readonly spec: RigSpec,
    private readonly parts: ReadonlyMap<string, ImageBitmap>,
  ) {
    this.ordered = [...spec.parts].sort((a, b) => a.z - b.z)
  }

  draw(ctx: CanvasRenderingContext2D, state: AnimalRenderState, view: ViewBox): void {
    const height = state.scale * view.height
    // 그림 상자는 정사각으로 잡는다. 파츠 좌표가 모두 그 안의 비율이기 때문이다.
    const width = height
    const frame = this.frameParams(state, height)

    ctx.save()
    ctx.translate(state.x * view.width, state.y * view.height - frame.lift)
    if (frame.spin !== 0) ctx.rotate(frame.spin)
    ctx.scale(state.facing, 1)
    // 발밑이 기준점이다. 상자를 위로 올려 바닥에 세운다.
    ctx.translate(-width / 2, -height)

    for (const part of this.ordered) {
      const bitmap = this.parts.get(part.id)
      if (!bitmap) continue
      this.drawPart(ctx, part, bitmap, width, height, frame)
    }

    ctx.restore()
  }

  private drawPart(
    ctx: CanvasRenderingContext2D,
    part: RigPart,
    bitmap: ImageBitmap,
    width: number,
    height: number,
    frame: { phase: number; intensity: number },
  ): void {
    const m = part.motion
    // 위상만 어긋내면 앞다리와 뒷다리가 엇갈린다. 걸음이 걸음처럼 보이는 건 이 어긋남이다.
    const wave = Math.sin((frame.phase * m.beats + m.phase) * Math.PI * 2)
    // 멈춰 있어도 숨은 쉰다. 완전히 굳어 보이면 죽은 것처럼 읽힌다.
    const amount = wave * (m.idle + (1 - m.idle) * frame.intensity)

    const boxW = part.w * width
    const boxH = part.h * height
    // 회전축을 상자 안 좌표에서 화면 좌표로 옮긴다.
    const pivotX = (part.cx - part.w / 2 + part.w * part.px) * width
    const pivotY = (part.cy - part.h / 2 + part.h * part.py) * height

    ctx.save()
    ctx.translate(pivotX + amount * m.sway * width, pivotY + amount * m.bob * height)
    ctx.rotate(amount * m.swing)
    // 축이 원점에 오도록 상자를 되돌려 그린다.
    ctx.drawImage(bitmap, -boxW * part.px, -boxH * part.py, boxW, boxH)
    ctx.restore()
  }

  private frameParams(state: AnimalRenderState, height: number) {
    const t = state.motionTime

    if (state.motion === 'SIGNATURE') {
      const progress = Math.min(1, t / SIGNATURE_DURATION)
      return {
        lift: Math.sin(Math.PI * progress) * height * 0.45,
        spin: Math.sin(Math.PI * progress) * 0.5 * state.facing,
        phase: t / STRIDE_SEC,
        intensity: 1.4,
      }
    }

    const intensity = state.motion === 'MOVE' ? Math.max(0.45, state.speed01) : 0.22
    return {
      lift: 0,
      spin: 0,
      // 빨리 걸으면 걸음도 빨라진다. 속도와 다리 박자가 어긋나면 미끄러져 보인다.
      phase: (t / STRIDE_SEC) * (0.5 + intensity),
      intensity,
    }
  }

  /** 이 리그가 그릴 수 있는 파츠가 하나라도 있는가. */
  get isEmpty(): boolean {
    return this.spec.parts.every((p) => !this.parts.has(p.id))
  }
}
