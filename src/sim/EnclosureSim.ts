import { ROAM_BOX, VISITOR_BASELINE_Y, type BiomeId, type SkyPhase } from '@/assets/manifest'
import type { AnimalBlackboard } from '@/ai/types'
import { createRng, type Rng } from '@/core/rng'
import type { Animal } from '@/domain/animal'
import { visitorCount } from '@/domain/economy'
import { createAnimalRenderer } from '@/render/animal'
import { AnimalAgent } from './AnimalAgent'
import { ensureBitmap, getBitmap } from './imageCache'
import { generateProps, type PlacedProp } from './props'
import { reconcileVisitors, VisitorAgent } from './VisitorAgent'

/** 화면에 보이는 우리의 BT 주기. 10Hz. */
const BT_INTERVAL_ACTIVE = 0.1
/** 보이지 않는 우리는 느리게 돌린다. 멈추면 돌아왔을 때 정지 화면처럼 보인다. */
const BT_INTERVAL_IDLE = 0.5

/** 작은 동물도 집을 수 있도록 히트 박스에 주는 여유 (정규화). */
const PICK_PADDING = 0.012

export interface SimContext {
  reputation: number
  phase: SkyPhase
  /** 지금 화면에 보이는 우리인가 */
  active: boolean
}

/**
 * 우리 하나의 시뮬레이션. 동물 + 손님 + 프롭을 소유한다.
 *
 * 비활성 우리도 계속 돌린다. 좌우로 넘겼다 돌아왔을 때 동물이 그 자리에
 * 얼어 있으면 살아 있다는 느낌이 깨진다. 대신 BT 주기를 낮춰 비용을 줄인다.
 */
export class EnclosureSim {
  readonly props: PlacedProp[]
  readonly animals: AnimalAgent[] = []
  readonly visitors: VisitorAgent[] = []

  private readonly rng: Rng
  private readonly spawnHints = new Map<string, { x: number; y: number }>()
  private btAccumulator = 0

  constructor(readonly biome: BiomeId) {
    this.props = generateProps(biome)
    this.rng = createRng(hashBiome(biome))
  }

  /**
   * 드롭으로 배치할 때 시작 위치를 알려 둔다.
   * 이걸 안 하면 손으로 놓은 자리와 무관하게 랜덤 위치에서 나타난다.
   */
  setSpawnHint(animalId: string, x: number, y: number): void {
    this.spawnHints.set(animalId, { x, y })
  }

  /** 스토어의 동물 목록과 에이전트 목록을 맞춘다. 기존 개체는 그대로 둔다. */
  syncAnimals(list: readonly Animal[]): void {
    const wanted = list.filter((a) => a.status === 'PLACED' && a.enclosureId === this.biome)
    const wantedIds = new Set(wanted.map((a) => a.id))

    for (let i = this.animals.length - 1; i >= 0; i--) {
      if (!wantedIds.has(this.animals[i]?.id ?? '')) this.animals.splice(i, 1)
    }

    const existing = new Set(this.animals.map((a) => a.id))
    for (const animal of wanted) {
      if (existing.has(animal.id)) continue
      const agent = new AnimalAgent(animal, this.rng)
      const hint = this.spawnHints.get(animal.id)
      if (hint) {
        agent.placeAt(hint.x, hint.y)
        this.spawnHints.delete(animal.id)
      }
      this.animals.push(agent)
      void this.attachRenderer(agent)
    }
  }

  update(dt: number, ctx: SimContext): void {
    this.updateVisitors(dt, ctx)

    const interval = ctx.active ? BT_INTERVAL_ACTIVE : BT_INTERVAL_IDLE
    this.btAccumulator += dt
    while (this.btAccumulator >= interval) {
      this.tickBehaviours(interval)
      this.btAccumulator -= interval
    }

    for (const agent of this.animals) agent.integrate(dt, this.props)
  }

  private updateVisitors(dt: number, ctx: SimContext): void {
    const target = visitorCount(ctx.reputation, ctx.phase, this.animals.length > 0)
    reconcileVisitors(this.visitors, target, this.rng)
    for (const visitor of this.visitors) visitor.update(dt)
  }

  private tickBehaviours(dt: number): void {
    for (const agent of this.animals) {
      const peers = this.animals.filter((other) => other !== agent && other.habitat === agent.habitat)
      const blackboard: AnimalBlackboard = {
        self: agent,
        peers,
        props: this.props,
        roam: ROAM_BOX[agent.habitat],
        visitorDistance: this.nearestVisitorDistance(agent.x, agent.y),
        dt,
        rng: this.rng,
      }
      agent.tickBt(blackboard)
    }
  }

  /** 손님은 펜스 앞 한 줄에 서 있으므로 기준선까지의 거리로 근사한다. */
  private nearestVisitorDistance(x: number, y: number): number {
    let best = Number.POSITIVE_INFINITY
    for (const visitor of this.visitors) {
      const d = Math.hypot(visitor.x - x, VISITOR_BASELINE_Y - y)
      if (d < best) best = d
    }
    return best
  }

  /**
   * 정규화 좌표에서 동물을 집는다.
   * **앞에 있는 개체(큰 y)부터** 검사한다. 겹쳐 보일 때 위에 그려진 쪽이 잡혀야 한다.
   */
  pickAnimal(x: number, y: number): AnimalAgent | null {
    const ordered = [...this.animals].sort((a, b) => b.y - a.y)
    for (const agent of ordered) {
      if (!agent.renderer) continue
      const box = agent.hitBox
      const inside =
        x >= box.left - PICK_PADDING &&
        x <= box.right + PICK_PADDING &&
        y >= box.top - PICK_PADDING &&
        y <= box.bottom + PICK_PADDING
      if (inside) return agent
    }
    return null
  }

  findAnimal(id: string): AnimalAgent | null {
    return this.animals.find((a) => a.id === id) ?? null
  }

  private async attachRenderer(agent: AnimalAgent): Promise<void> {
    const cached = getBitmap(agent.animal.imageId)
    const bitmap = cached ?? (await ensureBitmap(agent.animal.imageId))
    if (!bitmap) return
    agent.aspect = bitmap.width / bitmap.height
    agent.renderer = createAnimalRenderer(agent.animal, bitmap)
  }
}

function hashBiome(biome: BiomeId): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < biome.length; i++) {
    hash ^= biome.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
