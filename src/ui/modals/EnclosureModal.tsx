import { useState } from 'react'
import { GUI } from '@/assets/manifest'
import {
  ENCLOSURE_EXPAND_STEP, ENCLOSURE_NAME_MAX_LENGTH, MAX_ENCLOSURE_CAPACITY, expandCost,
} from '@/domain/balance'
import { ENCLOSURES, enclosureLabel } from '@/domain/enclosure'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

/**
 * 우리 하나를 손보는 곳.
 *
 * 이름은 공짜다 — 무엇을 키우는 우리인지는 주인이 정하는 것이고,
 * 거기에 값을 매기면 아무도 이름을 바꾸지 않는다.
 * 정원은 골드를 받는다. 늘릴수록 비싸진다.
 */
export function EnclosureModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const id = useGameStore((s) => s.currentEnclosure)
  const names = useGameStore((s) => s.enclosureNames)
  const capacity = useGameStore((s) => s.capacity[id])
  const gold = useGameStore((s) => s.gold)
  const animals = useGameStore((s) => s.animals)
  const renameEnclosure = useGameStore((s) => s.renameEnclosure)
  const expandEnclosure = useGameStore((s) => s.expandEnclosure)

  const [name, setName] = useState(names[id] ?? '')

  const here = animals.filter((a) => a.status === 'PLACED' && a.enclosureId === id).length
  const full = capacity >= MAX_ENCLOSURE_CAPACITY
  const cost = expandCost(capacity)
  const affordable = gold >= cost

  return (
    <Popup title="ENCLOSURE" width={760} height={470} onClose={closeModal}>
      <div className="stack">
        <div className="enclosure-head">
          <BitmapLabel text={enclosureLabel(id, names)} size={34} />
          {/* 기본 이름을 함께 적어 둔다. 이름을 바꾸고 나면 어느 우리인지 헷갈린다. */}
          <BitmapLabel text={ENCLOSURES[id].label} size={15} />
        </div>

        <div className="enclosure-row">
          <BitmapLabel text="NAME" size={22} />
          <BitmapInput
            value={name}
            maxLength={ENCLOSURE_NAME_MAX_LENGTH}
            placeholder={ENCLOSURES[id].label}
            width={340}
            onChange={setName}
          />
          <IconButton
            icon={GUI.CONFIRM}
            size={52}
            title="RENAME"
            onClick={() => renameEnclosure(id, name)}
          />
        </div>
        <BitmapLabel text="EMPTY NAME GOES BACK TO THE DEFAULT" size={14} />

        <div className="enclosure-row">
          <BitmapLabel text="ROOM" size={22} />
          <span className="hud-purse">
            <IconGlyph icon={GUI.PAW} size={28} />
            <BitmapLabel text={`${here} / ${capacity}`} size={26} />
          </span>
          {full ? (
            <BitmapLabel text="AT THE LIMIT" size={18} />
          ) : (
            <button
              type="button"
              className="labeled-button"
              disabled={!affordable}
              onClick={() => expandEnclosure(id)}
            >
              <IconGlyph icon={GUI.COIN} size={30} />
              <BitmapLabel text={`${cost}`} size={22} />
              <BitmapLabel text={`PLUS ${ENCLOSURE_EXPAND_STEP}`} size={16} />
            </button>
          )}
        </div>
        {!full && !affordable && <BitmapLabel text="NOT ENOUGH GOLD" size={16} />}
      </div>
    </Popup>
  )
}
