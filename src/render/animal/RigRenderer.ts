import { orderedParts, partPivot, RIG_ROOT, type Gait, type RigPart, type RigSpec } from '@/domain/rig'
import type { AnimalRenderer, AnimalRenderState, ViewBox } from './AnimalRenderer'

const TAU = Math.PI * 2

const SIGNATURE_DURATION = 1.2
/** 걸음 한 번의 길이(초). 파츠의 위상은 전부 이 하나의 파에서 나온다. */
const STRIDE_SEC = 0.62
/** 숨 한 번의 길이(초). 걸음의 네 배쯤 느려야 "쉬고 있다"로 읽힌다. */
const BREATH_SEC = 2.8
/** 겁 많은 동물의 잔떨림 주기(라디안/초). 걸음보다 훨씬 빨라야 떨림으로 보인다. */
const TREMOR_RATE = 11
/** 기울기가 붙는 데 걸리는 시간(초). 걷기 시작하자마자 기울면 툭 꺾인다. */
const LEAN_EASE_SEC = 0.3
/** 몸통이 숨으로 늘어나는 비율. */
const BREATH_STRETCH = 0.05

/** 한 주기 안의 위치(u: 0..1)를 움직임의 양(-1..1)으로 바꾸는 파형. */
type Wave = (u: number) => number

/**
 * 걸음마다 다른 파형.
 *
 * 걸음의 성격은 진폭이 아니라 **파형의 모양**에서 나온다. 전부 sin 하나로 굴리면
 * 깡충 뛰는 것과 뒤뚱거리는 것과 헤엄치는 것이 "빠르기만 다른 같은 움직임"이 된다.
 */
const WAVES: Record<Gait, Wave> = {
  /** 앞으로 차는 구간은 짧고 딛는 구간은 길다. 걸음에 무게가 생긴다. */
  WALK: (u) => Math.sin(TAU * skew(u, 0.36)),
  /** 주기의 대부분을 땅에 붙어 보내다가 한 번에 튄다. */
  HOP: (u) => burst(u, 0.42),
  /** 양 끝에 머무는 파. 무게를 한쪽에 실었다 반대로 옮기는 뒤뚱거림이다. */
  WADDLE: (u) => plateau(Math.sin(TAU * u), 2.2),
  /** 물에는 멈추는 구간이 없다. 순수한 사인이 가장 물 같다. */
  SWIM: (u) => Math.sin(TAU * u),
  /** 내리치기는 빠르고 되올리기는 느리다. */
  FLAP: (u) => Math.sin(TAU * skew(u, 0.28)),
  /** 다리가 짧아 크게 흔들 것이 없다. 걷기보다 완만하다. */
  CRAWL: (u) => Math.sin(TAU * skew(u, 0.44)),
}

/** 쉴 때의 파형. 걸음과 달리 어느 쪽으로도 치우치지 않는다 — 숨은 대칭이다. */
const BREATHE: Wave = (u) => Math.sin(TAU * u)

/** 걸음이 몸 전체를 얼마나 들어 올리는가 (동물 높이 대비). */
const ROOT_BOUNCE: Record<Gait, number> = {
  WALK: 0.022, HOP: 0.11, WADDLE: 0.02, SWIM: 0.018, FLAP: 0.05, CRAWL: 0.008,
}

/** 한 걸음에 몸이 몇 번 오르내리는가. 네발은 대각선 짝이라 두 번, 뛰기는 한 번이다. */
const BOUNCE_BEATS: Record<Gait, number> = {
  WALK: 2, HOP: 1, WADDLE: 2, SWIM: 1, FLAP: 1, CRAWL: 2,
}

/** 나아갈 때 몸이 진행 방향으로 기우는 각(라디안). */
const LEAN: Record<Gait, number> = {
  WALK: 0.05, HOP: 0.1, WADDLE: 0.03, SWIM: 0.07, FLAP: 0.09, CRAWL: 0.02,
}

/** 파츠 하나가 제자리에서 벗어난 양. */
interface Offset {
  dx: number
  dy: number
  spin: number
}

/** 이 프레임의 몸 전체 상태. 파츠는 여기서 각자의 위상만 떼어 쓴다. */
interface Frame {
  /** 몸 전체를 들어 올리는 양(px). */
  lift: number
  /** 몸 전체의 기울기(라디안). */
  spin: number
  /** 주기 위치의 기준. 파츠마다 beats·phase 로 어긋낸다. */
  phase: number
  /** 움직임의 세기 (0..1). */
  intensity: number
  wave: Wave
  /** 숨. 양수면 몸통이 세로로 늘어난다. */
  breath: number
  /** 잔떨림. 겁 많은 동물이 가만히 있을 때 붙는다. */
  tremor: number
  /** 개체마다 다른 위상. 같은 종이 한 몸처럼 붙어 흔들리는 걸 막는다. */
  seed: number
}

