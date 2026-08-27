import { useEffect, useRef, useState } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@/assets/manifest'
import { ZOO_NAME_MAX_LENGTH } from '@/domain/balance'
import { useGameStore } from '@/store/gameStore'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'

const FALLBACK_NAME = 'MY ZOO'

/** 새 게임을 시작하면 이름부터 짓는다. 물려받은 동물원에 이름을 붙이는 첫 행동이다. */
export function NamingScreen() {
  const confirmZooName = useGameStore((s) => s.confirmZooName)
  const setScreen = useGameStore((s) => s.setScreen)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { sky, area, fence } = getAssets()
    ctx.drawImage(sky.DAY, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
    ctx.drawImage(area.FIELD, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
    ctx.drawImage(fence, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
  }, [])

  const confirm = (): void => confirmZooName(name.trim() || FALLBACK_NAME)

  return (
    <div className="screen">
      <canvas ref={canvasRef} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} className="screen-canvas" />
      <div className="naming-overlay">
        <BitmapLabel text="NAME YOUR ZOO" size={64} align="center" />
        <div className="naming-field">
          <BitmapInput
            value={name}
            onChange={setName}
            maxLength={ZOO_NAME_MAX_LENGTH}
            placeholder={FALLBACK_NAME}
            size={40}
            width={520}
          />
        </div>
        <div className="naming-actions">
          <IconButton icon={GUI.CONFIRM} size={84} title="START" onClick={confirm} />
          <IconButton icon={GUI.BACK} size={72} title="BACK" onClick={() => setScreen('TITLE')} />
        </div>
      </div>
    </div>
  )
}
