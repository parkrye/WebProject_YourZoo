import { ROAM_BOX, type BiomeId, type SkyPhase } from '@/assets/manifest'
import { MAX_VISITORS_PER_ENCLOSURE, VISITOR_STAY_SEC } from '@/domain/balance'
import type { AnimalBlackboard } from '@/ai/types'
import { createRng, type Rng } from '@/core/rng'
import type { Animal } from '@/domain/animal'
import { visitorCount } from '@/domain/economy'
import { createAnimalRenderer, createRigRenderer } from '@/render/animal'
import { AnimalAgent } from './AnimalAgent'
import { ensureBitmap, ensureStillBitmap, getBitmap } from './imageCache'
import { placedProps, type OwnedProp } from '@/domain/prop'
import { toPlacedProps, type PlacedProp } from './props'
import { pruneVisitors, stayingCount, trimVisitors, VisitorAgent } from './VisitorAgent'

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
  props: PlacedProp[]
  readonly animals: AnimalAgent[] = []
  readonly visitors: VisitorAgent[] = []

  private readonly rng: Rng
  private readonly spawnHints = new Map<string, { x: number; y: number }>()
  private btAccumulator = 0
  private spawnAccumulator = 0

  constructor(readonly biome: BiomeId) {
    this.props = []
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
  /** 이 우리에 놓인 프롭으로 갈아 끼운다. 자리는 플레이어가 정한 그대로다. */
  syncProps(list: readonly OwnedProp[]): void {
    this.props = toPlacedProps(placedProps(list, this.biome))
  }

  /** 정규화 좌표에서 프롭을 집는다. 앞에 있는 것(큰 y)부터 본다. */
  pickProp(x: number, y: number): PlacedProp | null {
    const ordered = [...this.props].sort((a, b) => b.y - a.y)
    for (const prop of ordered) {
      const half = prop.radius
      if (x >= prop.x - half && x <= prop.x + half && y >= prop.y - prop.height && y <= prop.y + half) {
        return prop
      }
    }
    return null
  }

  syncAnimals(list: readonly Animal[]): void {
    const wanted = list.filter((a) => a.status === 'PLACED' && a.enclosureId === this.biome)
    const wantedIds = new Set(wanted.map((a) => a.id))

    for (let i = this.animals.length - 1; i >= 0; i--) {
      if (!wantedIds.has(this.animals[i]?.id ?? '')) this.animals.splice(i, 1)
    }

    const existing = new Map(this.animals.map((a) => [a.id, a]))
    for (const animal of wanted) {
      const already = existing.get(animal.id)
      if (already) {
        // 스프라이트 시트를 새로 구웠다면 렌더러를 갈아 끼운다.
        // 여기서 걸러내지 않으면 캐시를 쓰고도 화면이 그대로다.
        if (already.animal.spriteSheet?.imageId !== animal.spriteSheet?.imageId) {
          already.animal = animal
          void this.attachRenderer(already)
        }
        continue
      }
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

  /**
   * 손님 드나듦.
   *
   * 목표 인원을 붙박이로 세워 두면 같은 사람이 계속 서 있는 게 눈에 띈다.
   * 대신 **저마다 들어왔다 나가게** 두고, 들어오는 속도만 목표에 맞춘다.
   * 평형 상태에서 평균 인원 = 스폰 속도 × 평균 체류 시간이므로,
   * 스폰 간격을 `평균 체류 / 목표` 로 잡으면 인원이 목표 주위에서 오르내린다.
   */
  private updateVisitors(dt: number, ctx: SimContext): void {
    const target = visitorCount(ctx.reputation, ctx.phase)

    pruneVisitors(this.visitors)
    // 명성이 떨어져 목표가 확 줄었을 때만 강제로 돌려보낸다.
    if (stayingCount(this.visitors) > target + 2) trimVisitors(this.visitors, target + 1)

    if (target > 0) {
      /*
        아무도 없으면 **기다리지 않고 부른다.**

        평소에는 시간 간격을 두고 들어오게 두는 게 자연스럽지만, 목표가 1명일 때는
        그 간격이 곧 평균 체류 시간(43초)이라 텅 빈 시간이 그만큼 길어진다.
        문을 연 동물원에 한참 아무도 없으면 망한 것처럼 보인다.
      */
      if (stayingCount(this.visitors) === 0) {
        this.visitors.push(new VisitorAgent(this.rng))
        this.spawnAccumulator = 0
      }

      const meanStay = (VISITOR_STAY_SEC.min + VISITOR_STAY_SEC.max) / 2
      const interval = meanStay / target
      this.spawnAccumulator += dt
      while (this.spawnAccumulator >= interval) {
        this.spawnAccumulator -= interval
        if (this.visitors.length < MAX_VISITORS_PER_ENCLOSURE) {
          this.visitors.push(new VisitorAgent(this.rng))
        }
      }
    }

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
      // 아직 화면 밖에서 걸어오는 손님이 동물을 겁줄 수는 없다.
      if (!visitor.isOnScreen) continue
      const d = Math.hypot(visitor.x - x, visitor.headY - y)
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

  /**
   * 그림(과 있다면 시트)을 읽어 렌더러를 붙인다.
   *
   * 시트가 있어도 **원본 그림을 먼저 읽는다.** 히트박스에 쓰는 가로세로 비율은
   * 동물 자체의 비율이어야 하는데, 시트 프레임은 여백까지 포함한 정사각이라
   * 거기서 뽑으면 판정 상자가 실제보다 넓어진다.
   */
  private async attachRenderer(agent: AnimalAgent): Promise<void> {
    const { animal } = agent
    const source = getBitmap(animal.imageId) ?? (await ensureBitmap(animal.imageId))
    if (!source) return
    agent.aspect = source.width / source.height

    // 파츠로 만든 동물은 부위를 모두 읽어 리그로 그린다.
    if (animal.rig) {
      const parts = new Map<string, ImageBitmap>()
      for (const [partId, imageId] of Object.entries(animal.rig)) {
        const part = getBitmap(imageId) ?? (await ensureBitmap(imageId))
        if (part) parts.set(partId, part)
      }
      if (parts.size > 0) {
        // 집기 판정 상자는 **합쳐 놓은 한 마리**의 비율이어야 한다.
        // 대표 그림에서 뽑으면 몸통 한 조각의 비율이 나와 상자가 실제와 어긋난다.
        const still = await ensureStillBitmap(animal)
        if (still) agent.aspect = still.width / still.height
        agent.renderer = createRigRenderer(animal, parts)
        return
      }
      // 파츠를 하나도 못 읽었다. 원본 그림으로라도 그린다.
    }

    const sheetId = animal.spriteSheet?.imageId
    if (!sheetId) {
      agent.renderer = createAnimalRenderer(animal, source)
      return
    }

    const sheet = getBitmap(sheetId) ?? (await ensureBitmap(sheetId))
    // 시트를 못 읽었으면 절차적으로 남긴다. 그림을 시트로 착각해 그리면 첫 칸만 확대된다.
    if (!sheet) {
      agent.renderer = createAnimalRenderer({ ...animal, spriteSheet: null }, source)
      return
    }
    agent.renderer = createAnimalRenderer(animal, sheet)
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
