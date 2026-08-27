import { useRef, useState } from 'react'
import type { Animal } from '@/domain/animal'
import { AnimalThumb } from '@/ui/components/AnimalThumb'
import { BitmapLabel } from '@/ui/components/BitmapLabel'

const THUMB_SIZE = 72
/** 이 거리를 넘겨야 드래그로 친다. 그 아래는 선택 클릭이다. */
const DRAG_THRESHOLD = 6

export interface DragState {
  animal: Animal
  /** 화면(뷰포트) 좌표 */
  clientX: number
  clientY: number
}

interface StorageTrayProps {
  stored: readonly Animal[]
  shippingCount: number
  /** 트레이 항목을 짧게 눌렀을 때 — 정보 카드를 연다. */
  onSelect: (animal: Animal) => void
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
  stored, shippingCount, onSelect, onDragStart, onDragMove, onDragEnd, onClose,
}: StorageTrayProps) {
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const handlePointerDown = (event: React.PointerEvent): void => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    originRef.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerMove = (event: React.PointerEvent, animal: Animal): void => {
    const origin = originRef.current
    if (!origin) return

    const state: DragState = { animal, clientX: event.clientX, clientY: event.clientY }

    if (draggingId !== animal.id) {
      const moved = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
      if (moved < DRAG_THRESHOLD) return
      setDraggingId(animal.id)
      onDragStart(state)
      return
    }

    onDragMove(state)
  }

  const handlePointerUp = (event: React.PointerEvent, animal: Animal): void => {
    const origin = originRef.current
    originRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!origin) return

    if (draggingId === animal.id) {
      setDraggingId(null)
      onDragEnd({ animal, clientX: event.clientX, clientY: event.clientY })
      return
    }

    onSelect(animal)
  }

  return (
    // 드래그 중에는 트레이를 비쳐 보이게 한다. 물 영역이 트레이에 가려
    // "어디에 놓는지" 가 보이지 않으면 물 동물을 배치할 수 없다.
    <div className={draggingId ? 'storage-tray is-dragging' : 'storage-tray'}>
      <div className="storage-tray-head">
        <BitmapLabel text={`STORAGE ${stored.length}`} size={24} />
        {shippingCount > 0 && <BitmapLabel text={`SHIPPING ${shippingCount}`} size={20} />}
        <BitmapLabel text="DRAG TO PLACE" size={18} />
        <button type="button" className="storage-tray-close text-button" onClick={onClose}>
          <BitmapLabel text="CLOSE" size={20} />
        </button>
      </div>

      <div className="storage-tray-items">
        {stored.length === 0 && <BitmapLabel text="STORAGE IS EMPTY" size={20} />}
        {stored.map((animal) => (
          <div
            key={animal.id}
            className={draggingId === animal.id ? 'storage-item is-dragging' : 'storage-item'}
            onPointerDown={handlePointerDown}
            onPointerMove={(e) => handlePointerMove(e, animal)}
            onPointerUp={(e) => handlePointerUp(e, animal)}
            onPointerCancel={(e) => handlePointerUp(e, animal)}
          >
            <AnimalThumb imageId={animal.imageId} size={THUMB_SIZE} />
            <BitmapLabel text={animal.name} size={16} align="center" />
            <BitmapLabel text={animal.traits.habitat} size={14} align="center" />
          </div>
        ))}
      </div>
    </div>
  )
}
