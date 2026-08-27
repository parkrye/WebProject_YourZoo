import { useState } from 'react'
import { GUI } from '@/assets/manifest'
import { ANIMAL_SELL_REFUND } from '@/domain/balance'
import type { Animal } from '@/domain/animal'
import { TRAIT_KEYS, TRAIT_LABELS } from '@/domain/traits'
import { AnimalThumb } from '@/ui/components/AnimalThumb'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'

const CARD_WIDTH = 340
const CARD_HEIGHT = 520

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

  return (
    <div className="popup animal-card" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
      <header className="popup-header">
        <BitmapLabel text={animal.name} size={24} />
        <IconButton icon={GUI.CLOSE} size={40} title="CLOSE" onClick={onClose} />
      </header>

      <div className="popup-content animal-card-body">
        <div className="animal-card-portrait">
          <AnimalThumb imageId={animal.imageId} size={118} />
        </div>

        <BitmapLabel text={`${animal.traits.habitat} ${animal.traits.diet}`} size={20} />
        <BitmapLabel text={`APPEAL ${animal.appeal}`} size={20} />

        <div className="animal-card-traits">
          {TRAIT_KEYS.map((key) => (
            <div key={key} className="trait-row">
              <BitmapLabel text={TRAIT_LABELS[key]} size={16} />
              <div className="trait-bar">
                <div className="trait-bar-fill" style={{ width: `${Math.round(animal.traits[key] * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <footer className="animal-card-actions">
          {onStore && (
            <button type="button" className="labeled-button" onClick={onStore}>
              <IconButton icon={GUI.BACK} size={40} />
              <BitmapLabel text="STORE" size={17} />
            </button>
          )}

          {onSell && !confirmSell && (
            <button type="button" className="labeled-button" onClick={() => setConfirmSell(true)}>
              <IconButton icon={GUI.TRASH} size={40} />
              <BitmapLabel text={`SELL ${ANIMAL_SELL_REFUND}`} size={17} />
            </button>
          )}

          {onSell && confirmSell && (
            <>
              <BitmapLabel text="SURE" size={18} />
              <IconButton icon={GUI.CONFIRM} size={44} title="CONFIRM" onClick={onSell} />
              <IconButton icon={GUI.CLOSE} size={44} title="CANCEL" onClick={() => setConfirmSell(false)} />
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
