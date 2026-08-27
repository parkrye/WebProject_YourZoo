export type Status = 'RUNNING' | 'SUCCESS' | 'FAILURE'

export interface BtNode<B> {
  tick(blackboard: B): Status
  /** 상위 노드가 우선순위를 바꿔 이 가지를 버릴 때 호출된다. */
  reset?(): void
}
