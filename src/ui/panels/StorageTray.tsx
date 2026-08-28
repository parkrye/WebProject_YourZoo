import { useCallback, useRef, useState } from 'react'
import type { Animal } from '@/domain/animal'
import type { OwnedProp } from '@/domain/prop'
import { GUI } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { AnimalItemThumb, PropItemThumb } from '@/ui/components/ItemThumb'
import { Tabs, type TabItem } from '@/ui/components/Tabs'

const THUMB_SIZE = 72
/** 이 거리를 넘겨야 드래그로 친다. 그 아래는 선택 클릭이다. */
const DRAG_THRESHOLD = 6
/** 퇴장 애니메이션 길이. CSS 의 tray-out 과 맞춰야 한다. */
const EXIT_MS = 180
/** 항상 보여 주는 슬롯 수. 비어 있어도 자리를 남겨 두면 창고 크기가 한눈에 읽힌다. */
const SLOT_COUNT = 8

/**
 * 창고에서 꺼내 놓을 수 있는 것.
 *
 * 동물과 프롭은 배치 방식이 같아 트레이와 드래그를 한 벌만 둔다 -
 * 둘로 나누면 같은 조작을 두 곳에서 고쳐야 한다.
 */
export type TrayItem =
  | { kind: 'ANIMAL'; id: string; animal: Animal }
  | { kind: 'PROP'; id: string; prop: OwnedProp }

export const animalItem = (animal: Animal): TrayItem => ({ kind: 'ANIMAL', id: animal.id, animal })
export const propItem = (prop: OwnedProp): TrayItem => ({ kind: 'PROP', id: prop.id, prop })

export interface DragState {
  item: TrayItem
  /** 화면(뷰포트) 좌표 */
  clientX: number
  clientY: number
}

type TrayTab = 'ANIMAL' | 'PROP'

const TRAY_TABS: readonly TabItem<TrayTab>[] = [
  { id: 'ANIMAL', label: 'ANIMALS' },
  { id: 'PROP', label: 'PROPS' },
]

interface StorageTrayProps {
  stored: readonly Animal[]
  storedProps: readonly OwnedProp[]
  shippingCount: number
  /** 손이 우리 위로 넘어갔을 때. 트레이를 내려 놓을 자리를 보여 준다. */
  lowered: boolean
  /** 트레이 항목을 짧게 눌렀을 때 — 정보 카드를 연다. */
  onSelect: (item: TrayItem) => void
  onDragStart: (state: DragState) => void
  onDragMove: (state: DragState) => void
  onDragEnd: (state: DragState) => void
  onClose: () => void
}


/**
 * 상세보기 하단 창고 트레이.
 *
 * 항목을 **끌어서 우리에 놓으면 배치**되고, **짧게 누르면 정보 카드**가 열린다.
 * 둘을 이동 거리로 구분한다 — 배치 화면과 목록이 한 화면에 있어야
 * "여기 놓는다"는 조작이 성립하기 때문에 팝업이 아니라 트레이다.
 */
export function StorageTray({
  stored, storedProps, shippingCount, lowered, onSelect, onDragStart, onDragMove, onDragEnd, onClose,
}: StorageTrayProps) {
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [tab, setTab] = useState<TrayTab>('ANIMAL')

  const items: TrayItem[] = tab === 'ANIMAL' ? stored.map(animalItem) : storedProps.map(propItem)

  // 열릴 때 올라왔으면 닫힐 때도 같은 길로 내려가야 한다. 즉시 언마운트하면 뿅 사라진다.
  const requestClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, EXIT_MS)
  }, [closing, onClose])

  const handlePointerDown = (event: React.PointerEvent): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    originRef.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerMove = (event: React.PointerEvent, item: TrayItem): void => {
    const origin = originRef.current
    if (!origin) return

    const state: DragState = { item, clientX: event.clientX, clientY: event.clientY }

    if (draggingId !== item.id) {
      const moved = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
      if (moved < DRAG_THRESHOLD) return
      setDraggingId(item.id)
      onDragStart(state)
      return
    }

    onDragMove(state)
  }

  const handlePointerUp = (event: React.PointerEvent, item: TrayItem): void => {
    const origin = originRef.current
    originRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!origin) return

    if (draggingId === item.id) {
      setDraggingId(null)
      onDragEnd({ item, clientX: event.clientX, clientY: event.clientY })
      return
    }

    onSelect(item)
  }

  return (
    // 드래그 중에는 트레이를 비쳐 보이게 한다. 물 영역이 트레이에 가려
    // "어디에 놓는지" 가 보이지 않으면 물 동물을 배치할 수 없다.
    <div className={trayClass(draggingId !== null, closing, lowered)}>
      <div className="storage-tray-head">
        <Tabs items={TRAY_TABS} active={tab} onChange={setTab} />

        {/* 개수는 탭 옆 알약에 붙인다. 숫자만 덩그러니 있으면 무엇의 수인지 알 수 없다. */}
        <span className="tray-count">
          <BitmapLabel text={`${items.length} IN STORAGE`} size={17} />
        </span>
        {shippingCount > 0 && (
          <span className="tray-count is-muted">
              <IconGlyph icon={GUI.TRUCK} size={18} />
            <BitmapLabel text={`${shippingCount} ON THE WAY`} size={17} />
          </span>
        )}

        <span className="tray-hint">
          <BitmapLabel text="DRAG TO PLACE" size={16} />
        </span>
        <button type="button" className="storage-tray-close text-button" onClick={requestClose}>
          <BitmapLabel text="CLOSE" size={20} />
        </button>
      </div>

      <div className="storage-tray-items">
        {items.length === 0 && (
          <div className="tray-empty">
            <BitmapLabel
              text={tab === 'ANIMAL' ? 'NO ANIMALS YET' : 'NO PROPS YET'}
              size={20}
            />
            <BitmapLabel text="MAKE ONE OR VISIT THE SHOP" size={15} />
          </div>
        )}

        {Array.from({ length: items.length === 0 ? 0 : Math.max(SLOT_COUNT, items.length) }, (_, i) => {
          const item = items[i]
          if (!item) return <div key={`slot-${i}`} className="storage-slot is-empty" />

          return (
            <div
              key={item.id}
              className={draggingId === item.id ? 'storage-slot is-dragging' : 'storage-slot'}
              onPointerDown={handlePointerDown}
              onPointerMove={(e) => handlePointerMove(e, item)}
              onPointerUp={(e) => handlePointerUp(e, item)}
              onPointerCancel={(e) => handlePointerUp(e, item)}
            >
              {item.kind === 'ANIMAL' ? (
                <>
                  <AnimalItemThumb animal={item.animal} size={THUMB_SIZE} />
                  <BitmapLabel text={item.animal.name} size={15} align="center" />
                  <BitmapLabel text={item.animal.traits.habitat} size={13} align="center" />
                </>
              ) : (
                <>
                  <PropItemThumb prop={item.prop} size={THUMB_SIZE} />
                  <BitmapLabel text={item.prop.name} size={15} align="center" />
                  <BitmapLabel text={item.prop.layer} size={13} align="center" />
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function trayClass(dragging: boolean, closing: boolean, lowered: boolean): string {
  return [
    'storage-tray',
    dragging ? 'is-dragging' : '',
    closing ? 'is-closing' : '',
    lowered ? 'is-lowered' : '',
  ]
    .filter(Boolean)
    .join(' ')
}
