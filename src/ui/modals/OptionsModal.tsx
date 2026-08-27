import { Popup } from '@/ui/components/Popup'
import { Slider } from '@/ui/components/Slider'
import { useGameStore } from '@/store/gameStore'

export function OptionsModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const options = useGameStore((s) => s.options)
  const setOption = useGameStore((s) => s.setOption)

  return (
    <Popup title="OPTIONS" width={720} height={480} onClose={closeModal}>
      <div className="stack">
        <Slider label="BGM" value={options.bgm} onChange={(v) => setOption('bgm', v)} />
        <Slider label="SFX" value={options.sfx} onChange={(v) => setOption('sfx', v)} />
      </div>
    </Popup>
  )
}
