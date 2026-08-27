import { useState } from 'react'
import { GUI } from '@/assets/manifest'
import { ANIMAL_SELL_REFUND, SHEET_COST } from '@/domain/balance'
import type { Animal } from '@/domain/animal'
import { TRAIT_KEYS, TRAIT_LABELS } from '@/domain/traits'
import { AnimalThumb } from '@/ui/components/AnimalThumb'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { ConfirmPopup } from '@/ui/components/ConfirmPopup'
import { useGameStore } from '@/store/gameStore'

const CARD_WIDTH = 340
const CARD_HEIGHT = 560

interface AnimalCardProps {
  animal: Animal
  onClose: () => void
  /** 우리에 배치된 동물을 창고로 되돌린다. */
  onStore?: () => void
  /** 창고에 있는 동물을 판매한다. */
  onSell?: () => void
  /** 남의 동물원을 구경하는 중이면 정보만 보여 준다. */
  readOnly?: boolean
}

/**
 * 동물 정보 카드. 팝업이 아니라 화면 한쪽에 붙는 인라인 패널이다.
 * 관찰 화면을 가리지 않아야 하므로 backdrop 을 두지 않는다.
 */
export function AnimalCard({ animal, onClose, onStore, onSell, readOnly = false }: AnimalCardProps) {
  const [confirmSell, setConfirmSell] = useState(false)
  const [confirmAnimate, setConfirmAnimate] = useState(false)
  const [baking, setBaking] = useState(false)
  const cash = useGameStore((s) => s.cash)
  const animateAnimal = useGameStore((s) => s.animateAnimal)

  const animated = animal.spriteSheet !== null
  const canAnimate = !readOnly && !animated && cash >= SHEET_COST

  return (
    <>
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
        {animated && <BitmapLabel text="ANIMATED" size={18} />}

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
          {/* 굽는 중에는 버튼을 지우고 상태만 남긴다. 두 번 누르면 캐시가 두 번 나간다. */}
          {baking && <BitmapLabel text="MAKING FRAMES" size={17} />}

          {!baking && canAnimate && (
            <button type="button" className="labeled-button" onClick={() => setConfirmAnimate(true)}>
              <IconButton icon={GUI.PALETTE} size={40} />
              <BitmapLabel text={`ANIMATE ${SHEET_COST}`} size={17} />
            </button>
          )}

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

      {confirmAnimate && (
        <ConfirmPopup
          title="ANIMATE"
          lines={[`SPEND ${SHEET_COST} CASH TO MAKE`, `${animal.name} FULLY ANIMATED ?`]}
          onCancel={() => setConfirmAnimate(false)}
          onConfirm={() => {
            setConfirmAnimate(false)
            setBaking(true)
            void animateAnimal(animal.id).finally(() => setBaking(false))
          }}
        />
      )}
    </>
  )
}
