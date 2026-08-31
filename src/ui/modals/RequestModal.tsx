import { Popup } from '@/ui/components/Popup'
import { Tabs, type TabItem } from '@/ui/components/Tabs'
import { useGameStore } from '@/store/gameStore'
import { NewAnimalForm } from '@/ui/panels/NewAnimalForm'
import { NewPropForm } from '@/ui/panels/NewPropForm'
import { OrdersTab } from '@/ui/panels/OrdersTab'
import type { RequestTab } from '@/domain/requestDraft'

const TABS: readonly TabItem<RequestTab>[] = [
  { id: 'NEW', label: 'NEW ANIMAL' },
  { id: 'PROP', label: 'NEW PROP' },
  { id: 'ORDERS', label: 'ORDERS' },
]

const POPUP_WIDTH = 1180
/*
  화면 높이가 900 이라 900 을 주면 팝업이 화면을 위아래로 꽉 채워, 창이 아니라
  또 하나의 화면처럼 보였다. 24칸 그리기 걸음도 820 이면 넉넉하다.
*/
const POPUP_HEIGHT = 820

/**
 * 만드는 곳.
 *
 * 동물과 프롭은 각자 **여러 걸음짜리 마법사**다 — 방식을 먼저 고르고
 * 그다음 한 가지씩 묻는다. 예전처럼 모든 항목을 한 화면에 늘어놓으면
 * 방식이 넷으로 늘어난 지금은 무엇부터 손대야 할지 알 수 없다.
 */
export function RequestModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  // 보던 탭도 작업 내용이다. 자정 정산에 창이 내려가도 돌아올 자리는 남는다.
  const tab = useGameStore((s) => s.draft.tab)
  const setTab = useGameStore((s) => s.setRequestTab)

  return (
    <Popup title="REQUEST FORM" width={POPUP_WIDTH} height={POPUP_HEIGHT} onClose={closeModal}>
      <Tabs items={TABS} active={tab} onChange={setTab} />
      {tab === 'NEW' && <NewAnimalForm onDone={closeModal} />}
      {tab === 'PROP' && <NewPropForm onDone={closeModal} />}
      {tab === 'ORDERS' && <OrdersTab />}
    </Popup>
  )
}
