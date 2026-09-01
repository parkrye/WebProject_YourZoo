import { useEffect, useMemo, useState } from 'react'
import { GUI } from '@/assets/manifest'
import { computeAppeal, countHabitat, createAnimalId, type Animal, type SheetMeta } from '@/domain/animal'
import { ANIMAL_NAME_MAX_LENGTH, SHIPPING_DAYS } from '@/domain/balance'
import { isShopAnimal } from '@/domain/shop'
import {
  ANIMAL_CRAFTS, ANIMAL_CRAFT_ORDER, DETAIL_COLS, DETAIL_ROW_LABELS,
  type AnimalCraft,
} from '@/domain/craft'
import { LOCOMOTIONS, LOCOMOTION_ORDER } from '@/domain/locomotion'
import { rigOf } from '@/domain/rig'
import { TEMPLATES, type TemplateId } from '@/domain/templates'
import type { AnimalStep, TraitMode } from '@/domain/requestDraft'
import {
  ANIMAL_TYPE_ORDER, HABITATS, TRAIT_KEYS, TRAIT_LABELS,
  randomTraits, traitsFromType, withTrait,
  type AnimalTraits,
} from '@/domain/traits'
import { createRng } from '@/core/rng'
import { composeRig } from '@/render/animal/composeRig'
import { composeSheet } from '@/render/animal/composeSheet'
import { getBitmap, registerFromBlob } from '@/sim/imageCache'
import { putImage } from '@/store/imageDb'
import { useGameStore } from '@/store/gameStore'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { Slider } from '@/ui/components/Slider'
import { DrawModal } from '@/ui/modals/DrawModal'
import { CraftPicker } from './CraftPicker'
import { FrameStudio } from './FrameStudio'
import { RigStudio } from './RigStudio'
import { WizardFrame } from './WizardFrame'

const TRAIT_MODES: readonly TraitMode[] = ['TYPE', 'CUSTOM', 'RANDOM']

interface NewAnimalFormProps {
  onDone: () => void
}

/**
 * 동물 제작.
 *
 * 방식 → (템플릿) → 그리기 → 습성 → 이름 순으로 **한 걸음에 하나씩** 묻는다.
 * 예전에는 그림·템플릿·서식지·습성·이름을 한 화면에 늘어놓았는데,
 * 여기에 방식이 넷으로 늘면서 무엇부터 손대야 할지 알 수 없는 화면이 됐다.
 *
 * 방식에 따라 움직임이 정해진다:
 *   `SIMPLE`   빈 도화지. 무난한 기본 움직임(FREE 프로파일)
 *   `TEMPLATE` 템플릿 위에 그리고, 그 실루엣에 맞는 움직임
 *   `DETAILED` 24칸을 직접 그려 시트로 굽는다. 절차적 변형을 쓰지 않는다
 */
