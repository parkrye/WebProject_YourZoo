import { useEffect, useMemo, useState } from 'react'
import { GUI, type Habitat } from '@/assets/manifest'
import { PROP_CREATE_COST, PROP_NAME_MAX_LENGTH, SHIPPING_DAYS } from '@/domain/balance'
import { createPropId, type OwnedProp } from '@/domain/prop'
import { PROP_TEMPLATES, PROP_TEMPLATE_ORDER, type PropTemplateId } from '@/domain/propTemplates'
import type { ExportedDrawing } from '@/draw/export'
import { registerFromBlob } from '@/sim/imageCache'
import { putImage } from '@/store/imageDb'
import { useGameStore } from '@/store/gameStore'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { DrawModal } from '@/ui/modals/DrawModal'

/** 거동과 그 설명. 프롭은 스스로 움직이지 않고 이 셋 중 하나로만 반응한다. */
const MOTIONS: readonly { id: Habitat; label: string; hint: string }[] = [
  { id: 'LAND', label: 'STILL', hint: 'STAYS PUT' },
  { id: 'WATER', label: 'FLOAT', hint: 'BOBS UP AND DOWN' },
  { id: 'SKY', label: 'SWAY', hint: 'SWINGS SIDE TO SIDE' },
]

interface NewPropFormProps {
  onDone: () => void
}

/**
 * 프롭 제작 탭.
 *
 * 동물 요청서에서 습성을 걷어낸 형태다 — 프롭은 스스로 움직이지 않으니
 * 정할 게 이름과 밑그림, 그리고 **어떻게 흔들릴지** 셋뿐이다.
 *
 * 거동은 놓을 자리를 제한하지 않는다. 물 위에 나무를, 하늘에 등을 매달 수 있다.
 */
export function NewPropForm({ onDone }: NewPropFormProps) {
  const orderProp = useGameStore((s) => s.orderProp)
  const gold = useGameStore((s) => s.gold)
  const day = useGameStore((s) => s.clock.day)

  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState<PropTemplateId>('FREE')
  const [layer, setLayer] = useState<Habitat>('LAND')
  const [drawing, setDrawing] = useState<ExportedDrawing | null>(null)
  const [drawOpen, setDrawOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // Blob 은 <img> 에 바로 못 넣는다. 객체 URL 로 감싸고 바뀌면 이전 것을 놓아 준다.
  const previewUrl = useMemo(() => (drawing ? URL.createObjectURL(drawing.blob) : null), [drawing])
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const affordable = gold >= PROP_CREATE_COST
  const ready = name.trim().length > 0 && drawing !== null && affordable && !busy

  /** 템플릿을 고르면 어울리는 거동도 함께 맞춘다. 뗏목을 땅에 고정해 두는 실수를 줄인다. */
  const selectTemplate = (id: PropTemplateId): void => {
    setTemplateId(id)
    setLayer(PROP_TEMPLATES[id].layer)
  }

  const submit = async (): Promise<void> => {
    if (!ready || !drawing) return
    setBusy(true)

    const imageId = createPropId()
    // 방금 그린 그림이라 Blob 이 손에 있다. 미리 디코드해 두면 배치 즉시 렌더된다.
    await registerFromBlob(imageId, drawing.blob)
    try {
      await putImage(imageId, drawing.blob)
    } catch {
      // IndexedDB 를 못 쓰는 환경에서도 이번 세션은 이어가게 둔다.
    }

    const prop: OwnedProp = {
      id: createPropId(),
      name: name.trim(),
      status: 'SHIPPING',
      enclosureId: null,
      sheetBiome: null,
      sprite: null,
      imageId,
      layer,
      x: 0,
      y: 0,
      orderedDay: day,
      // 그린 것은 상점 물건보다 하루 더 걸린다.
      arrivalDay: day + SHIPPING_DAYS.DRAWN,
    }

    setBusy(false)
    if (orderProp(prop)) onDone()
  }

  return (
    <div className="request-body">
      <div className="request-layout">
        <section className="request-col">
          <FieldLabel text="NAME" />
          <BitmapInput
            value={name}
            onChange={setName}
            maxLength={PROP_NAME_MAX_LENGTH}
            placeholder="ENTER NAME"
            width={330}
          />

          <FieldLabel text="DRAWING" />
          <div className="drawing-slot" onClick={() => setDrawOpen(true)}>
            {previewUrl ? (
              <img src={previewUrl} alt="prop" className="drawing-preview" />
            ) : (
              <BitmapLabel text="TAP TO DRAW" size={22} align="center" />
            )}
          </div>
          <button type="button" className="labeled-button" onClick={() => setDrawOpen(true)}>
            <IconGlyph icon={GUI.PENCIL} size={44} />
            <BitmapLabel text={drawing ? 'REDRAW' : 'DRAW'} size={22} />
          </button>

          <FieldLabel text={`ARRIVES IN ${SHIPPING_DAYS.DRAWN} DAYS`} />
        </section>

        <section className="request-col request-col-wide">
          <FieldLabel text="TEMPLATE" />
          <div className="chip-grid">
            {PROP_TEMPLATE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={templateId === id ? 'chip is-active' : 'chip'}
                onClick={() => selectTemplate(id)}
              >
                <BitmapLabel text={PROP_TEMPLATES[id].label} size={18} />
              </button>
            ))}
          </div>

          <FieldLabel text="MOTION" />
          <div className="motion-row">
            {MOTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={layer === m.id ? 'motion-card is-active' : 'motion-card'}
                onClick={() => setLayer(m.id)}
              >
                <BitmapLabel text={m.label} size={22} align="center" />
                <BitmapLabel text={m.hint} size={13} align="center" />
              </button>
            ))}
          </div>

          <FieldLabel text="PLACE ANYWHERE" />
          <BitmapLabel text="MOTION DOES NOT LIMIT WHERE IT GOES" size={15} />
        </section>
      </div>

      <footer className="request-footer">
        <div className="shop-price">
          <IconGlyph icon={GUI.COIN} size={28} />
          <BitmapLabel text={`${PROP_CREATE_COST}`} size={26} />
        </div>
        {!affordable && <BitmapLabel text="NOT ENOUGH COINS" size={18} />}
        <IconButton
          icon={GUI.SUBMIT}
          size={72}
          title="SUBMIT"
          disabled={!ready}
          onClick={() => void submit()}
        />
      </footer>

      {drawOpen && (
        <DrawModal
          title="DRAW PROP"
          guide={PROP_TEMPLATES[templateId].guide}
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

function FieldLabel({ text }: { text: string }) {
  return (
    <div className="field-label">
      <BitmapLabel text={text} size={22} />
    </div>
  )
}
