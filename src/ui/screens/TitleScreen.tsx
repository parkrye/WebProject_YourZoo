import { getAssets } from '@/assets/AssetStore'
import { GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { useGameStore } from '@/store/gameStore'
import { useEffect, useRef } from 'react'

export function TitleScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const openModal = useGameStore((s) => s.openModal)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { sky, area, fence } = getAssets()
    ctx.drawImage(sky.AFTERNOON, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
    ctx.drawImage(area.FIELD, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
    ctx.drawImage(fence, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
  }, [])

  return (
    <div className="screen">
      <canvas ref={canvasRef} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} className="screen-canvas" />
      <div className="title-overlay">
        <BitmapLabel text="YOUR ZOO" size={110} align="center" />
        <div className="title-menu">
          <button type="button" className="text-button" onClick={() => setScreen('ZOO')}>
            <BitmapLabel text="START GAME" size={44} align="center" />
          </button>
          <IconButton icon={GUI.SETTINGS} size={84} title="OPTIONS" onClick={() => openModal('OPTIONS')} />
        </div>
      </div>
    </div>
  )
}
