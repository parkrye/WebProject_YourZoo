import type { Habitat, RoamBox } from '@/assets/manifest'
import type { AnimalMotion } from '@/domain/animal'
import type { AnimalTraits } from '@/domain/traits'
import type { Rng } from '@/core/rng'

export interface Vec2 {
  x: number
  y: number
}

/**
 * BT 액션이 조작하는 동물의 최소 인터페이스.
 *
 * `AnimalAgent` 클래스를 직접 참조하면 `ai/` 와 `sim/` 이 서로를 import 해
 * 순환이 생긴다. 필요한 표면만 여기 선언하고 `AnimalAgent` 가 이를 구현한다.
 */
export interface AgentView {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly habitat: Habitat
  /** 같은 종을 가르는 키. 리더를 뽑고 무리를 묶는 기준이다. */
  readonly speciesKey: string
  readonly traits: AnimalTraits
  target: Vec2 | null
  motion: AnimalMotion
  /** 쉬고 난 뒤 바로 다시 쉬지 않도록 하는 쿨다운(초). */
  restCooldown: number
  /** 물가에 다녀온 뒤 바로 또 내려가지 않도록 하는 쿨다운(초). */
  drinkCooldown: number
  setTarget(x: number, y: number): void
  clearTarget(): void
  distanceTo(x: number, y: number): number
}

export interface PropView {
  readonly x: number
  readonly y: number
  readonly layer: Habitat
}

export interface AnimalBlackboard {
  self: AgentView
  /** 같은 우리, 같은 서식지의 다른 동물들 */
  peers: readonly AgentView[]
  /**
   * 같은 우리, 같은 종의 동물들. **자기 자신도 들어 있다.**
   *
   * 빼고 넘기려면 개체마다 배열을 새로 만들어야 하는데, 그건 10Hz × 마릿수만큼
   * 쓰레기를 만든다. 자기를 건너뛰는 건 읽는 쪽에서 한 줄이면 된다.
   */
  flock: readonly AgentView[]
  /**
   * 무리의 리더. 자기가 리더이거나 무리가 혼자면 `null`.
   *
   * 뽑는 규칙은 `EnclosureSim` 이 정한다 — 여기서 매 tick 다시 뽑으면
   * 리더가 깜빡이며 바뀌어 따라가던 개체가 제자리에서 방향만 튼다.
   */
  leader: AgentView | null
  props: readonly PropView[]
  roam: RoamBox
  /** 가장 가까운 손님과의 정규화 거리. 손님이 없으면 Infinity. */
  visitorDistance: number
  /** BT tick 간격(초) */
  dt: number
  rng: Rng
}
