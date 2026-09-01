import { ROAM_BOX, type RoamBox } from '@/assets/manifest'
import { action, condition, type BtNode } from './bt'
import type { AgentView, AnimalBlackboard, PropView } from './types'
import { clamp, lerp } from '@/core/math'
import { randRange, type Rng } from '@/core/rng'

/** 목표에 이만큼 다가가면 도착으로 친다. */
const ARRIVE_RADIUS = 0.012
/** 손님이 이보다 가까우면 겁 많은 동물이 위협을 느낀다. */
const THREAT_RADIUS = 0.22
/** 무리 짓기에서 이보다 가까우면 이미 붙어 있다고 본다. */
const PEER_COMFORT = 0.06
/** 리더에게서 이만큼 벌어지면 따라붙는다. 무리가 한 덩어리로 보이는 거리다. */
const FOLLOW_DISTANCE = 0.14
/** 리더의 동작을 따라 할 수 있는 거리. 화면 반대편에서 따라 하면 흉내로 안 읽힌다. */
const MIMIC_RADIUS = 0.24

// BT 는 10Hz 로 돌므로 아래 확률들은 "tick 당" 값이다.
const REST_CHANCE = 0.05
const SOCIAL_CHANCE = 0.03
const INSPECT_CHANCE = 0.025
const FOLLOW_CHANCE = 0.05
const DRINK_CHANCE = 0.012
const REST_COOLDOWN_SEC = 6
/** 물가는 큰맘 먹고 가는 곳이다. 자주 내려가면 그냥 거기 사는 것처럼 보인다. */
const DRINK_COOLDOWN_SEC = 30

/**
 * 물가로 내려갔을 때 서는 높이.
 *
 * 땅짐승은 물에 발을 담그지 않고 **경계 바로 앞**에 선다. 새는 수면 위를 스친다 —
 * 렌더가 `SKY_HOVER` 만큼 띄우므로 수면보다 조금 아래를 겨눠야 물 위에 뜬다.
 * 값은 로밍 박스에서 끌어온다. 경계를 손보면 여기가 저절로 따라온다.
 */
const DRINK_Y = {
  LAND: ROAM_BOX.LAND.y1 - 0.005,
  SKY: ROAM_BOX.WATER.y0 + 0.05,
} as const

// ─────────────────────────────────────────────────────────────
// 조건
// ─────────────────────────────────────────────────────────────

export function isThreatened(): BtNode<AnimalBlackboard> {
  return condition(({ self, visitorDistance }) => {
    if (self.traits.timidity <= 0.05) return false
    // 겁이 많을수록 더 먼 거리에서 반응한다.
    return visitorDistance < THREAT_RADIUS * self.traits.timidity
  })
}

export function needsRest(): BtNode<AnimalBlackboard> {
  return condition(({ self, rng }) => {
    if (self.restCooldown > 0) return false
    return rng() < (1 - self.traits.activity) * REST_CHANCE
  })
}

export function wantsSocial(): BtNode<AnimalBlackboard> {
  return condition(({ self, peers, rng }) => {
    if (peers.length === 0) return false
    if (rng() >= self.traits.sociability * SOCIAL_CHANCE) return false
    const peer = nearest(self, peers)
    return peer !== null && self.distanceTo(peer.x, peer.y) > PEER_COMFORT
  })
}

export function wantsInspect(): BtNode<AnimalBlackboard> {
  return condition(({ self, props, rng }) => {
    if (props.length === 0) return false
    return rng() < self.traits.curiosity * INSPECT_CHANCE
  })
}

/**
 * 리더에게서 너무 벌어졌는가.
 *
 * 무리 짓기(`wantsSocial`)와 다르다. 저쪽은 **아무나 곁으로** 가는 기분이고
 * 이쪽은 **자기 종을 따라가는** 습성이다. 그래서 사교성이 바닥이어도 아주
 * 안 따라가지는 않는다 — 사자 두 마리는 서로 데면데면해도 같이 다닌다.
 */
export function wantsFollow(): BtNode<AnimalBlackboard> {
  return condition(({ self, leader, rng }) => {
    if (!leader) return false
    if (self.distanceTo(leader.x, leader.y) <= FOLLOW_DISTANCE) return false
    return rng() < lerp(0.4, 1, self.traits.sociability) * FOLLOW_CHANCE
  })
}

