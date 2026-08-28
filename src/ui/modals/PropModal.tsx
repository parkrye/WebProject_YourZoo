import { useEffect, useMemo, useState } from 'react'
import { GUI, type Habitat } from '@/assets/manifest'
import { PROP_CREATE_COST, PROP_NAME_MAX_LENGTH, SHIPPING_DAYS } from '@/domain/balance'
import { createPropId, type OwnedProp } from '@/domain/prop'
import type { ExportedDrawing } from '@/draw/export'
import { registerFromBlob } from '@/sim/imageCache'
import { putImage } from '@/store/imageDb'
import { useGameStore } from '@/store/gameStore'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { Popup } from '@/ui/components/Popup'
import { DrawModal } from './DrawModal'

const LAYERS: readonly Habitat[] = ['LAND', 'WATER']

/**
 * 프롭 제작.
 *
 * 동물 요청서에서 습성과 템플릿을 걷어낸 형태다 — 프롭은 움직이지 않으니
 * 정할 게 이름과 **땅이냐 물이냐** 둘뿐이다.
 * 물 프롭은 잔물결에 흔들리고 땅 프롭은 가만히 있는다.
 */
export function PropModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const orderProp = useGameStore((s) => s.orderProp)
  const gold = useGameStore((s) => s.gold)
  const day = useGameStore((s) => s.clock.day)

  const [name, setName] = useState('')
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

  const ready = name.trim().length > 0 && drawing !== null && gold >= PROP_CREATE_COST && !busy

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
    if (orderProp(prop)) closeModal()
  }

  return (
    <>
      <Popup title="MAKE A PROP" width={640} height={560} onClose={closeModal}>
        <div className="prop-form">
          <button type="button" className="prop-canvas" onClick={() => setDrawOpen(true)}>
            {previewUrl ? (
              <img src={previewUrl} alt="" className="prop-preview" />
            ) : (
              <>
                <IconGlyph icon={GUI.PENCIL} size={54} />
                <BitmapLabel text="DRAW" size={24} />
              </>
            )}
          </button>

          <div className="prop-fields">
            <BitmapLabel text="NAME" size={18} />
            <BitmapInput
              value={name}
              maxLength={PROP_NAME_MAX_LENGTH}
              placeholder="PROP NAME"
              onChange={setName}
            />

            <BitmapLabel text="PLACE ON" size={18} />
            <div className="chip-row">
              {LAYERS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={id === layer ? 'chip is-active' : 'chip'}
                  onClick={() => setLayer(id)}
                >
                  <BitmapLabel text={id} size={18} />
                </button>
              ))}
            </div>
          </div>

          <div className="prop-actions">
            <div className="shop-price">
              <IconGlyph icon={GUI.COIN} size={24} />
              <BitmapLabel text={`${PROP_CREATE_COST}`} size={22} />
            </div>
            <BitmapLabel text={`ARRIVES IN ${SHIPPING_DAYS.DRAWN} DAYS`} size={16} />
            <IconButton
              icon={GUI.SUBMIT}
              size={62}
              title="SUBMIT"
              disabled={!ready}
              onClick={() => void submit()}
            />
          </div>
        </div>
      </Popup>

      {drawOpen && (
        <DrawModal
          templateId="FREE"
          onClose={() => setDrawOpen(false)}
          onDone={(result) => {
            setDrawing(result)
            setDrawOpen(false)
          }}
        />
      )}
    </>
  )
}
