import { clamp } from '@/core/math'
import { randInt, randRange, type Rng } from '@/core/rng'
import { VISITOR_GRID } from '@/assets/manifest'

const X_MIN = 0.04
const X_MAX = 0.96
/** 퇴장할 때 향하는 화면 바깥 지점. 여기에 닿으면 목록에서 지운다. */
const EXIT_X = { left: -0.14, right: 1.14 } as const
/** 퇴장 걸음은 평소보다 조금 빠르다. 미적거리면 인원이 줄어든 게 보이지 않는다. */
const EXIT_SPEED = 0.11

/**
 * 손님 1명.
 *
 * 스프라이트가 **뒷모습 정지 1프레임**뿐이라 걷기 애니메이션이 없다.
 * 그래서 이동은 전부 절차적으로 만든다: 느린 수평 이동 + sin 상하 보빙 +
 * 미세한 좌우 스케일 흔들림. (docs/01-assets.md §2.4)
 */
/**
 * 개체별 키 배율.
 * 손님 시트에는 어른·아이·노인이 섞여 있다. 전부 같은 크기로 그리면 그 맛이 사라진다.
 */
const HEIGHT_SCALE = { min: 0.72, max: 1.12 } as const

export class VisitorAgent {
  readonly spriteIndex: number
  /** 이 손님의 키 배율. 스프라이트마다 원래 비율이 달라 그 위에 곱한다. */
  readonly heightScale: number
  x: number
  private vx: number
  private idleTimer: number
  private bobPhase: number
  private readonly bobSpeed: number
  private readonly walkSpeed: number

  constructor(private readonly rng: Rng) {
    this.spriteIndex = randInt(rng, 0, VISITOR_GRID.cols * VISITOR_GRID.rows)
    this.heightScale = randRange(rng, HEIGHT_SCALE.min, HEIGHT_SCALE.max)
    this.x = randRange(rng, X_MIN, X_MAX)
    this.walkSpeed = randRange(rng, 0.008, 0.022)
    this.vx = rng() < 0.5 ? -this.walkSpeed : this.walkSpeed
    this.idleTimer = randRange(rng, 1, 6)
    this.bobPhase = rng() * Math.PI * 2
    this.bobSpeed = randRange(rng, 3.4, 4.8)
  }

  /** 퇴장 중이면 화면 밖으로 걸어 나간다. */
  private leaving = false

  /** 관람 중(정지) 여부. 정지 상태에서는 보빙 진폭이 줄어든다. */
  get isWatching(): boolean {
    return this.vx === 0
  }

  /** 가까운 쪽 화면 밖으로 걸어 나가기 시작한다. */
  leave(): void {
    if (this.leaving) return
    this.leaving = true
    this.vx = this.x < 0.5 ? -EXIT_SPEED : EXIT_SPEED
  }

  get isLeaving(): boolean {
    return this.leaving
  }

  /** 화면 밖으로 완전히 나갔는가. 그때 목록에서 지운다. */
  get isGone(): boolean {
    return this.leaving && (this.x <= EXIT_X.left || this.x >= EXIT_X.right)
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
    this.bobPhase += dt * this.bobSpeed

    // 나가는 중에는 멈춰 서지 않는다. 방향도 바꾸지 않는다.
    if (this.leaving) {
      this.x += this.vx * dt
      return
    }

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

/**
 * 목표 인원에 맞춰 손님을 늘리고 줄인다. 기존 손님은 유지해 순간이동을 막는다.
 *
 * **줄일 때는 즉시 지우지 않는다.** 눈앞에서 사람이 사라지면 유령처럼 보인다.
 * 화면 밖으로 걸어 나가게 두고, 다 나간 뒤에 목록에서 뺀다.
 */
export function reconcileVisitors(list: VisitorAgent[], target: number, rng: Rng): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.isGone) list.splice(i, 1)
  }

  const staying = list.filter((v) => !v.isLeaving)
  if (staying.length > target) {
    // 나중에 온 손님부터 돌려보낸다.
    for (let i = staying.length - 1; i >= target; i--) staying[i]?.leave()
  }

  for (let i = staying.length; i < target; i++) list.push(new VisitorAgent(rng))
}
