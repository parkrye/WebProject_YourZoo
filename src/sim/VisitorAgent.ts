import { clamp } from '@/core/math'
import { randInt, randRange, type Rng } from '@/core/rng'
import { VISITOR_GRID, VISITOR_HEIGHT, VISITOR_SUBMERGE, VISITOR_PERSPECTIVE } from '@/assets/manifest'
import { lerp } from '@/core/math'
import { VISITOR_STAY_SEC } from '@/domain/balance'

const X_MIN = 0.04
const X_MAX = 0.96
/** 입장·퇴장 때 오가는 화면 바깥 지점. 퇴장은 여기에 닿으면 목록에서 지운다. */
const EXIT_X = { left: -0.14, right: 1.14 } as const
/** 퇴장 걸음은 평소보다 조금 빠르다. 미적거리면 인원이 줄어든 게 보이지 않는다. */
const EXIT_SPEED = 0.11
/** 입장 걸음도 빠르다. 화면 밖에서 관람로까지 어슬렁거리면 언제 들어오나 싶다. */
const ENTER_SPEED = 0.1

/**
 * 손님 1명.
 *
 * 스프라이트가 **뒷모습 정지 1프레임**뿐이라 걷기 애니메이션이 없다.
 * 그래서 이동은 전부 절차적으로 만든다: 느린 수평 이동 + sin 상하 보빙 +
 * 미세한 좌우 스케일 흔들림. (docs/01-assets.md §2.4)
 */
/**
 * 개체별 키 흔들림.
 *
 * 손님 시트에는 어른·아이·노인이 이미 제각각 크기로 그려져 있고, 렌더러가 그 **원본
 * 상대 크기를 그대로 살린다.** 여기서는 같은 스프라이트가 여러 명 나왔을 때만
 * 구분되도록 아주 살짝 흔든다. 크게 잡으면 원본의 비율을 도로 망친다.
 */
const HEIGHT_SCALE = { min: 0.94, max: 1.06 } as const

export class VisitorAgent {
  readonly spriteIndex: number
  /** 이 손님의 키 배율. 스프라이트마다 원래 비율이 달라 그 위에 곱한다. */
  readonly heightScale: number
  /** 관람로에서의 앞뒤 위치. 0 = 뒤(위), 1 = 앞(아래). */
  readonly depth: number
  x: number
  private vx: number
  private idleTimer: number
  private bobPhase: number
  private readonly bobSpeed: number
  private readonly walkSpeed: number

  constructor(private readonly rng: Rng) {
    this.spriteIndex = randInt(rng, 0, VISITOR_GRID.cols * VISITOR_GRID.rows)
    this.heightScale = randRange(rng, HEIGHT_SCALE.min, HEIGHT_SCALE.max)
    this.depth = rng()
    this.stayTimer = randRange(rng, VISITOR_STAY_SEC.min, VISITOR_STAY_SEC.max)
    // 관람로 한복판에 툭 나타나면 어디서 왔는지 알 수 없다. 화면 밖에서 걸어 들어온다.
    const fromLeft = rng() < 0.5
    this.x = fromLeft ? EXIT_X.left : EXIT_X.right
    this.entryTarget = fromLeft
      ? randRange(rng, X_MIN, 0.55)
      : randRange(rng, 0.45, X_MAX)
    this.walkSpeed = randRange(rng, 0.008, 0.022)
    this.vx = fromLeft ? ENTER_SPEED : -ENTER_SPEED
    this.idleTimer = randRange(rng, 1, 6)
    this.bobPhase = rng() * Math.PI * 2
    this.bobSpeed = randRange(rng, 3.4, 4.8)
  }

  /** 아직 관람로까지 걸어 들어오는 중인가. */
  private entering = true
  /** 걸어 들어와 멈춰 설 자리. */
  private readonly entryTarget: number
  /** 퇴장 중이면 화면 밖으로 걸어 나간다. */
  private leaving = false
  /** 남은 체류 시간. 다 되면 스스로 돌아간다. */
  private stayTimer = 0

  /**
   * 자기 키의 몇 배만큼 화면 아래로 잠기는가.
   * 뒤에 선 손님은 조금만 잠겨 허리까지 보이고, 앞에 선 손님은 어깨만 걸린다.
   */
  get submerge(): number {
    return lerp(VISITOR_SUBMERGE.far, VISITOR_SUBMERGE.near, this.depth)
  }

  /** 머리 꼭대기의 대략적인 y. 동물이 손님과의 거리를 잴 때만 쓰므로 평균 체격으로 잡는다. */
  get headY(): number {
    return 1 + VISITOR_HEIGHT * this.perspective * (this.submerge - 1)
  }

  /** 앞에 선 손님일수록 크다. */
  get perspective(): number {
    return lerp(VISITOR_PERSPECTIVE.far, VISITOR_PERSPECTIVE.near, this.depth)
  }

  /** 관람 중(정지) 여부. 정지 상태에서는 보빙 진폭이 줄어든다. */
  get isWatching(): boolean {
    return this.vx === 0
  }

  /** 화면 안에 들어와 있는가. 밖에서 걸어오는 동안에는 그리지 않아도 된다. */
  get isOnScreen(): boolean {
    return this.x > EXIT_X.left && this.x < EXIT_X.right
  }

  /** 가까운 쪽 화면 밖으로 걸어 나가기 시작한다. */
  leave(): void {
    if (this.leaving) return
    this.leaving = true
    this.entering = false
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

    // 들어오는 동안에는 체류 시간이 줄지 않는다. 관람로에 서야 관람이 시작된다.
    if (this.entering) {
      this.x += this.vx * dt
      const arrived = this.vx > 0 ? this.x >= this.entryTarget : this.x <= this.entryTarget
      if (!arrived) return
      this.x = this.entryTarget
      this.entering = false
      this.vx = 0
      this.idleTimer = 0.4
      return
    }

    // 볼 만큼 봤으면 스스로 돌아간다.
    if (!this.leaving) {
      this.stayTimer -= dt
      if (this.stayTimer <= 0) this.leave()
    }

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

/** 화면 밖으로 나간 손님을 목록에서 뺀다. */
export function pruneVisitors(list: VisitorAgent[]): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.isGone) list.splice(i, 1)
  }
}

/** 아직 머무는 손님 수. 나가는 중인 사람은 세지 않는다. */
export function stayingCount(list: readonly VisitorAgent[]): number {
  return list.reduce((n, v) => (v.isLeaving ? n : n + 1), 0)
}

/** 목표를 크게 웃돌면 나중에 온 순으로 돌려보낸다. */
export function trimVisitors(list: readonly VisitorAgent[], target: number): void {
  const staying = list.filter((v) => !v.isLeaving)
  for (let i = staying.length - 1; i >= target; i--) staying[i]?.leave()
}
