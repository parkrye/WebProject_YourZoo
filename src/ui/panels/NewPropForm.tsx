import { useEffect, useMemo, useState } from 'react'
import { GUI, type Habitat } from '@/assets/manifest'
import { PROP_NAME_MAX_LENGTH, SHIPPING_DAYS } from '@/domain/balance'
import { PROP_CRAFTS, PROP_CRAFT_ORDER, PROP_DETAIL_FRAMES, type PropCraft } from '@/domain/craft'
import { createPropId, type OwnedProp } from '@/domain/prop'
import { PROP_TEMPLATES, PROP_TEMPLATE_ORDER } from '@/domain/propTemplates'
import type { PropStep } from '@/domain/requestDraft'
import { composeStrip } from '@/render/animal/composeSheet'
import { registerFromBlob } from '@/sim/imageCache'
import { putImage } from '@/store/imageDb'
import { useGameStore } from '@/store/gameStore'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { CraftPicker } from '@/ui/panels/CraftPicker'
import { FrameStudio } from '@/ui/panels/FrameStudio'
import { DrawModal } from '@/ui/modals/DrawModal'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { WizardFrame } from '@/ui/panels/WizardFrame'

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
 * 프롭 제작.
 *
 * 방식을 먼저 고르고 그다음 한 가지씩 묻는다. 예전에는 그림·이름·거동을
 * 한 화면에 늘어놓았는데, 여기에 방식과 템플릿까지 더하니 무엇부터 손대야 할지
 * 알 수 없는 화면이 됐다. **한 걸음에 하나씩** 묻는다.
 */