/**
 * 파츠를 관절로 돌려 움직이는 렌더러.
 *
 * 통짜 비트맵을 띠로 밀던 `ProceduralRenderer` 와 다르다 — 여기서는 다리가
 * **엉덩이를 축으로 실제로 돈다.** 앞뒤 다리에 위상을 반대로 주면 걸음이 걸음처럼 보인다.
 *
 * 살아 있게 보이려면 파츠를 흔드는 것만으로는 모자라고 셋이 더 필요하다.
 *
 * 1. **계층.** 머리와 꼬리는 몸통에 붙어 있다. 각자 돌기만 하면 다섯 장이
 *    따로 흔들리는 것으로 읽힌다. 몸통을 부모로 삼아 함께 기울인다.
 * 2. **걸음마다 다른 파형.** 진폭만 다른 같은 sin 은 빠르기 차이로만 보인다(`WAVES`).
 * 3. **루트 모션.** 걸으면 몸이 뜨고 진행 방향으로 기운다. 제자리에서 팔다리만
 *    움직이면 바닥을 미끄러지는 것으로 보인다.
 *
 * 쉴 때와 걸을 때는 파형 자체가 다르다 — 쉴 때는 걸음이 아니라 숨이다.
 */
export class RigRenderer implements AnimalRenderer {
  private readonly ordered: readonly RigPart[]
  /** 나머지 파츠가 매달리는 몸통. 없는 리그는 없지만 방어해 둔다. */
  private readonly root: RigPart | undefined

  constructor(
    private readonly spec: RigSpec,
    private readonly parts: ReadonlyMap<string, ImageBitmap>,
  ) {
    this.ordered = orderedParts(spec)
    this.root = spec.parts.find((p) => p.id === RIG_ROOT)
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

    // 부모 변환을 먼저 구한다. 몸이 기울면 머리도 꼬리도 함께 기운다.
    const root = this.root
    const rootOffset = root ? this.offsetOf(root, frame, width, height) : null

    for (const part of this.ordered) {
      const bitmap = this.parts.get(part.id)
      if (!bitmap) continue
      this.drawPart(ctx, part, bitmap, width, height, frame, root === part ? null : rootOffset)
    }

    ctx.restore()
  }

  private drawPart(
    ctx: CanvasRenderingContext2D,
    part: RigPart,
    bitmap: ImageBitmap,
    width: number,
    height: number,
    frame: Frame,
    /** 몸통의 변환. 몸통 자신을 그릴 때는 null 이다. */
    rootOffset: Offset | null,
  ): void {
    const boxW = part.w * width
    const boxH = part.h * height
    const own = this.offsetOf(part, frame, width, height)

    ctx.save()

    // 부모(몸통)의 축을 중심으로 함께 움직인다. 다리는 조금만 따라간다 —
    // 몸이 오르내릴 때 발까지 그만큼 뜨면 땅에서 미끄러지는 것으로 보인다.
    const root = this.root
    const follow = part.follow ?? 1
    if (rootOffset && root && follow > 0) {
      const [rx, ry] = partPivot(root, width, height)
      ctx.translate(rx + rootOffset.dx * follow, ry + rootOffset.dy * follow)
      ctx.rotate(rootOffset.spin * follow)
      ctx.translate(-rx, -ry)
    }

    const [px, py] = partPivot(part, width, height)
    ctx.translate(px + own.dx, py + own.dy)
    ctx.rotate(own.spin)
    // 숨은 몸통에서만 부피로 나타난다. 늘어난 만큼 가로가 줄어야 부풀지 않는다.
    if (part === this.root && frame.breath !== 0) {
      ctx.scale(1 - frame.breath * 0.5, 1 + frame.breath)
    }
    // 축이 원점에 오도록 상자를 되돌려 그린다.
    ctx.drawImage(bitmap, -boxW * part.px, -boxH * part.py, boxW, boxH)

    ctx.restore()
  }

  /** 파츠 하나가 이 프레임에서 제자리를 얼마나 벗어나는가. */
  private offsetOf(part: RigPart, frame: Frame, width: number, height: number): Offset {
    const m = part.motion
    // 위상만 어긋내면 앞다리와 뒷다리가 엇갈린다. 걸음이 걸음처럼 보이는 건 이 어긋남이다.
    const u = frac(frame.phase * m.beats + m.phase + frame.seed)
    // 멈춰 있어도 숨은 쉰다. 완전히 굳어 보이면 죽은 것처럼 읽힌다.
    const weight = m.idle + (1 - m.idle) * frame.intensity
    // 잔떨림은 원래 잘 움직이는 부위에만 붙인다. 다리가 떠는 건 겁이 아니라 고장이다.
    const amount = frame.wave(u) * weight + frame.tremor * m.idle

    return {
      dx: amount * m.sway * width,
      dy: amount * m.bob * height,
      spin: amount * m.swing,
    }
  }

