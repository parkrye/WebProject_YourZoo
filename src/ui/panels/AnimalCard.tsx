import { useState } from 'react'
import { GUI } from '@/assets/manifest'
import { ANIMAL_NAME_MAX_LENGTH, SHEET_COST } from '@/domain/balance'
import type { Animal } from '@/domain/animal'
import { sellRefund } from '@/domain/shop'
import { countBySentiment, reviewsOf } from '@/domain/review'
import { TRAIT_KEYS, TRAIT_LABELS } from '@/domain/traits'
import { AnimalItemThumb } from '@/ui/components/ItemThumb'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { ConfirmPopup } from '@/ui/components/ConfirmPopup'
import { useGameStore } from '@/store/gameStore'

const CARD_WIDTH = 340
const CARD_HEIGHT = 560

interface AnimalCardProps {
  animal: Animal
  onClose: () => void
  /**
   * 카메라가 이 동물을 따라다니는 전용 뷰로 들어간다.
   * 상세보기에서 배치된 동물을 골랐을 때만 온다 — 창고 안의 동물은 따라갈 데가 없다.
   */
  onFollow?: () => void
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
export function AnimalCard({
  animal, onClose, onFollow, onStore, onSell, readOnly = false,
}: AnimalCardProps) {
  const [confirmSell, setConfirmSell] = useState(false)
  const [confirmAnimate, setConfirmAnimate] = useState(false)
  const [baking, setBaking] = useState(false)
  const cash = useGameStore((s) => s.cash)
  const animateAnimal = useGameStore((s) => s.animateAnimal)
  const renameAnimal = useGameStore((s) => s.renameAnimal)
  const reviews = useGameStore((s) => s.reviews)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(animal.name)

  const commitName = (): void => {
    renameAnimal(animal.id, draftName)
    setRenaming(false)
  }

  // 이 동물이 들은 말. 목록은 최근 것이 앞이라 첫 줄이 곧 마지막 한마디다.
  const mine = reviewsOf(reviews, animal.id)
  const { good, bad } = countBySentiment(mine)
  const latest = mine[0]

  const animated = animal.spriteSheet !== null
  const canAnimate = !readOnly && !animated && cash >= SHEET_COST

  return (
    <>
      <div className="popup animal-card" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
      <header className="popup-header">
        {/* 이름은 머리글 자리에서 바로 고친다. 이름 하나 바꾸자고 팝업을 또 띄울 일은 아니다. */}
        {renaming ? (
          <>
            <BitmapInput
              value={draftName}
              maxLength={ANIMAL_NAME_MAX_LENGTH}
              size={22}
              width={190}
              placeholder="NAME"
              onChange={setDraftName}
            />
            <IconButton icon={GUI.CONFIRM} size={40} title="OK" onClick={commitName} />
          </>
        ) : (
          <>
            <BitmapLabel text={animal.name} size={24} />
            <div className="card-header-actions">
              {!readOnly && (
                <IconButton
                  icon={GUI.PENCIL}
                  size={36}
                  title="RENAME"
                  onClick={() => {
                    setDraftName(animal.name)
                    setRenaming(true)
                  }}
                />
              )}
              <IconButton icon={GUI.CLOSE} size={40} title="CLOSE" onClick={onClose} />
            </div>
          </>
        )}
      </header>

      <div className="popup-content animal-card-body">
        <div className="animal-card-portrait">
          {/* 시트로 만든 동물은 IDLE 첫 칸을 보여 준다. 통째로 줄이면 24칸이 뭉개진다. */}
          <AnimalItemThumb animal={animal} size={118} />
        </div>

        <BitmapLabel text={`${animal.traits.habitat} ${animal.traits.diet}`} size={20} />
        <BitmapLabel text={`APPEAL ${animal.appeal}`} size={20} />
        {animated && <BitmapLabel text="ANIMATED" size={18} />}

        {/*
          이 동물이 들은 말. 매력도는 계산으로 나온 숫자이고 이쪽은 실제로 나온 말이라,
          같은 자리에 나란히 두면 숫자가 무엇을 뜻하는지 읽힌다.
        */}
        {mine.length > 0 && (
          <div className="animal-card-voices">
            <span className="review-tally-side is-plus">
              <IconGlyph icon={GUI.HEART} size={20} />
              <BitmapLabel text={`${good}`} size={20} />
            </span>
            <span className="review-tally-side is-minus">
              <IconGlyph icon={GUI.CLOSE} size={20} />
              <BitmapLabel text={`${bad}`} size={20} />
            </span>
          </div>
        )}
        {latest && <BitmapLabel text={latest.text} size={15} align="center" />}

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
              <IconButton icon={GUI.COIN_LARGE} size={40} />
              <BitmapLabel text={`ANIMATE ${SHEET_COST}`} size={17} />
            </button>
          )}

          {/*
            따라가기는 남의 동물원에서도 된다. 구경하러 온 사람이 가장 하고 싶은 일이
            남이 그린 동물을 가까이서 보는 것이다.
          */}
          {onFollow && (
            <button type="button" className="labeled-button" onClick={onFollow}>
              <IconButton icon={GUI.BINOCULARS} size={40} />
              <BitmapLabel text="FOLLOW" size={17} />
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
              <BitmapLabel text={`SELL ${sellRefund(animal)}`} size={17} />
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
