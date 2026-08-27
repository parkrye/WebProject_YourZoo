import { useMemo, useState } from 'react'
import { GUI } from '@/assets/manifest'
import { createRng } from '@/core/rng'
import { computeAppeal, countHabitat, createAnimalId, type Animal } from '@/domain/animal'
import { ANIMAL_CREATE_COST, ANIMAL_NAME_MAX_LENGTH, SHIPPING_DAYS } from '@/domain/balance'
import {
  ANIMAL_TYPE_ORDER, DIETS, HABITATS, TRAIT_KEYS, TRAIT_LABELS,
  randomTraits, traitsFromType, withTrait,
  type AnimalTraits, type AnimalTypeId,
} from '@/domain/traits'
import type { ExportedDrawing } from '@/draw/export'
import { registerFromBlob } from '@/sim/imageCache'
import { putImage } from '@/store/imageDb'
import { useGameStore } from '@/store/gameStore'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { Popup } from '@/ui/components/Popup'
import { Slider } from '@/ui/components/Slider'
import { Tabs, type TabItem } from '@/ui/components/Tabs'
import { OrdersTab } from '@/ui/panels/OrdersTab'
import { DrawModal } from './DrawModal'

type RequestTab = 'NEW' | 'ORDERS'
type TraitMode = 'TYPE' | 'CUSTOM' | 'RANDOM'

const TABS: readonly TabItem<RequestTab>[] = [
  { id: 'NEW', label: 'NEW ANIMAL' },
  { id: 'ORDERS', label: 'ORDERS' },
]

const TRAIT_MODES: readonly TraitMode[] = ['TYPE', 'CUSTOM', 'RANDOM']

const POPUP_WIDTH = 1180
const POPUP_HEIGHT = 800

export function RequestModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const [tab, setTab] = useState<RequestTab>('NEW')

  return (
    <Popup title="REQUEST FORM" width={POPUP_WIDTH} height={POPUP_HEIGHT} onClose={closeModal}>
      <Tabs items={TABS} active={tab} onChange={setTab} />
      {tab === 'NEW' ? <NewAnimalForm onDone={closeModal} /> : <OrdersTab />}
    </Popup>
  )
}

interface NewAnimalFormProps {
  onDone: () => void
}