export function NewAnimalForm({ onDone }: NewAnimalFormProps) {
  const enclosureId = useGameStore((s) => s.currentEnclosure)
  // 그린 동물이 아직 하나도 없다면 이번이 처음이다.
  const firstDraw = useGameStore((s) => !s.animals.some((a) => !isShopAnimal(a)))
  const animals = useGameStore((s) => s.animals)
  const day = useGameStore((s) => s.clock.day)
  const gold = useGameStore((s) => s.gold)
  const cash = useGameStore((s) => s.cash)
  const orderAnimal = useGameStore((s) => s.orderAnimal)

  /*
    위저드가 들고 있는 값은 전부 **스토어의 초안**에 있다.
    여기서 useState 로 들고 있으면 요청서를 덮는 창 하나에 통째로 사라진다 —
    자정 정산 팝업이 뜨는 순간 그리던 그림도 이름도 습성도 없어졌다.
  */
  const draft = useGameStore((s) => s.draft.animal)
  const patch = useGameStore((s) => s.patchAnimalDraft)
  const {
    step, craft, locomotion, templateId, name, mode, typeId, custom, rolled, habitat,
    single, rigParts, frames,
  } = draft

  // 창이 닫히면 같이 사라져도 되는 것만 여기 남긴다.
  const [drawOpen, setDrawOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const spec = ANIMAL_CRAFTS[craft]
  const framed = craft === 'FRAMES'
  const rigged = craft === 'RIG'
  // 실루엣을 고르는 방식들. SIMPLE 은 빈 도화지라 여기 들지 않는다.
  const usesTemplate = craft === 'TEMPLATE' || craft === 'RIG' || craft === 'FRAMES'
  const guide = usesTemplate ? TEMPLATES[templateId].guide : []
  const rig = rigOf(TEMPLATES[templateId].archetype)

  const drawn = framed
    ? frames.some(Boolean)
    : rigged
      ? Object.keys(rigParts).length > 0
      : single !== null
  const affordable = gold >= spec.coins

  const base: AnimalTraits =
    mode === 'TYPE' ? traitsFromType(typeId) : mode === 'CUSTOM' ? custom : rolled
  const traits: AnimalTraits = { ...base, habitat }

  const colorCount = framed
    ? Math.max(...frames.map((f) => f?.colorCount ?? 0), 0)
    : rigged
      ? Math.max(...Object.values(rigParts).map((d) => d.colorCount), 0)
      : (single?.colorCount ?? 0)
  const appeal = computeAppeal({
    traits,
    colorCount,
    sameHabitatCount: countHabitat(animals, enclosureId, habitat),
  })

  const previewUrl = useMemo(() => (single ? URL.createObjectURL(single.blob) : null), [single])
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const goto = (next: AnimalStep): void => patch({ step: next })

  const startCraft = (id: AnimalCraft): void => {
    // 실루엣을 쓰는 방식은 이동 유형부터 고른다. 실루엣 열 몇 개를 한 번에
    // 늘어놓으면 사자와 거북이가 나란히 놓여 무엇이 다른지 읽히지 않는다.
    const needsShape = id === 'TEMPLATE' || id === 'RIG' || id === 'FRAMES'
    patch({ craft: id, step: needsShape ? 'LOCOMOTION' : 'DRAW' })
  }

  /** 템플릿을 고르면 서식지도 그에 맞춘다. 물 템플릿을 땅에 두면 움직임이 어긋난다. */
  const pickTemplate = (id: TemplateId): void => {
    const template = TEMPLATES[id]
    patch({
      templateId: id,
      ...(template.habitat && { habitat: template.habitat }),
      ...(template.suggestedType && { mode: 'TYPE' as const, typeId: template.suggestedType }),
    })
  }

  const submit = async (): Promise<void> => {
    if (!drawn || !affordable || busy || name.trim().length === 0) return
    setBusy(true)

    const imageId = createAnimalId()
    let sheet: SheetMeta | null = null
    let rigIds: Record<string, string> | null = null
    let blob: Blob

    if (framed) {
      const made = await composeSheet(frames.map((f) => f?.blob ?? null))
      blob = made.blob
      sheet = { imageId, ...made.meta }
    } else if (rigged) {
      // 파츠는 각자 따로 저장한다. 렌더러가 부위별로 돌려야 하기 때문이다.
      rigIds = {}
      const drawnParts = new Map<string, ImageBitmap>()
      for (const [partId, drawing] of Object.entries(rigParts)) {
        const partImageId = `${imageId}-${partId}`
        rigIds[partId] = partImageId
        await registerFromBlob(partImageId, drawing.blob)
        const decoded = getBitmap(partImageId)
        if (decoded) drawnParts.set(partId, decoded)
        try {
          await putImage(partImageId, drawing.blob)
        } catch {
          // 저장 실패는 세이브 단계에서 다시 드러난다.
        }
      }
      /*
        대표 그림은 파츠를 **정지 자세로 합쳐** 굽는다. 썸네일·창고·도착 알림·
        드래그 고스트가 전부 이 한 장을 쓴다. 예전에는 몸통 조각을 그대로 썼는데,
        그래서 사슴을 그린 사람이 어디서도 사슴을 못 보고 노란 덩어리만 봤다.
        합성이 실패하면 그때만 몸통으로 물러난다 — 아무것도 없는 것보다는 낫다.
      */
      blob =
        (await composeRig(rig, drawnParts))
        ?? (rigParts.BODY ?? Object.values(rigParts)[0]!).blob
    } else {
      blob = single!.blob
    }

    // 방금 그린 그림이라 Blob 이 손에 있다. 미리 디코드해 두면 배치 즉시 렌더된다.
    await registerFromBlob(imageId, blob)
    try {
      await putImage(imageId, blob)
    } catch {
      // IndexedDB 를 못 쓰는 환경에서도 이번 세션은 이어가게 둔다.
    }

    const animal: Animal = {
      id: createAnimalId(),
      name: name.trim(),
      // 제출한 동물은 바로 우리에 들어가지 않는다. 배송 -> 창고 -> 배치 순이다.
      status: 'SHIPPING',
      enclosureId: null,
      imageId,
      traits,
      // 움직임 프로파일은 여기서 갈린다. SIMPLE 은 무난한 기본값을 쓴다.
      templateId: usesTemplate ? templateId : 'FREE',
      spriteSheet: sheet,
      rig: rigIds,
      orderedDay: day,
      arrivalDay: day + SHIPPING_DAYS.DRAWN,
      appeal,
    }

    setBusy(false)
    if (orderAnimal(animal, spec.coins)) onDone()
  }

  if (step === 'CRAFT') {
    return (
      <CraftPicker
        title="HOW WILL YOU MAKE IT"
        order={ANIMAL_CRAFT_ORDER}
        specs={ANIMAL_CRAFTS}
        gold={gold}
        cash={cash}
        onPick={startCraft}
      />
    )
  }

  if (step === 'LOCOMOTION') {
    return (
      <WizardFrame
        title="HOW DOES IT MOVE"
        onBack={() => goto('CRAFT')}
        onNext={() => goto('TEMPLATE')}
      >
        <div className="wizard-grid">
          {LOCOMOTION_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={locomotion === id ? 'wizard-card is-active' : 'wizard-card'}
              onClick={() => {
                patch({ locomotion: id })
                const first = LOCOMOTIONS[id].templates[0]
                if (first) pickTemplate(first)
              }}
            >
              <BitmapLabel text={LOCOMOTIONS[id].label} size={21} align="center" />
              <BitmapLabel text={LOCOMOTIONS[id].hint} size={12} align="center" />
            </button>
          ))}
        </div>
      </WizardFrame>
    )
  }

  if (step === 'TEMPLATE') {
    return (
      <WizardFrame
        title="PICK A SHAPE"
        onBack={() => goto('LOCOMOTION')}
        onNext={() => goto('DRAW')}
        nextLabel="DRAW"
      >
        <div className="wizard-grid">
          {LOCOMOTIONS[locomotion].templates.map((id) => (
            <button
              key={id}
              type="button"
              className={templateId === id ? 'wizard-card is-active' : 'wizard-card'}
              onClick={() => pickTemplate(id)}
            >
              <BitmapLabel text={TEMPLATES[id].label} size={22} align="center" />
              <BitmapLabel text={TEMPLATES[id].habitat ?? 'ANY'} size={13} align="center" />
            </button>
          ))}
        </div>
      </WizardFrame>
    )
  }

  if (step === 'DRAW') {
    return (
      <WizardFrame
        title={framed ? 'DRAW 24 FRAMES' : rigged ? 'DRAW EACH PART' : 'DRAW IT'}
        onBack={() => goto(usesTemplate ? 'TEMPLATE' : 'CRAFT')}
        onNext={() => goto('TRAITS')}
        nextReady={drawn}
      >
        {rigged ? (
          <RigStudio
            spec={rig}
            parts={rigParts}
            onChange={(partId, drawing) =>
              patch({ rigParts: { ...rigParts, [partId]: drawing } })
            }
          />
        ) : framed ? (
          <FrameStudio
            rows={DETAIL_ROW_LABELS.map((label) => ({ label, count: DETAIL_COLS }))}
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
                <img src={previewUrl} alt="animal" className="drawing-preview" />
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

  if (step === 'TRAITS') {
    return (
      <WizardFrame
        title="HOW DOES IT BEHAVE"
        onBack={() => goto('DRAW')}
        onNext={() => goto('NAME')}
      >
        <div className="wizard-fields">
          <BitmapLabel text="HABITAT" size={18} />
          <div className="chip-row">
            {HABITATS.map((h) => (
              <button
                key={h}
                type="button"
                className={habitat === h ? 'chip is-active' : 'chip'}
                onClick={() => patch({ habitat: h })}
              >
                <BitmapLabel text={h} size={18} />
              </button>
            ))}
          </div>

          <BitmapLabel text="TRAITS" size={18} />
          <div className="chip-row">
            {TRAIT_MODES.map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? 'chip is-active' : 'chip'}
                onClick={() => patch({ mode: m })}
              >
                <BitmapLabel text={m} size={18} />
              </button>
            ))}
          </div>

          {mode === 'TYPE' && (
            <div className="chip-grid">
              {ANIMAL_TYPE_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={typeId === id ? 'chip is-active' : 'chip'}
                  onClick={() => patch({ typeId: id })}
                >
                  <BitmapLabel text={id} size={17} />
                </button>
              ))}
            </div>
          )}

          {mode === 'CUSTOM' && (
            <div className="wizard-sliders">
              {TRAIT_KEYS.map((key) => (
                <Slider
                  key={key}
                  label={TRAIT_LABELS[key]}
                  value={custom[key]}
                  onChange={(v) => patch({ custom: withTrait(custom, key, v) })}
                />
              ))}
            </div>
          )}

          {mode === 'RANDOM' && (
            <button
              type="button"
              className="labeled-button"
              onClick={() => {
                const seed = draft.rollSeed + 1
                patch({ rollSeed: seed, rolled: randomTraits(createRng(Math.imul(seed, 2654435761))) })
              }}
            >
              <IconGlyph icon={GUI.UNDO} size={36} />
              <BitmapLabel text="REROLL" size={20} />
            </button>
          )}
        </div>
      </WizardFrame>
    )
  }

  return (
    <WizardFrame
      title="NAME IT"
      onBack={() => goto('TRAITS')}
      onSubmit={() => void submit()}
      submitReady={drawn && affordable && !busy && name.trim().length > 0}
      cost={spec.coins}
      note={
        firstDraw
          // 처음 그린 동물은 기다리지 않는다. 그 사실을 그리기 전에 알려 준다.
          ? `APPEAL ${appeal}  ARRIVES RIGHT AWAY`
          : `APPEAL ${appeal}  ARRIVES IN ${SHIPPING_DAYS.DRAWN} DAYS`
      }
      warning={affordable ? null : 'NOT ENOUGH COINS'}
    >
      <div className="wizard-fields">
        <BitmapLabel text="NAME" size={18} />
        <BitmapInput
          value={name}
          onChange={(next) => patch({ name: next })}
          maxLength={ANIMAL_NAME_MAX_LENGTH}
          placeholder="ENTER NAME"
          width={330}
        />
        <BitmapLabel text={`${habitat}  ${traits.diet}`} size={16} />
      </div>
    </WizardFrame>
  )
}
