import { useEffect, useMemo, useRef } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@/assets/manifest'
import { loadSave } from '@/store/save'
import { useGameStore } from '@/store/gameStore'
import { BitmapLabel } from '@/ui/components/BitmapLabel'

export function TitleScreen() {
  const startNewGame = useGameStore((s) => s.startNewGame)
  const continueGame = useGameStore((s) => s.continueGame)
  const openModal = useGameStore((s) => s.openModal)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 세이브는 타이틀 진입 시점에 한 번만 읽는다. 렌더마다 localStorage 를 뒤질 이유가 없다.
  const savedGame = useMemo(() => loadSave(), [])

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
        {/* 배경이 먼저 자리를 잡고, 제목이 쿵 내려앉은 뒤, 버튼이 차례로 미끄러져 들어온다. */}
        <div className="title-logo">
          <BitmapLabel text="YOUR ZOO" size={110} align="center" />
        </div>
        <div className="title-menu">
          {savedGame && (
            <button type="button" className="text-button" onClick={() => continueGame()}>
              <BitmapLabel text="CONTINUE" size={44} align="center" />
              <BitmapLabel
                text={`${savedGame.zooName || 'MY ZOO'}  DAY ${savedGame.clock.day}`}
                size={18}
                align="center"
              />
            </button>
          )}
          <button type="button" className="text-button" onClick={startNewGame}>
            <BitmapLabel text="NEW GAME" size={44} align="center" />
          </button>
          {/* 타이틀 메뉴는 텍스트 버튼으로 통일한다. 여기만 아이콘이면 시각적으로 튄다. */}
          <button type="button" className="text-button" onClick={() => openModal('OPTIONS')}>
            <BitmapLabel text="OPTIONS" size={44} align="center" />
          </button>
        </div>
      </div>
    </div>
  )
}