function NewAnimalForm({ onDone }: NewAnimalFormProps) {
  const enclosureId = useGameStore((s) => s.currentEnclosure)
  const animals = useGameStore((s) => s.animals)
  const day = useGameStore((s) => s.clock.day)
  const orderAnimal = useGameStore((s) => s.orderAnimal)
  const canOrder = useGameStore((s) => s.canOrderAnimal)

  const [name, setName] = useState('')
  const [drawing, setDrawing] = useState<ExportedDrawing | null>(null)
  const [drawOpen, setDrawOpen] = useState(false)
  const [mode, setMode] = useState<TraitMode>('TYPE')
  const [typeId, setTypeId] = useState<AnimalTypeId>('BEAST')
  const [custom, setCustom] = useState<AnimalTraits>(() => traitsFromType('BEAST'))
  const [rollSeed, setRollSeed] = useState(1)
  const [rolled, setRolled] = useState<AnimalTraits>(() => randomTraits(createRng(1)))
  const [busy, setBusy] = useState(false)

  const traits: AnimalTraits =
    mode === 'TYPE' ? traitsFromType(typeId) : mode === 'CUSTOM' ? custom : rolled

  const previewUrl = useMemo(() => (drawing ? URL.createObjectURL(drawing.blob) : null), [drawing])

  const appeal = computeAppeal({
    traits,
    colorCount: drawing?.colorCount ?? 0,
    sameHabitatCount: countHabitat(animals, enclosureId, traits.habitat),
  })

  const affordable = canOrder()
  const ready = name.trim().length > 0 && drawing !== null && affordable && !busy

  const submit = async (): Promise<void> => {
    if (!ready || !drawing) return
    setBusy(true)

    const imageId = createAnimalId()
    // 방금 그린 그림이라 Blob 이 손에 있다. 미리 디코드해 두면 배치 즉시 렌더된다.
    await registerFromBlob(imageId, drawing.blob)

    try {
      await putImage(imageId, drawing.blob)
    } catch {
      // IndexedDB 를 못 쓰는 환경(프라이빗 모드 등)에서도 이번 세션은 이어가게 둔다.
      // 저장 실패는 세이브 단계에서 다시 드러난다. (docs/02-architecture.md R6)
    }

    const animal: Animal = {
      id: createAnimalId(),
      name: name.trim(),
      // 제출한 동물은 바로 우리에 들어가지 않는다. 배송 → 창고 → 배치 순이다.
      status: 'SHIPPING',
      enclosureId: null,
      imageId,
      traits,
      spriteSheet: null,
      orderedDay: day,
      arrivalDay: day + SHIPPING_DAYS,
      appeal,
    }

    setBusy(false)
    if (orderAnimal(animal)) onDone()
  }

  const reroll = (): void => {
    const seed = rollSeed + 1
    setRollSeed(seed)
    setRolled(randomTraits(createRng(Math.imul(seed, 2654435761))))
  }

  return (
    <div className="request-body">
      <div className="request-layout">
      <section className="request-col">
        <FieldLabel text="NAME" />
        <BitmapInput
          value={name}
          onChange={setName}
          maxLength={ANIMAL_NAME_MAX_LENGTH}
          placeholder="ENTER NAME"
          width={330}
        />

        <FieldLabel text="DRAWING" />
        <div className="drawing-slot">
          {previewUrl ? (
            <img src={previewUrl} alt="animal" className="drawing-preview" />
          ) : (
            <BitmapLabel text="NO DRAWING" size={22} align="center" />
          )}
        </div>
        <div className="row">
          <IconButton icon={GUI.PENCIL} size={58} title="DRAW" onClick={() => setDrawOpen(true)} />
          <BitmapLabel text={drawing ? 'REDRAW' : 'DRAW'} size={22} />
        </div>

        <FieldLabel text={`ARRIVES IN ${SHIPPING_DAYS} DAY`} />
        <BitmapLabel text="THEN PLACE IT FROM STORAGE" size={18} />
      </section>

      <section className="request-col request-col-wide">
        <FieldLabel text="TRAITS" />
        <div className="row">
          {TRAIT_MODES.map((m) => (
            <ChipButton key={m} label={m} active={mode === m} onClick={() => setMode(m)} />
          ))}
        </div>

        {mode === 'TYPE' && (
          <div className="chip-grid">
            {ANIMAL_TYPE_ORDER.map((id) => (
              <ChipButton key={id} label={id} active={typeId === id} onClick={() => setTypeId(id)} />
            ))}
          </div>
        )}

        {mode === 'CUSTOM' && (
          <div className="stack-tight">
            <div className="row">
              {HABITATS.map((h) => (
                <ChipButton
                  key={h}
                  label={h}
                  active={custom.habitat === h}
                  onClick={() => setCustom({ ...custom, habitat: h })}
                />
              ))}
            </div>
            {TRAIT_KEYS.map((key) => (
              <Slider
                key={key}
                label={TRAIT_LABELS[key]}
                value={custom[key]}
                onChange={(v) => setCustom(withTrait(custom, key, v))}
              />
            ))}
            <div className="row">
              {DIETS.map((d) => (
                <ChipButton
                  key={d}
                  label={d}
                  active={custom.diet === d}
                  onClick={() => setCustom({ ...custom, diet: d })}
                />
              ))}
            </div>
          </div>
        )}

        {mode === 'RANDOM' && (
          <div className="row">
            <IconButton icon={GUI.REDO} size={54} title="REROLL" onClick={reroll} />
            <BitmapLabel text="REROLL" size={22} />
          </div>
        )}

        {/* CUSTOM 모드에선 슬라이더가 같은 정보를 이미 보여준다. */}
        {mode !== 'CUSTOM' && <TraitSummary traits={traits} />}
      </section>
      </div>

      <footer className="request-footer">
        <BitmapLabel text={`COST ${ANIMAL_CREATE_COST}`} size={26} />
        <BitmapLabel text={`APPEAL ${appeal}`} size={26} />
        {!affordable && <BitmapLabel text="NOT ENOUGH GOLD" size={22} />}
        <div className="request-actions">
          <IconButton
            icon={GUI.SUBMIT}
            size={68}
            title="SUBMIT"
            disabled={!ready}
            onClick={() => void submit()}
          />
          <IconButton icon={GUI.CLOSE} size={68} title="CANCEL" onClick={onDone} />
        </div>
      </footer>

      {drawOpen && (
        <DrawModal
          onClose={() => setDrawOpen(false)}
          onDone={(result) => {
            setDrawing(result)
            setDrawOpen(false)
          }}
        />
      )}
    </div>
  )
}

function TraitSummary({ traits }: { traits: AnimalTraits }) {
  return (
    <div className="trait-summary">
      <BitmapLabel text={`${traits.habitat} ${traits.diet}`} size={24} />
      {TRAIT_KEYS.map((key) => (
        <div key={key} className="trait-row">
          <BitmapLabel text={TRAIT_LABELS[key]} size={20} />
          <div className="trait-bar">
            <div className="trait-bar-fill" style={{ width: `${Math.round(traits[key] * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function FieldLabel({ text }: { text: string }) {
  return (
    <div className="field-label">
      <BitmapLabel text={text} size={22} />
    </div>
  )
}

interface ChipButtonProps {
  label: string
  active: boolean
  onClick: () => void
}

function ChipButton({ label, active, onClick }: ChipButtonProps) {
  return (
    <button type="button" className={active ? 'chip is-active' : 'chip'} onClick={onClick}>
      <BitmapLabel text={label} size={20} />
    </button>
  )
}
