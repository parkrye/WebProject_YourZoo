import type { BtNode, Status } from './types'

/**
 * 순차 실행. 하나라도 실패하면 실패.
 *
 * **기억을 유지한다** — RUNNING 인 자식이 있으면 다음 tick 은 거기서 이어간다.
 * 조건 노드를 앞에 두고 행동 노드를 뒤에 두는 패턴에서, 행동이 진행 중인데
 * 조건을 매 tick 다시 평가하는 건 낭비이고 깜빡임을 만든다.
 */
export function sequence<B>(...children: readonly BtNode<B>[]): BtNode<B> {
  let index = 0

  const resetFrom = (from: number): void => {
    for (let i = from; i < children.length; i++) children[i]?.reset?.()
  }

  return {
    tick(blackboard) {
      while (index < children.length) {
        const child = children[index]
        if (!child) break

        const status = child.tick(blackboard)
        if (status === 'RUNNING') return 'RUNNING'
        if (status === 'FAILURE') {
          resetFrom(0)
          index = 0
          return 'FAILURE'
        }
        index++
      }
      resetFrom(0)
      index = 0
      return 'SUCCESS'
    },
    reset() {
      resetFrom(0)
      index = 0
    },
  }
}

/**
 * 우선순위 선택. 앞에서부터 훑어 처음 성공하거나 진행 중인 자식을 택한다.
 *
 * **기억을 유지하지 않는다** — 매 tick 0번부터 다시 평가한다.
 * 그래야 "쉬는 중이었어도 손님이 다가오면 즉시 도망친다" 같은 선점이 동작한다.
 * 대신 이번에 선택된 자식보다 뒤에 있는 가지는 reset 해서 중간 상태를 버린다.
 */
export function selector<B>(...children: readonly BtNode<B>[]): BtNode<B> {
  let lastRunning = -1

  const resetAfter = (from: number): void => {
    for (let i = from; i < children.length; i++) children[i]?.reset?.()
  }

  return {
    tick(blackboard) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (!child) continue

        const status = child.tick(blackboard)
        if (status === 'FAILURE') continue

        // 더 높은 우선순위가 끼어들었다면 아래 가지들의 진행 상태를 버린다.
        if (lastRunning >= 0 && lastRunning !== i) resetAfter(i + 1)
        lastRunning = status === 'RUNNING' ? i : -1
        return status
      }
      lastRunning = -1
      return 'FAILURE'
    },
    reset() {
      resetAfter(0)
      lastRunning = -1
    },
  }
}

export function condition<B>(predicate: (blackboard: B) => boolean): BtNode<B> {
  return {
    tick: (blackboard) => (predicate(blackboard) ? 'SUCCESS' : 'FAILURE'),
  }
}

export function action<B>(fn: (blackboard: B) => Status): BtNode<B> {
  return { tick: fn }
}
