import { useEffect, useMemo, useRef } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@/assets/manifest'
import { hasSave } from '@/store/save'
import { useGameStore } from '@/store/gameStore'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'

export function TitleScreen() {
  const startNewGame = useGameStore((s) => s.startNewGame)
  const continueGame = useGameStore((s) => s.continueGame)
  const openModal = useGameStore((s) => s.openModal)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 세이브 유무는 타이틀 진입 시점에 한 번만 본다. 렌더마다 localStorage 를 읽을 이유가 없다.
  const savedGame = useMemo(() => hasSave(), [])

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
          {savedGame && (
            <button type="button" className="text-button" onClick={() => continueGame()}>
              <BitmapLabel text="CONTINUE" size={44} align="center" />
            </button>
          )}
          <button type="button" className="text-button" onClick={startNewGame}>
            <BitmapLabel text="NEW GAME" size={44} align="center" />
          </button>
          <IconButton icon={GUI.SETTINGS} size={84} title="OPTIONS" onClick={() => openModal('OPTIONS')} />
        </div>
      </div>
    </div>
  )
}