/** 리더가 시그니처 동작을 하고 있고, 따라 할 만큼 가까운가. */
export function mimicsLeader(): BtNode<AnimalBlackboard> {
  return condition(({ self, leader }) => {
    if (!leader || leader.motion !== 'SIGNATURE') return false
    return self.distanceTo(leader.x, leader.y) < MIMIC_RADIUS
  })
}

/** 물가로 내려갈 때가 됐는가. 물에 사는 동물은 이미 거기 있다. */
export function wantsDrink(): BtNode<AnimalBlackboard> {
  return condition(({ self, rng }) => {
    if (self.habitat === 'WATER') return false
    if (self.drinkCooldown > 0) return false
    return rng() < DRINK_CHANCE
  })
}

// ─────────────────────────────────────────────────────────────
// 행동
// ─────────────────────────────────────────────────────────────

/** 로밍 박스 안의 임의 지점을 목표로 잡는다. 현재 위치와 너무 가까우면 다시 뽑는다. */
export function pickWanderTarget(): BtNode<AnimalBlackboard> {
  return action(({ self, roam, rng }) => {
    const sky = self.habitat === 'SKY'
    for (let attempt = 0; attempt < 4; attempt++) {
      const x = randRange(rng, roam.x0, roam.x1)
      const y = wanderY(rng, roam, sky)
      if (self.distanceTo(x, y) > 0.08) {
        self.setTarget(x, y)
        return 'SUCCESS'
      }
    }
    self.setTarget(randRange(rng, roam.x0, roam.x1), wanderY(rng, roam, sky))
    return 'SUCCESS'
  })
}

/**
 * 배회할 높이.
 *
 * 하늘의 로밍 박스는 이제 우리 바닥까지 닿는다. 그 안에서 고르게 뽑으면 새가
 * 절반쯤은 물 위에 낮게 떠 있게 되는데, 그건 나는 게 아니라 **떠다니는 것**으로 보인다.
 * 제곱을 씌워 위쪽으로 당긴다 — 아래로 내려오기는 하되 어쩌다 한 번이고,
 * 물가로 내려갈 진짜 이유는 목마름이 따로 만든다.
 */
function wanderY(rng: Rng, roam: RoamBox, sky: boolean): number {
  const t = sky ? rng() * rng() : rng()
  return roam.y0 + (roam.y1 - roam.y0) * t
}

export function targetNearestPeer(): BtNode<AnimalBlackboard> {
  return action(({ self, peers, rng }) => {
    const peer = nearest(self, peers)
    if (!peer) return 'FAILURE'
    // 정확히 겹치면 어색하므로 옆자리를 노린다.
    const offset = randRange(rng, -PEER_COMFORT, PEER_COMFORT)
    self.setTarget(peer.x + offset, peer.y + offset * 0.3)
    return 'SUCCESS'
  })
}

/** 리더 주위의 빈자리를 노린다. 정확히 뒤를 밟으면 한 몸처럼 겹쳐 보인다. */
export function targetLeader(): BtNode<AnimalBlackboard> {
  return action(({ self, leader, rng }) => {
    if (!leader) return 'FAILURE'
    const angle = rng() * Math.PI * 2
    const radius = PEER_COMFORT * (1 + rng())
    // y 쪽을 눌러 둔다. 화면이 가로로 길어 원으로 두면 위아래로만 늘어선다.
    self.setTarget(leader.x + Math.cos(angle) * radius, leader.y + Math.sin(angle) * radius * 0.4)
    return 'SUCCESS'
  })
}

/**
 * 가장 가까운 물가를 목표로 잡는다.
 *
 * x 는 지금 자리에서 멀지 않은 곳으로 고른다. 우리를 가로질러 물을 마시러 가면
 * 목이 마른 게 아니라 산책 나온 것으로 보인다.
 */
export function targetWaterEdge(): BtNode<AnimalBlackboard> {
  return action(({ self, roam, rng }) => {
    const edge = self.habitat === 'SKY' ? DRINK_Y.SKY : DRINK_Y.LAND
    self.setTarget(
      clamp(self.x + randRange(rng, -0.25, 0.25), roam.x0, roam.x1),
      clamp(edge, roam.y0, roam.y1),
    )
    return 'SUCCESS'
  })
}

