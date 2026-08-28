import { useState } from 'react'
import { Popup } from '@/ui/components/Popup'
import { Tabs, type TabItem } from '@/ui/components/Tabs'
import { useGameStore } from '@/store/gameStore'
import { NewAnimalForm } from '@/ui/panels/NewAnimalForm'
import { NewPropForm } from '@/ui/panels/NewPropForm'
import { OrdersTab } from '@/ui/panels/OrdersTab'

type RequestTab = 'NEW' | 'PROP' | 'ORDERS'

const TABS: readonly TabItem<RequestTab>[] = [
  { id: 'NEW', label: 'NEW ANIMAL' },
  { id: 'PROP', label: 'NEW PROP' },
  { id: 'ORDERS', label: 'ORDERS' },
]

const POPUP_WIDTH = 1180
const POPUP_HEIGHT = 900

/**
 * 만드는 곳.
 *
 * 동물과 프롭은 각자 **여러 걸음짜리 마법사**다 — 방식을 먼저 고르고
 * 그다음 한 가지씩 묻는다. 예전처럼 모든 항목을 한 화면에 늘어놓으면
 * 방식이 넷으로 늘어난 지금은 무엇부터 손대야 할지 알 수 없다.
 */
export function RequestModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const [tab, setTab] = useState<RequestTab>('NEW')

  return (
    <Popup title="REQUEST FORM" width={POPUP_WIDTH} height={POPUP_HEIGHT} onClose={closeModal}>
      <Tabs items={TABS} active={tab} onChange={setTab} />
      {tab === 'NEW' && <NewAnimalForm onDone={closeModal} />}
      {tab === 'PROP' && <NewPropForm onDone={closeModal} />}
      {tab === 'ORDERS' && <OrdersTab />}
    </Popup>
  )
}
