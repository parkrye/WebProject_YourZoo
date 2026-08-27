import { action, condition, type BtNode } from './bt'
import type { AgentView, AnimalBlackboard, PropView } from './types'
import { clamp, lerp } from '@/core/math'
import { randRange } from '@/core/rng'

/** 목표에 이만큼 다가가면 도착으로 친다. */
const ARRIVE_RADIUS = 0.012
/** 손님이 이보다 가까우면 겁 많은 동물이 위협을 느낀다. */
const THREAT_RADIUS = 0.22
/** 무리 짓기에서 이보다 가까우면 이미 붙어 있다고 본다. */
const PEER_COMFORT = 0.06

// BT 는 10Hz 로 돌므로 아래 확률들은 "tick 당" 값이다.
const REST_CHANCE = 0.05
const SOCIAL_CHANCE = 0.03
const INSPECT_CHANCE = 0.025
const REST_COOLDOWN_SEC = 6

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

// ─────────────────────────────────────────────────────────────
// 행동
// ─────────────────────────────────────────────────────────────

/** 로밍 박스 안의 임의 지점을 목표로 잡는다. 현재 위치와 너무 가까우면 다시 뽑는다. */
export function pickWanderTarget(): BtNode<AnimalBlackboard> {
  return action(({ self, roam, rng }) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const x = randRange(rng, roam.x0, roam.x1)
      const y = randRange(rng, roam.y0, roam.y1)
      if (self.distanceTo(x, y) > 0.08) {
        self.setTarget(x, y)
        return 'SUCCESS'
      }
    }
    self.setTarget(randRange(rng, roam.x0, roam.x1), randRange(rng, roam.y0, roam.y1))
    return 'SUCCESS'
  })
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

export function rest(minSec: number, maxSec: number): BtNode<AnimalBlackboard> {
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
      self.restCooldown = REST_COOLDOWN_SEC
      return 'SUCCESS'
    },
    reset() {
      remaining = 0
    },
  }
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
