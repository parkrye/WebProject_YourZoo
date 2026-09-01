import { selector, sequence, type BtNode } from './bt'
import {
  drink, isThreatened, mimicsLeader, moveToTarget, needsRest, pickFleeTarget, pickWanderTarget,
  rest, signature, targetLeader, targetNearestPeer, targetNearestProp, targetWaterEdge,
  wantsDrink, wantsFollow, wantsInspect, wantsSocial,
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
 * 종에서 오는 차이는 하나 더 있다. 같은 종이 여럿이면 그중 하나가 리더가 되고
 * 나머지는 그를 따라다니거나 동작을 따라 한다 — 그건 기분이 아니라 습성이라
 * traits 와 무관하게 늘 조금은 작동한다.
 *
 * @see docs/02-architecture.md §3.2
 */
export function buildAnimalTree(_traits: AnimalTraits): BtNode<AnimalBlackboard> {
  return selector<AnimalBlackboard>(
    // 1순위: 위협 회피. 무엇을 하던 중이든 선점한다.
    sequence(isThreatened(), pickFleeTarget(), moveToTarget()),

    // 2순위: 휴식
    sequence(needsRest(), rest(2, 6)),

    /*
      3순위: 물가로.
      배회보다 위에 둔다 — 아래에 두면 배회가 늘 먼저 성공해 차례가 오지 않는다.
      쉬는 것보다는 아래다. 지쳐 있는데 물부터 찾아 나서지는 않는다.
    */
    sequence(wantsDrink(), targetWaterEdge(), moveToTarget(), drink(2, 5)),

    // 4순위: 평상시 행동
    selector(
      // 리더를 따라 하는 쪽이 스스로 부리는 재롱보다 먼저다. 그래야 무리가 함께 움직인다.
      sequence(mimicsLeader(), signature(SIGNATURE_DURATION)),
      sequence(condition<AnimalBlackboard>(({ rng }) => rng() < SIGNATURE_CHANCE), signature(SIGNATURE_DURATION)),
      sequence(wantsFollow(), targetLeader(), moveToTarget()),
      sequence(wantsSocial(), targetNearestPeer(), moveToTarget()),
      sequence(wantsInspect(), targetNearestProp(), moveToTarget()),
      sequence(pickWanderTarget(), moveToTarget()),
    ),
  )
}
