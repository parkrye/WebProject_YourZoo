import type { Habitat } from '@/assets/manifest'
import { clamp } from '@/core/math'
import { pick, randInt, type Rng } from '@/core/rng'
import type { Animal } from './animal'
import { DIETS, HABITATS, TRAIT_KEYS, TRAIT_LABELS, type Diet, type TraitKey } from './traits'

/**
 * NPC 의뢰의 요구 조건.
 * 조건은 한 종류만 쓴다. 두 개를 겹치면 조건 문장이 길어지는데,
 * 폰트가 영문 대문자뿐이라 한 줄에 담기지 않는다.
 */
export type OrderRequirement =
  | { kind: 'HABITAT'; habitat: Habitat }
  | { kind: 'DIET'; diet: Diet }
  | { kind: 'TRAIT'; trait: TraitKey; min: number }
  | { kind: 'APPEAL'; min: number }

export interface Order {
  readonly id: string
  readonly requirement: OrderRequirement
  readonly rewardGold: number
  readonly rewardFame: number
  /** 이 날이 지나면 사라진다. */
  readonly expiresDay: number
}

const BASE_GOLD = 70
const BASE_FAME = 4
/** 의뢰가 게시판에 머무는 일수. */
const ORDER_LIFETIME_DAYS = 4
/** 동시에 걸려 있을 수 있는 의뢰 수. */
export const MAX_ACTIVE_ORDERS = 3

/** 조건을 만족하는지 본다. 배송 중인 동물은 아직 넘길 수 없다. */
export function matchesOrder(animal: Animal, order: Order): boolean {
  if (animal.status === 'SHIPPING') return false

  const req = order.requirement
  switch (req.kind) {
    case 'HABITAT':
      return animal.traits.habitat === req.habitat
    case 'DIET':
      return animal.traits.diet === req.diet
    case 'TRAIT':
      return animal.traits[req.trait] >= req.min
    case 'APPEAL':
      return animal.appeal >= req.min
  }
}

export function eligibleFor(animals: readonly Animal[], order: Order): Animal[] {
  return animals.filter((a) => matchesOrder(a, order))
}

/** 폰트가 A-Z / 0-9 뿐이라 한 줄로 짧게 만든다. */
export function orderLabel(order: Order): string {
  const req = order.requirement
  switch (req.kind) {
    case 'HABITAT':
      return `${req.habitat} ANIMAL`
    case 'DIET':
      return `${req.diet} DIET`
    case 'TRAIT':
      return `${TRAIT_LABELS[req.trait]} OVER ${Math.round(req.min * 100)}`
    case 'APPEAL':
      return `APPEAL OVER ${req.min}`
  }
}

export function createOrder(id: string, day: number, reputation: number, rng: Rng): Order {
  const requirement = rollRequirement(rng)
  // 명성이 오를수록 보상도 커진다. 후반에 의뢰가 무의미해지지 않도록.
  const scale = 1 + clamp(reputation / 120, 0, 1.5)
  const difficulty = requirementDifficulty(requirement)

  return {
    id,
    requirement,
    rewardGold: Math.round(BASE_GOLD * scale * difficulty),
    rewardFame: Math.round(BASE_FAME * scale * difficulty),
    expiresDay: day + ORDER_LIFETIME_DAYS,
  }
}

function rollRequirement(rng: Rng): OrderRequirement {
  const kind = randInt(rng, 0, 4)
  if (kind === 0) return { kind: 'HABITAT', habitat: pick(rng, HABITATS) }
  if (kind === 1) return { kind: 'DIET', diet: pick(rng, DIETS) }
  if (kind === 2) {
    return { kind: 'TRAIT', trait: pick(rng, TRAIT_KEYS), min: 0.5 + randInt(rng, 0, 3) * 0.1 }
  }
  return { kind: 'APPEAL', min: 20 + randInt(rng, 0, 4) * 5 }
}

/** 맞추기 어려운 조건일수록 보상이 크다. */
function requirementDifficulty(requirement: OrderRequirement): number {
  switch (requirement.kind) {
    case 'HABITAT':
      return 1
    case 'DIET':
      return 1
    case 'TRAIT':
      // 0.5 -> 1.0, 0.7 -> 1.4
      return 1 + (requirement.min - 0.5) * 2
    case 'APPEAL':
      // 20 -> 1.0, 35 -> 1.6
      return 1 + (requirement.min - 20) * 0.04
  }
}

export function expireOrders(orders: readonly Order[], day: number): Order[] {
  return orders.filter((o) => o.expiresDay > day)
}