  private frameParams(state: AnimalRenderState, height: number): Frame {
    const t = state.motionTime
    const seed = state.seed ?? 0
    const gait = this.spec.gait

    if (state.motion === 'SIGNATURE') {
      const arc = Math.sin(Math.PI * Math.min(1, t / SIGNATURE_DURATION))
      return {
        lift: arc * height * 0.45,
        spin: arc * 0.5 * state.facing,
        phase: t / STRIDE_SEC,
        intensity: 1.4,
        wave: WAVES[gait],
        breath: 0,
        tremor: 0,
        seed,
      }
    }

    if (state.motion !== 'MOVE') {
      // 쉬는 동안 움직이는 것은 걸음이 아니라 **숨**이다. 파형도 박자도 걸을 때와
      // 달라야 서 있는 것과 걷는 것이 "빠르기 차이"로만 보이지 않는다.
      const activity = state.activity ?? 0.5
      const timidity = state.timidity ?? 0.2
      const phase = (t / BREATH_SEC) * (0.7 + activity * 0.6)
      return {
        lift: 0,
        spin: 0,
        phase,
        // 쉴 때는 파츠의 idle 값만 쓴다. 걸음의 세기를 섞으면 서 있는 게 걷기가 된다.
        intensity: 0,
        wave: BREATHE,
        breath: Math.sin(TAU * frac(phase + seed)) * BREATH_STRETCH,
        tremor: Math.sin(t * TREMOR_RATE + seed * TAU) * timidity * 0.12,
        seed,
      }
    }

    // 빨리 걸으면 걸음도 빨라진다. 속도와 다리 박자가 어긋나면 미끄러져 보인다.
    const intensity = Math.max(0.45, state.speed01)
    const phase = (t / STRIDE_SEC) * (0.5 + intensity)
    const bounce = frac(phase * BOUNCE_BEATS[gait] + seed)

    return {
      lift: liftShape(gait, bounce) * height * ROOT_BOUNCE[gait] * intensity,
      // 걷기 시작하자마자 기울면 툭 꺾인다. 기울기만 짧게 붙여 준다.
      spin: LEAN[gait] * intensity * state.facing * Math.min(1, t / LEAN_EASE_SEC),
      phase,
      intensity,
      wave: WAVES[gait],
      breath: 0,
      tremor: 0,
      seed,
    }
  }

  /** 이 리그가 그릴 수 있는 파츠가 하나라도 있는가. */
  get isEmpty(): boolean {
    return this.spec.parts.every((p) => !this.parts.has(p.id))
  }
}

/** 걸음이 몸을 들어 올리는 모양. 땅을 딛는 걸음은 아래로 내려가지 않는다. */
function liftShape(gait: Gait, u: number): number {
  if (gait === 'HOP') return Math.max(0, burst(u, 0.42))
  // 물과 하늘에는 바닥이 없다. 오르내림이 대칭이다.
  if (gait === 'SWIM' || gait === 'FLAP') return Math.sin(TAU * u)
  return Math.sin(Math.PI * u)
}

const frac = (v: number): number => v - Math.floor(v)

/**
 * 주기의 앞쪽 `pivot` 만큼을 반 주기로 눌러 넣는다.
 *
 * `pivot` 이 0.5 보다 작으면 앞 절반이 빨라진다 — 다리를 앞으로 차는 동작은 빠르고
 * 땅을 딛고 미는 동작은 느리다. 이 어긋남이 걸음에 무게를 준다.
 */
function skew(u: number, pivot: number): number {
  return u < pivot ? (u / pivot) * 0.5 : 0.5 + ((u - pivot) / (1 - pivot)) * 0.5
}

/**
 * 한 번 크게 튀고 나머지는 가라앉아 있다.
 *
 * 깡충 뛰는 걸음은 사인이 아니다. 주기의 절반 이상을 땅에 붙어 웅크리고 있다가
 * 짧게 솟는다. 뒤쪽의 옅은 음수가 다음 도약 전의 웅크림이다.
 */
function burst(u: number, span: number): number {
  if (u < span) return Math.sin(Math.PI * (u / span))
  return -Math.sin(Math.PI * ((u - span) / (1 - span))) * 0.18
}

/**
 * 양 끝에 머무는 파. 네모파에 가까울수록 `k` 를 키운다.
 *
 * 뒤뚱거림은 좌우를 오가는 것이 아니라 **한쪽에 무게를 실었다가 반대로 옮기는** 것이다.
 * 사인으로 그리면 가운데를 지나는 시간이 길어 미끄러지듯 보인다.
 */
function plateau(v: number, k: number): number {
  return Math.tanh(v * k) / Math.tanh(k)
}
