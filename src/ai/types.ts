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
  readonly x: number
  readonly y: number
  readonly habitat: Habitat
  readonly traits: AnimalTraits
  target: Vec2 | null
  motion: AnimalMotion
  /** 쉬고 난 뒤 바로 다시 쉬지 않도록 하는 쿨다운(초). */
  restCooldown: number
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
  props: readonly PropView[]
  roam: RoamBox
  /** 가장 가까운 손님과의 정규화 거리. 손님이 없으면 Infinity. */
  visitorDistance: number
  /** BT tick 간격(초) */
  dt: number
  rng: Rng
}
