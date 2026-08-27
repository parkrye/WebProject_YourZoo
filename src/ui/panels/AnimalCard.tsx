import { useState } from 'react'
import { GUI } from '@/assets/manifest'
import { ANIMAL_SELL_REFUND } from '@/domain/balance'
import type { Animal } from '@/domain/animal'
import { TRAIT_KEYS, TRAIT_LABELS } from '@/domain/traits'
import { popupInsetFor } from '@/render/NineSlice'
import { AnimalThumb } from '@/ui/components/AnimalThumb'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { FrameCanvas } from '@/ui/components/FrameCanvas'
import { IconButton } from '@/ui/components/IconButton'

const CARD_WIDTH = 400
const CARD_HEIGHT = 660

interface AnimalCardProps {
  animal: Animal
  onClose: () => void
  /** 우리에 배치된 동물을 창고로 되돌린다. */
  onStore?: () => void
  /** 창고에 있는 동물을 판매한다. */
  onSell?: () => void
}

/**
 * 동물 정보 카드. 팝업이 아니라 화면 한쪽에 붙는 인라인 패널이다.
 * 관찰 화면을 가리지 않아야 하므로 backdrop 을 두지 않는다.
 */
export function AnimalCard({ animal, onClose, onStore, onSell }: AnimalCardProps) {
  const [confirmSell, setConfirmSell] = useState(false)
  const inset = popupInsetFor(CARD_WIDTH, CARD_HEIGHT)

  return (
    <div className="animal-card" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
      <FrameCanvas width={CARD_WIDTH} height={CARD_HEIGHT} />
      <div
        className="animal-card-body"
        style={{
          paddingTop: inset.top,
          paddingRight: inset.right,
          paddingBottom: inset.bottom,
          paddingLeft: inset.left,
        }}
      >
        <header className="popup-header">
          <BitmapLabel text={animal.name} size={28} />
          <IconButton icon={GUI.CLOSE} size={44} title="CLOSE" onClick={onClose} />
        </header>

        <div className="animal-card-portrait">
          <AnimalThumb imageId={animal.imageId} size={132} />
        </div>

        <BitmapLabel text={`${animal.traits.habitat} ${animal.traits.diet}`} size={22} />
        <BitmapLabel text={`APPEAL ${animal.appeal}`} size={22} />

        <div className="animal-card-traits">
          {TRAIT_KEYS.map((key) => (
            <div key={key} className="trait-row">
              <BitmapLabel text={TRAIT_LABELS[key]} size={18} />
              <div className="trait-bar">
                <div className="trait-bar-fill" style={{ width: `${Math.round(animal.traits[key] * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <footer className="animal-card-actions">
          {onStore && (
            <>
              <IconButton icon={GUI.BACK} size={54} title="SEND TO STORAGE" onClick={onStore} />
              <BitmapLabel text="TO STORAGE" size={18} />
            </>
          )}

          {onSell && !confirmSell && (
            <>
              <IconButton icon={GUI.TRASH} size={54} title="SELL" onClick={() => setConfirmSell(true)} />
              <BitmapLabel text={`SELL ${ANIMAL_SELL_REFUND}`} size={18} />
            </>
          )}

          {onSell && confirmSell && (
            <>
              <BitmapLabel text="SURE" size={20} />
              <IconButton icon={GUI.CONFIRM} size={54} title="CONFIRM" onClick={onSell} />
              <IconButton icon={GUI.CLOSE} size={54} title="CANCEL" onClick={() => setConfirmSell(false)} />
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
