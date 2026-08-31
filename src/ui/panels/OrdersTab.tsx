import { useMemo, useState } from 'react'
import { GUI } from '@/assets/manifest'
import { eligibleFor, orderLabel, type Order } from '@/domain/orders'
import type { Animal } from '@/domain/animal'
import { useGameStore } from '@/store/gameStore'
import { AnimalItemThumb } from '@/ui/components/ItemThumb'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'

/**
 * NPC 의뢰 게시판.
 *
 * 조건에 맞는 동물을 **넘겨주면** 보상을 받는다. 창고 판매(25G)보다 훨씬 후하지만
 * 동물이 동물원을 떠나므로, 애써 만든 개체를 넘길지 저울질하게 된다.
 * 배송 중인 동물은 아직 손에 없으므로 넘길 수 없다.
 */
export function OrdersTab() {
  const orders = useGameStore((s) => s.orders)
  const animals = useGameStore((s) => s.animals)
  const day = useGameStore((s) => s.clock.day)
  const fulfillOrder = useGameStore((s) => s.fulfillOrder)

  const [pickingFor, setPickingFor] = useState<string | null>(null)

  if (orders.length === 0) {
    return (
      <div className="stack">
        <BitmapLabel text="NO ORDERS RIGHT NOW" size={28} />
        <BitmapLabel text="A NEW ONE ARRIVES EACH DAY" size={20} />
      </div>
    )
  }

  return (
    <div className="orders-list">
      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          animals={animals}
          day={day}
          picking={pickingFor === order.id}
          onPick={() => setPickingFor(pickingFor === order.id ? null : order.id)}
          onDeliver={(animalId) => {
            fulfillOrder(order.id, animalId)
            setPickingFor(null)
          }}
        />
      ))}
    </div>
  )
}

interface OrderRowProps {
  order: Order
  animals: readonly Animal[]
  day: number
  picking: boolean
  onPick: () => void
  onDeliver: (animalId: string) => void
}

function OrderRow({ order, animals, day, picking, onPick, onDeliver }: OrderRowProps) {
  const candidates = useMemo(() => eligibleFor(animals, order), [animals, order])
  const daysLeft = Math.max(0, order.expiresDay - day)

  return (
    <div className="order-row">
      <div className="order-head">
        <BitmapLabel text={`NEED ${orderLabel(order)}`} size={24} />
        <BitmapLabel text={`${order.rewardGold} GOLD`} size={22} />
        <BitmapLabel text={`${order.rewardFame} FAME`} size={22} />
        <BitmapLabel text={`${daysLeft} DAYS LEFT`} size={18} />

        <div className="order-actions">
          {candidates.length === 0 ? (
            <BitmapLabel text="NO MATCH" size={18} />
          ) : (
            <>
              <IconButton
                icon={picking ? GUI.CLOSE : GUI.SUBMIT}
                size={50}
                title={picking ? 'CANCEL' : 'DELIVER'}
                onClick={onPick}
              />
              <BitmapLabel text={`${candidates.length}`} size={18} />
            </>
          )}
        </div>
      </div>

      {picking && (
        <div className="order-candidates">
          {candidates.map((animal) => (
            <button
              key={animal.id}
              type="button"
              className="order-candidate"
              onClick={() => onDeliver(animal.id)}
            >
              <AnimalItemThumb animal={animal} size={56} />
              <BitmapLabel text={animal.name} size={14} align="center" />
              <BitmapLabel text={animal.status === 'PLACED' ? 'PLACED' : 'STORED'} size={12} align="center" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
