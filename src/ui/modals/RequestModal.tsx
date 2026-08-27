import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

/** M2 에서 구현. 지금은 자리만 잡아 둔다. */
export function RequestModal() {
  const closeModal = useGameStore((s) => s.closeModal)

  return (
    <Popup title="REQUEST FORM" width={980} height={560} onClose={closeModal}>
      <div className="stack">
        <BitmapLabel text="NEW ANIMAL" size={32} />
        <BitmapLabel text="COMING IN M2" size={26} />
      </div>
    </Popup>
  )
}
