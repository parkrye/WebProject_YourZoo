import { GUI } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

export function StatusModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const gold = useGameStore((s) => s.gold)
  const reputation = useGameStore((s) => s.reputation)
  const animalCount = useGameStore((s) => s.animals.length)

  return (
    <Popup title="ZOO STATUS" width={760} height={520} onClose={closeModal}>
      <div className="stack">
        <div className="stat-row">
          <IconButton icon={GUI.COIN} size={56} />
          <BitmapLabel text={`GOLD ${gold}`} size={34} />
        </div>
        <div className="stat-row">
          <IconButton icon={GUI.MEDAL} size={56} />
          <BitmapLabel text={`FAME ${reputation}`} size={34} />
        </div>
        <div className="stat-row">
          <IconButton icon={GUI.BOOK} size={56} />
          <BitmapLabel text={`ANIMALS ${animalCount}`} size={34} />
        </div>
      </div>
    </Popup>
  )
}
