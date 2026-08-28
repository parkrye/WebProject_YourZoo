import { useEffect, useMemo, useState } from 'react'
import { GUI } from '@/assets/manifest'
import { computeAppeal, countHabitat, createAnimalId, type Animal, type SheetMeta } from '@/domain/animal'
import { ANIMAL_NAME_MAX_LENGTH, SHIPPING_DAYS } from '@/domain/balance'
import {
  ANIMAL_CRAFTS, ANIMAL_CRAFT_ORDER, DETAIL_COLS, DETAIL_ROW_LABELS,
  type AnimalCraft,
} from '@/domain/craft'
import { LOCOMOTIONS, LOCOMOTION_ORDER, type Locomotion } from '@/domain/locomotion'
import { rigOf } from '@/domain/rig'
import { TEMPLATES, type TemplateId } from '@/domain/templates'
import {
  ANIMAL_TYPE_ORDER, HABITATS, TRAIT_KEYS, TRAIT_LABELS,
  randomTraits, traitsFromType, withTrait,
  type AnimalTraits, type AnimalTypeId,
} from '@/domain/traits'
import { createRng } from '@/core/rng'
import type { ExportedDrawing } from '@/draw/export'
import { composeSheet } from '@/render/animal/composeSheet'
import { registerFromBlob } from '@/sim/imageCache'
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

type Step = 'CRAFT' | 'LOCOMOTION' | 'TEMPLATE' | 'DRAW' | 'TRAITS' | 'NAME'
type TraitMode = 'TYPE' | 'CUSTOM' | 'RANDOM'

const TRAIT_MODES: readonly TraitMode[] = ['TYPE', 'CUSTOM', 'RANDOM']
const DETAIL_TOTAL = DETAIL_COLS * DETAIL_ROW_LABELS.length

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
  const animals = useGameStore((s) => s.animals)
  const day = useGameStore((s) => s.clock.day)
  const gold = useGameStore((s) => s.gold)
  const cash = useGameStore((s) => s.cash)
  const orderAnimal = useGameStore((s) => s.orderAnimal)

  const [step, setStep] = useState<Step>('CRAFT')
  const [craft, setCraft] = useState<AnimalCraft>('SIMPLE')
  const [locomotion, setLocomotion] = useState<Locomotion>('QUADRUPED')
  const [templateId, setTemplateId] = useState<TemplateId>('DEER')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<TraitMode>('TYPE')
  const [typeId, setTypeId] = useState<AnimalTypeId>(ANIMAL_TYPE_ORDER[0] as AnimalTypeId)
  const [custom, setCustom] = useState<AnimalTraits>(() => randomTraits(createRng(11)))
  const [rolled, setRolled] = useState<AnimalTraits>(() => randomTraits(createRng(23)))
  const [rollSeed, setRollSeed] = useState(23)
  const [habitat, setHabitat] = useState<AnimalTraits['habitat']>('LAND')

  const [single, setSingle] = useState<ExportedDrawing | null>(null)
  /** 리그 파츠. 부위 id 로 찾는다. */
  const [rigParts, setRigParts] = useState<Record<string, ExportedDrawing>>({})
  const [frames, setFrames] = useState<(ExportedDrawing | null)[]>(
    () => Array(DETAIL_TOTAL).fill(null),
  )
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

  const startCraft = (id: AnimalCraft): void => {
    setCraft(id)
    // 실루엣을 쓰는 방식은 이동 유형부터 고른다. 실루엣 열 몇 개를 한 번에
    // 늘어놓으면 사자와 거북이가 나란히 놓여 무엇이 다른지 읽히지 않는다.
    const needsShape = id === 'TEMPLATE' || id === 'RIG' || id === 'FRAMES'
    setStep(needsShape ? 'LOCOMOTION' : 'DRAW')
  }

  /** 템플릿을 고르면 서식지도 그에 맞춘다. 물 템플릿을 땅에 두면 움직임이 어긋난다. */
  const pickTemplate = (id: TemplateId): void => {
    setTemplateId(id)
    const template = TEMPLATES[id]
    if (template.habitat) setHabitat(template.habitat)
    if (template.suggestedType) {
      setMode('TYPE')
      setTypeId(template.suggestedType)
    }
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
      for (const [partId, drawing] of Object.entries(rigParts)) {
        const partImageId = `${imageId}-${partId}`
        rigIds[partId] = partImageId
        await registerFromBlob(partImageId, drawing.blob)
        try {
          await putImage(partImageId, drawing.blob)
        } catch {
          // 저장 실패는 세이브 단계에서 다시 드러난다.
        }
      }
      // 대표 그림은 몸통이다. 썸네일과 창고 목록에 쓴다.
      blob = (rigParts.BODY ?? Object.values(rigParts)[0]!).blob
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
        onBack={() => setStep('CRAFT')}
        onNext={() => setStep('TEMPLATE')}
      >
        <div className="wizard-grid">
          {LOCOMOTION_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={locomotion === id ? 'wizard-card is-active' : 'wizard-card'}
              onClick={() => {
                setLocomotion(id)
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
        onBack={() => setStep('LOCOMOTION')}
        onNext={() => setStep('DRAW')}
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
        onBack={() => setStep(usesTemplate ? 'TEMPLATE' : 'CRAFT')}
        onNext={() => setStep('TRAITS')}
        nextReady={drawn}
      >
        {rigged ? (
          <RigStudio
            spec={rig}
            parts={rigParts}
            guide={guide}
            onChange={(partId, drawing) =>
              setRigParts((prev) => ({ ...prev, [partId]: drawing }))
            }
          />
        ) : framed ? (
          <FrameStudio
            rows={DETAIL_ROW_LABELS.map((label) => ({ label, count: DETAIL_COLS }))}
            frames={frames}
            guide={guide}
            onChange={(i, drawing) =>
              setFrames((prev) => prev.map((f, n) => (n === i ? drawing : f)))
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
              setSingle(result)
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
        onBack={() => setStep('DRAW')}
        onNext={() => setStep('NAME')}
      >
        <div className="wizard-fields">
          <BitmapLabel text="HABITAT" size={18} />
          <div className="chip-row">
            {HABITATS.map((h) => (
              <button
                key={h}
                type="button"
                className={habitat === h ? 'chip is-active' : 'chip'}
                onClick={() => setHabitat(h)}
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
                onClick={() => setMode(m)}
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
                  onClick={() => setTypeId(id)}
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
                  onChange={(v) => setCustom(withTrait(custom, key, v))}
                />
              ))}
            </div>
          )}

          {mode === 'RANDOM' && (
            <button
              type="button"
              className="labeled-button"
              onClick={() => {
                const seed = rollSeed + 1
                setRollSeed(seed)
                setRolled(randomTraits(createRng(Math.imul(seed, 2654435761))))
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
      onBack={() => setStep('TRAITS')}
      onSubmit={() => void submit()}
      submitReady={drawn && affordable && !busy && name.trim().length > 0}
      cost={spec.coins}
      note={`APPEAL ${appeal}  ARRIVES IN ${SHIPPING_DAYS.DRAWN} DAYS`}
      warning={affordable ? null : 'NOT ENOUGH COINS'}
    >
      <div className="wizard-fields">
        <BitmapLabel text="NAME" size={18} />
        <BitmapInput
          value={name}
          onChange={setName}
          maxLength={ANIMAL_NAME_MAX_LENGTH}
          placeholder="ENTER NAME"
          width={330}
        />
        <BitmapLabel text={`${habitat}  ${traits.diet}`} size={16} />
      </div>
    </WizardFrame>
  )
}
