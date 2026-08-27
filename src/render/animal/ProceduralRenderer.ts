import type { AnimalRenderer, AnimalRenderState, ViewBox } from './AnimalRenderer'

/** MOVE 상태의 상하 진폭(높이 대비)과 주파수 */
const WALK_BOB = 0.06
const WALK_FREQ = 9
/** IDLE 상태의 숨쉬기 */
const IDLE_BOB = 0.018
const IDLE_FREQ = 2.4
/** 진행 방향으로 기우는 각도(라디안) */
const LEAN = 0.1
const SIGNATURE_DURATION = 1.2

/**
 * 단일 비트맵 절차적 렌더러.
 *
 * 프레임 애니메이션이 없으므로 스쿼시·보빙·기울기·좌우 반전으로 생기를 만든다.
 * 그림이 어떻게 생겼든 동작하는 것이 이 방식의 핵심 장점이다.
 */
export class ProceduralRenderer implements AnimalRenderer {
  private readonly ratio: number

  constructor(private readonly bitmap: ImageBitmap) {
    this.ratio = bitmap.width / bitmap.height
  }

  draw(ctx: CanvasRenderingContext2D, state: AnimalRenderState, view: ViewBox): void {
    const height = state.scale * view.height
    const width = height * this.ratio
    const anim = this.motionParams(state, height)

    ctx.save()
    ctx.translate(state.x * view.width, state.y * view.height - anim.lift)
    if (anim.spin !== 0) ctx.rotate(anim.spin)
    ctx.rotate(anim.lean)
    // 가로는 facing 으로 뒤집고, 세로 스쿼시만큼 가로를 반대로 눌러 부피를 유지한다.
    ctx.scale((state.facing * 1) / anim.squash, anim.squash)
    ctx.drawImage(this.bitmap, -width / 2, -height, width, height)
    ctx.restore()
  }

  private motionParams(state: AnimalRenderState, height: number) {
    const t = state.motionTime

    if (state.motion === 'SIGNATURE') {
      const progress = Math.min(1, t / SIGNATURE_DURATION)
      return {
        lift: Math.sin(Math.PI * progress) * height * 0.45,
        squash: 1 + Math.sin(Math.PI * progress) * 0.12,
        lean: 0,
        spin: Math.sin(Math.PI * progress) * 0.5 * state.facing,
      }
    }

    if (state.motion === 'MOVE') {
      const intensity = Math.max(0.35, state.speed01)
      return {
        lift: Math.abs(Math.sin(t * WALK_FREQ)) * height * WALK_BOB * intensity,
        squash: 1 + Math.sin(t * WALK_FREQ * 2) * 0.05 * intensity,
        lean: LEAN * intensity * state.facing,
        spin: 0,
      }
    }

    return {
      lift: Math.sin(t * IDLE_FREQ) * height * IDLE_BOB,
      squash: 1 + Math.sin(t * IDLE_FREQ) * 0.03,
      lean: 0,
      spin: 0,
    }
  }
}
