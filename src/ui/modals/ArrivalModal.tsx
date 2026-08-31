import { useEffect, useState } from 'react'
import { GUI } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { AnimalItemThumb, PropItemThumb } from '@/ui/components/ItemThumb'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

/** 저절로 닫히기까지의 시간(초). 읽을 것은 그림 몇 장뿐이라 길 이유가 없다. */
const AUTO_CLOSE_SEC = 6

/**
 * 오늘 아침 창고에 도착한 것들.
 *
 * 정산 팝업의 `ARRIVED 3` 한 줄로는 **무엇이** 왔는지 알 수 없었다.
 * 이틀 전에 그린 동물과 어제 산 프롭이 같은 날 도착하면 더 그렇다.
 *
 * 이 팝업은 화면이 완전히 밝아진 뒤에 뜨고 **시간도 함께 흐른다.**
 * 그래서 닫는 것을 사람 손에만 맡기지 않는다 — 세어 두고 저절로 닫힌다.
 * 알림 하나 때문에 하루를 붙들고 있을 이유가 없기 때문이다.
 */
export function ArrivalModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const arrivals = useGameStore((s) => s.arrivals)
  const [left, setLeft] = useState(AUTO_CLOSE_SEC)

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((n) => n - 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (left > 0) return
    closeModal()
  }, [left, closeModal])

  if (!arrivals) return null

  const total = arrivals.animals.length + arrivals.props.length

  return (
    <Popup title="DELIVERY ARRIVED" width={780} height={560} onClose={closeModal}>
      <div className="arrival">
        <div className="arrival-head">
          <IconGlyph icon={GUI.CRATE} size={34} />
          <BitmapLabel text={`${total} IN STORAGE`} size={26} />
        </div>

        <div className="arrival-grid">
          {arrivals.animals.map((animal) => (
            <div key={animal.id} className="arrival-card">
              <AnimalItemThumb animal={animal} size={84} />
              <BitmapLabel text={animal.name} size={18} align="center" />
              <BitmapLabel text={animal.traits.habitat} size={13} align="center" />
            </div>
          ))}
          {arrivals.props.map((prop) => (
            <div key={prop.id} className="arrival-card">
              <PropItemThumb prop={prop} size={84} />
              <BitmapLabel text={prop.name} size={18} align="center" />
              <BitmapLabel text="PROP" size={13} align="center" />
            </div>
          ))}
        </div>

        <div className="arrival-actions">
          <BitmapLabel text="PLACE THEM FROM STORAGE" size={17} />
          {/* 몇 초 뒤에 닫히는지 적어 둔다. 말없이 사라지면 무엇이 왔는지 놓친다. */}
          <BitmapLabel text={`CLOSING IN ${Math.max(0, left)}`} size={15} />
          <IconButton icon={GUI.CONFIRM} size={64} title="OK" onClick={closeModal} />
        </div>
      </div>
    </Popup>
  )
}
