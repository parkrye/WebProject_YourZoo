import { clamp } from '@/core/math'
import { randInt, randRange, type Rng } from '@/core/rng'
import { VISITOR_GRID } from '@/assets/manifest'

const X_MIN = 0.04
const X_MAX = 0.96

/**
 * 손님 1명.
 *
 * 스프라이트가 **뒷모습 정지 1프레임**뿐이라 걷기 애니메이션이 없다.
 * 그래서 이동은 전부 절차적으로 만든다: 느린 수평 이동 + sin 상하 보빙 +
 * 미세한 좌우 스케일 흔들림. (docs/01-assets.md §2.4)
 */
export class VisitorAgent {
  readonly spriteIndex: number
  x: number
  private vx: number
  private idleTimer: number
  private bobPhase: number
  private readonly bobSpeed: number
  private readonly walkSpeed: number

  constructor(private readonly rng: Rng) {
    this.spriteIndex = randInt(rng, 0, VISITOR_GRID.cols * VISITOR_GRID.rows)
    this.x = randRange(rng, X_MIN, X_MAX)
    this.walkSpeed = randRange(rng, 0.008, 0.022)
    this.vx = rng() < 0.5 ? -this.walkSpeed : this.walkSpeed
    this.idleTimer = randRange(rng, 1, 6)
    this.bobPhase = rng() * Math.PI * 2
    this.bobSpeed = randRange(rng, 3.4, 4.8)
  }

  /** 관람 중(정지) 여부. 정지 상태에서는 보빙 진폭이 줄어든다. */
  get isWatching(): boolean {
    return this.vx === 0
  }

  get bobOffset(): number {
    const amplitude = this.isWatching ? 0.0018 : 0.0055
    return Math.sin(this.bobPhase) * amplitude
  }

  /** 걸을 때 몸이 살짝 눌렸다 펴지는 느낌. */
  get squash(): number {
    return this.isWatching ? 1 : 1 + Math.sin(this.bobPhase * 2) * 0.02
  }

  update(dt: number): void {
    this.bobPhase += dt * this.bobSpeed * (this.isWatching ? 0.5 : 1)

    this.idleTimer -= dt
    if (this.idleTimer <= 0) {
      this.toggleState()
      return
    }

    if (this.vx === 0) return

    this.x += this.vx * dt
    if (this.x <= X_MIN || this.x >= X_MAX) {
      this.x = clamp(this.x, X_MIN, X_MAX)
      this.vx = -this.vx
    }
  }

  private toggleState(): void {
    if (this.vx === 0) {
      this.vx = this.rng() < 0.5 ? -this.walkSpeed : this.walkSpeed
      this.idleTimer = randRange(this.rng, 2, 7)
      return
    }
    this.vx = 0
    this.idleTimer = randRange(this.rng, 3, 10)
  }
}

/** 목표 인원에 맞춰 손님 배열을 증감시킨다. 기존 손님은 유지해 순간이동을 막는다. */
export function reconcileVisitors(list: VisitorAgent[], target: number, rng: Rng): void {
  while (list.length > target) list.pop()
  while (list.length < target) list.push(new VisitorAgent(rng))
}