export function targetNearestProp(): BtNode<AnimalBlackboard> {
  return action(({ self, props, rng }) => {
    const prop = nearestProp(self, props)
    if (!prop) return 'FAILURE'
    const side = rng() < 0.5 ? -1 : 1
    self.setTarget(prop.x + side * 0.06, prop.y)
    return 'SUCCESS'
  })
}

/** 손님 반대편, 즉 화면 안쪽(작은 y)으로 물러난다. */
export function pickFleeTarget(): BtNode<AnimalBlackboard> {
  return action(({ self, roam, rng }) => {
    const away = clamp(self.y - lerp(0.04, 0.12, self.traits.timidity), roam.y0, roam.y1)
    const drift = randRange(rng, -0.18, 0.18)
    self.setTarget(clamp(self.x + drift, roam.x0, roam.x1), away)
    return 'SUCCESS'
  })
}

/** 목표에 닿을 때까지 RUNNING. 실제 이동 적분은 AnimalAgent 가 60Hz 로 한다. */
export function moveToTarget(): BtNode<AnimalBlackboard> {
  return action(({ self }) => {
    const target = self.target
    if (!target) return 'FAILURE'

    if (self.distanceTo(target.x, target.y) <= ARRIVE_RADIUS) {
      self.clearTarget()
      self.motion = 'IDLE'
      return 'SUCCESS'
    }

    self.motion = 'MOVE'
    return 'RUNNING'
  })
}

/**
 * 그 자리에 멈춰 잠시 시간을 보낸다.
 *
 * 쉬는 것과 물가에 머무는 것은 **머무는 이유만 다르고 하는 일이 같다.**
 * 끝났을 때 어느 쿨다운을 거는지만 호출한 쪽이 정한다.
 */
function hold(
  minSec: number,
  maxSec: number,
  onDone: (self: AgentView) => void,
): BtNode<AnimalBlackboard> {
  let remaining = 0

  return {
    tick({ self, rng, dt }) {
      if (remaining <= 0) {
        remaining = randRange(rng, minSec, maxSec)
        self.clearTarget()
        self.motion = 'IDLE'
        return 'RUNNING'
      }

      remaining -= dt
      if (remaining > 0) return 'RUNNING'

      remaining = 0
      onDone(self)
      return 'SUCCESS'
    },
    reset() {
      remaining = 0
    },
  }
}

export function rest(minSec: number, maxSec: number): BtNode<AnimalBlackboard> {
  return hold(minSec, maxSec, (self) => {
    self.restCooldown = REST_COOLDOWN_SEC
  })
}

/** 물가에 서서 머문다. 도착한 뒤에 오는 노드다 — 여기서 이동은 하지 않는다. */
export function drink(minSec: number, maxSec: number): BtNode<AnimalBlackboard> {
  return hold(minSec, maxSec, (self) => {
    self.drinkCooldown = DRINK_COOLDOWN_SEC
  })
}

/** 가끔 시그니처 동작을 한 번 재생한다. 관찰 재미를 위한 장식. */
export function signature(durationSec: number): BtNode<AnimalBlackboard> {
  let remaining = 0

  return {
    tick({ self, dt }) {
      if (remaining <= 0) {
        remaining = durationSec
        self.clearTarget()
        self.motion = 'SIGNATURE'
        return 'RUNNING'
      }

      remaining -= dt
      if (remaining > 0) return 'RUNNING'

      remaining = 0
      self.motion = 'IDLE'
      return 'SUCCESS'
    },
    reset() {
      remaining = 0
    },
  }
}

// ─────────────────────────────────────────────────────────────

function nearest(self: AgentView, peers: readonly AgentView[]): AgentView | null {
  let best: AgentView | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const peer of peers) {
    if (peer === self) continue
    const d = self.distanceTo(peer.x, peer.y)
    if (d >= bestDistance) continue
    bestDistance = d
    best = peer
  }

  return best
}

function nearestProp(self: AgentView, props: readonly PropView[]): PropView | null {
  let best: PropView | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const prop of props) {
    if (prop.layer !== self.habitat) continue
    const d = self.distanceTo(prop.x, prop.y)
    if (d >= bestDistance) continue
    bestDistance = d
    best = prop
  }

  return best
}