export function NewPropForm({ onDone }: NewPropFormProps) {
  const orderProp = useGameStore((s) => s.orderProp)
  const gold = useGameStore((s) => s.gold)
  const day = useGameStore((s) => s.clock.day)

  // 위저드의 값은 스토어의 초안에 둔다. 이유는 동물 요청서와 같다 —
  // 요청서를 덮는 창 하나에 그리던 것이 사라지면 안 된다.
  const draft = useGameStore((s) => s.draft.prop)
  const patch = useGameStore((s) => s.patchPropDraft)
  const { step, craft, templateId, layer, name, single, frames } = draft

  const [drawOpen, setDrawOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const spec = PROP_CRAFTS[craft]
  const guide = craft === 'TEMPLATE' ? PROP_TEMPLATES[templateId].guide : []
  const detailed = craft === 'DETAILED'

  const drawn = detailed ? frames.some(Boolean) : single !== null
  const affordable = gold >= spec.coins

  const previewUrl = useMemo(() => (single ? URL.createObjectURL(single.blob) : null), [single])
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const goto = (next: PropStep): void => patch({ step: next })

  const startCraft = (id: PropCraft): void => {
    patch({ craft: id, step: id === 'TEMPLATE' ? 'TEMPLATE' : 'DRAW' })
  }

  const submit = async (): Promise<void> => {
    if (!drawn || !affordable || busy) return
    setBusy(true)

    const imageId = createPropId()
    let strip: OwnedProp['strip'] = null
    let blob: Blob

    if (detailed) {
      const made = await composeStrip(frames.map((f) => f?.blob ?? null))
      blob = made.blob
      strip = { frames: made.frames, fps: made.fps }
    } else {
      blob = single!.blob
    }

    await registerFromBlob(imageId, blob)
    try {
      await putImage(imageId, blob)
    } catch {
      // IndexedDB 를 못 쓰는 환경에서도 이번 세션은 이어가게 둔다.
    }

    const prop: OwnedProp = {
      id: createPropId(),
      name: name.trim() || templateId,
      status: 'SHIPPING',
      enclosureId: null,
      sheetBiome: null,
      sprite: null,
      imageId,
      strip,
      layer,
      x: 0,
      y: 0,
      orderedDay: day,
      // 그린 것은 상점 물건보다 하루 더 걸린다.
      arrivalDay: day + SHIPPING_DAYS.DRAWN,
    }

    setBusy(false)
    if (orderProp(prop, spec.coins)) onDone()
  }

  if (step === 'CRAFT') {
    return (
      <CraftPicker
        title="HOW WILL YOU MAKE IT"
        order={PROP_CRAFT_ORDER}
        specs={PROP_CRAFTS}
        gold={gold}
        onPick={(id) => startCraft(id)}
      />
    )
  }

  if (step === 'TEMPLATE') {
    return (
      <WizardFrame
        title="PICK A SHAPE"
        onBack={() => goto('CRAFT')}
        onNext={() => goto('DRAW')}
        nextLabel="DRAW"
      >
        <div className="wizard-grid">
          {PROP_TEMPLATE_ORDER.filter((id) => id !== 'FREE').map((id) => (
            <button
              key={id}
              type="button"
              className={templateId === id ? 'wizard-card is-active' : 'wizard-card'}
              onClick={() => patch({ templateId: id, layer: PROP_TEMPLATES[id].layer })}
            >
              {/*
                아이콘이 없는 템플릿도 자리는 남긴다. 있는 카드만 키가 커지면
                한 줄에 놓인 카드들의 이름이 서로 어긋나 읽기 나빠진다.
              */}
              <span className="wizard-card-icon">
                {PROP_TEMPLATES[id].icon !== undefined && (
                  <IconGlyph icon={PROP_TEMPLATES[id].icon} size={40} />
                )}
              </span>
              <BitmapLabel text={PROP_TEMPLATES[id].label} size={22} align="center" />
              <BitmapLabel text={PROP_TEMPLATES[id].layer} size={13} align="center" />
            </button>
          ))}
        </div>
      </WizardFrame>
    )
  }

  if (step === 'DRAW') {
    return (
      <WizardFrame
        title={detailed ? `DRAW ${PROP_DETAIL_FRAMES} FRAMES` : 'DRAW IT'}
        onBack={() => goto(craft === 'TEMPLATE' ? 'TEMPLATE' : 'CRAFT')}
        onNext={() => goto('DETAILS')}
        nextLabel="NEXT"
        nextReady={drawn}
      >
        {detailed ? (
          <FrameStudio
            rows={[{ label: '', count: PROP_DETAIL_FRAMES }]}
            frames={frames}
            guide={guide}
            onChange={(i, drawing) =>
              patch({ frames: frames.map((f, n) => (n === i ? drawing : f)) })
            }
          />
        ) : (
          <div className="wizard-draw">
            <div className="drawing-slot" onClick={() => setDrawOpen(true)}>
              {previewUrl ? (
                <img src={previewUrl} alt="prop" className="drawing-preview" />
              ) : (
                <BitmapLabel text="TAP TO DRAW" size={22} align="center" />
              )}
            </div>
            <button type="button" className="labeled-button" onClick={() => setDrawOpen(true)}>
              <IconGlyph icon={GUI.PENCIL} size={40} />
              <BitmapLabel text={single ? 'REDRAW' : 'DRAW'} size={20} />
            </button>
          </div>
        )}

        {drawOpen && (
          <DrawModal
            title="DRAW PROP"
            guide={guide}
            {...(single && { initial: single.blob })}
            onClose={() => setDrawOpen(false)}
            onDone={(result) => {
              patch({ single: result })
              setDrawOpen(false)
            }}
          />
        )}
      </WizardFrame>
    )
  }

  return (
    <WizardFrame
      title="NAME AND MOTION"
      onBack={() => goto('DRAW')}
      onSubmit={() => void submit()}
      submitReady={drawn && affordable && !busy}
      cost={spec.coins}
      note={`ARRIVES IN ${SHIPPING_DAYS.DRAWN} DAYS`}
      warning={affordable ? null : 'NOT ENOUGH COINS'}
    >
      <div className="wizard-fields">
        <BitmapLabel text="NAME" size={18} />
        <BitmapInput
          value={name}
          maxLength={PROP_NAME_MAX_LENGTH}
          placeholder="PROP NAME"
          onChange={(next) => patch({ name: next })}
        />

        <BitmapLabel text="MOTION" size={18} />
        <div className="motion-row">
          {MOTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={layer === m.id ? 'motion-card is-active' : 'motion-card'}
              onClick={() => patch({ layer: m.id })}
            >
              <BitmapLabel text={m.label} size={22} align="center" />
              <BitmapLabel text={m.hint} size={13} align="center" />
            </button>
          ))}
        </div>
        <BitmapLabel text="MOTION DOES NOT LIMIT WHERE IT GOES" size={14} />
      </div>
    </WizardFrame>
  )
}
