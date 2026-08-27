import { selector, sequence, type BtNode } from './bt'
import {
  isThreatened, moveToTarget, needsRest, pickFleeTarget, pickWanderTarget,
  rest, signature, targetNearestPeer, targetNearestProp, wantsInspect, wantsSocial,
} from './actions'
import type { AnimalBlackboard } from './types'
import { condition } from './bt'
import type { AnimalTraits } from '@/domain/traits'

const SIGNATURE_CHANCE = 0.004
const SIGNATURE_DURATION = 1.2

/**
 * 습성(traits)에 맞춘 행동 트리를 조립한다.
 *
 * 트리 구조 자체는 모든 동물이 같고, **차이는 조건 노드가 읽는 traits 값에서 나온다.**
 * 겁이 많으면 더 먼 거리에서 도망치고, 활동성이 낮으면 더 자주 쉬고,
 * 사교성이 높으면 더 자주 무리를 짓는다.
 *
 * @see docs/02-architecture.md §3.2
 */
export function buildAnimalTree(_traits: AnimalTraits): BtNode<AnimalBlackboard> {
  return selector<AnimalBlackboard>(
    // 1순위: 위협 회피. 무엇을 하던 중이든 선점한다.
    sequence(isThreatened(), pickFleeTarget(), moveToTarget()),

    // 2순위: 휴식
    sequence(needsRest(), rest(2, 6)),

    // 3순위: 평상시 행동
    selector(
      sequence(condition<AnimalBlackboard>(({ rng }) => rng() < SIGNATURE_CHANCE), signature(SIGNATURE_DURATION)),
      sequence(wantsSocial(), targetNearestPeer(), moveToTarget()),
      sequence(wantsInspect(), targetNearestProp(), moveToTarget()),
      sequence(pickWanderTarget(), moveToTarget()),
    ),
  )
}
