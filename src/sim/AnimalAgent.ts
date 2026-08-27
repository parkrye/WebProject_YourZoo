import {
  ANIMAL_HEIGHT, LOGICAL_HEIGHT, LOGICAL_WIDTH, PERSPECTIVE_SCALE, ROAM_BOX,
  type Habitat, type RoamBox,
} from '@/assets/manifest'

import { buildAnimalTree } from '@/ai/buildTree'
import type { BtNode } from '@/ai/bt'
import type { AgentView, AnimalBlackboard, Vec2 } from '@/ai/types'
import { clamp, inverseLerp, lerp } from '@/core/math'
import { randRange, type Rng } from '@/core/rng'
import type { Animal, AnimalMotion } from '@/domain/animal'
import type { AnimalRenderer, AnimalRenderState } from '@/render/animal/AnimalRenderer'
import type { PlacedProp } from './props'

/** 습성 speed 0..1 을 실제 이동 속도(정규화 단위/초)로 환산하는 범위. */
const SPEED_RANGE = { min: 0.02, max: 0.13 }
/** 목표 방향으로 붙는 속도. 클수록 기민하게 방향을 바꾼다. */
const STEER_RESPONSE = 6
const ASPECT = LOGICAL_HEIGHT / LOGICAL_WIDTH

export class AnimalAgent implements AgentView {
  x: number
  y: number
  target: Vec2 | null = null
  motion: AnimalMotion = 'IDLE'
  motionTime = 0
  restCooldown = 0
  facing: 1 | -1 = 1
  /** 비트맵 로드가 끝나면 EnclosureSim 이 채운다. 그 전까지는 그리지 않는다. */
  renderer: AnimalRenderer | null = null
  /** 그림의 가로/세로 비. 히트 박스 계산에 필요하다. 비트맵과 함께 채워진다. */
  aspect = 1

  private vx = 0
  private vy = 0
  private readonly tree: BtNode<AnimalBlackboard>
  private readonly maxSpeed: number

  constructor(
    readonly animal: Animal,
    rng: Rng,
  ) {
    const box = this.roam
    this.x = randRange(rng, box.x0, box.x1)
    this.y = randRange(rng, box.y0, box.y1)
    this.tree = buildAnimalTree(animal.traits)
    this.maxSpeed = lerp(SPEED_RANGE.min, SPEED_RANGE.max, animal.traits.speed)
  }

  get id(): string {
    return this.animal.id
  }

  get traits() {
    return this.animal.traits
  }

  get habitat(): Habitat {
    return this.animal.traits.habitat
  }

  get roam(): RoamBox {
    return ROAM_BOX[this.animal.traits.habitat]
  }

  /** 드롭한 자리에 내려놓는다. 로밍 박스를 벗어나면 안쪽으로 당긴다. */
  placeAt(x: number, y: number): void {
    const box = this.roam
    this.x = clamp(x, box.x0, box.x1)
    this.y = clamp(y, box.y0, box.y1)
    this.target = null
    this.motion = 'IDLE'
    this.motionTime = 0
  }

  setTarget(x: number, y: number): void {
    const box = this.roam
    this.target = { x: clamp(x, box.x0, box.x1), y: clamp(y, box.y0, box.y1) }
  }

  clearTarget(): void {
    this.target = null
  }

  distanceTo(x: number, y: number): number {
    // 화면 비율을 반영해야 "가깝다"가 시각적 거리와 일치한다.
    return Math.hypot(x - this.x, (y - this.y) / ASPECT)
  }

  tickBt(blackboard: AnimalBlackboard): void {
    this.tree.tick(blackboard)
  }

  /**
   * 60Hz 이동 적분. BT 가 정한 `target` 을 향해 가속하고 프롭을 피한다.
   * BT 는 10Hz 로 돌기 때문에 이동을 BT 에 맡기면 눈에 띄게 끊긴다.
   */
  integrate(dt: number, props: readonly PlacedProp[]): void {
    this.motionTime += dt
    if (this.restCooldown > 0) this.restCooldown -= dt

    const desired = this.desiredVelocity()
    this.vx += (desired.x - this.vx) * Math.min(1, dt * STEER_RESPONSE)
    this.vy += (desired.y - this.vy) * Math.min(1, dt * STEER_RESPONSE)

    this.x += this.vx * dt
    this.y += this.vy * dt

    this.avoidProps(props)

    const box = this.roam
    this.x = clamp(this.x, box.x0, box.x1)
    this.y = clamp(this.y, box.y0, box.y1)

    if (Math.abs(this.vx) > 0.001) this.facing = this.vx < 0 ? -1 : 1
  }

  /**
   * 커서로 집을 수 있는 영역 (정규화 좌표).
   * 발밑이 기준이므로 y 는 `[y - 높이, y]`, x 는 중앙 정렬이다.
   * 화면이 가로로 길어 정규화 x 폭은 종횡비를 한 번 더 환산해야 한다.
   */
  get hitBox(): { left: number; right: number; top: number; bottom: number } {
    const state = this.toRenderState()
    const halfWidth = (state.scale * this.aspect * ASPECT) / 2
    return {
      left: state.x - halfWidth,
      right: state.x + halfWidth,
      top: state.y - state.scale,
      bottom: state.y,
    }
  }

  /** 현재 속도 / 최대 속도. 렌더러가 애니메이션 세기를 정하는 데 쓴다. */
  get speed01(): number {
    return clamp(Math.hypot(this.vx, this.vy) / this.maxSpeed, 0, 1)
  }

  /** 원근 보정을 반영한 렌더 상태. y 가 클수록 카메라에 가까우니 크게 그린다. */
  toRenderState(): AnimalRenderState {
    const box = this.roam
    const depth = inverseLerp(box.y0, box.y1, this.y)
    const perspective =
      this.habitat === 'SKY' ? 1 : lerp(PERSPECTIVE_SCALE.far, PERSPECTIVE_SCALE.near, depth)

    return {
      x: this.x,
      y: this.y,
      facing: this.facing,
      motion: this.motion,
      motionTime: this.motionTime,
      speed01: this.speed01,
      scale: perspective * ANIMAL_HEIGHT[this.habitat],
    }
  }

  private desiredVelocity(): Vec2 {
    const target = this.target
    if (!target || this.motion !== 'MOVE') return { x: 0, y: 0 }

    const dx = target.x - this.x
    const dy = (target.y - this.y) * ASPECT
    const length = Math.hypot(dx, dy)
    if (length < 1e-5) return { x: 0, y: 0 }

    return { x: (dx / length) * this.maxSpeed, y: (dy / length) * this.maxSpeed * ASPECT }
  }

  /** 프롭 안으로 파고들면 밖으로 밀어낸다. 뒤로 지나가는 연출은 y 정렬이 담당한다. */
  private avoidProps(props: readonly PlacedProp[]): void {
    for (const prop of props) {
      if (prop.layer !== this.habitat) continue

      const dx = this.x - prop.x
      const dy = (this.y - prop.y) / ASPECT
      const distance = Math.hypot(dx, dy)
      if (distance >= prop.radius || distance < 1e-5) continue

      const push = (prop.radius - distance) / distance
      this.x += dx * push
      this.y += dy * push * ASPECT
    }
  }
}
