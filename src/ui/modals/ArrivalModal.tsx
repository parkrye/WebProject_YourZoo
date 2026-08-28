import { GUI } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { AnimalItemThumb, PropItemThumb } from '@/ui/components/ItemThumb'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

/**
 * 오늘 아침 창고에 도착한 것들.
 *
 * 정산 팝업의 `ARRIVED 3` 한 줄로는 **무엇이** 왔는지 알 수 없었다.
 * 이틀 전에 그린 동물과 어제 산 프롭이 같은 날 도착하면 더 그렇다.
 * 그림과 이름을 함께 보여 주고, 이 팝업이 닫혀야 화면이 다시 밝아진다.
 */
export function ArrivalModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const arrivals = useGameStore((s) => s.arrivals)
  if (!arrivals) return null

  const total = arrivals.animals.length + arrivals.props.length

  return (
    <Popup title="DELIVERY ARRIVED" width={780} height={560} onClose={closeModal}>
      <div className="arrival">
        <div className="arrival-head">
          <IconGlyph icon={GUI.BOOK} size={34} />
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
          <IconButton icon={GUI.CONFIRM} size={64} title="OK" onClick={closeModal} />
        </div>
      </div>
    </Popup>
  )
}
