import { useEffect, useMemo, useRef } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@/assets/manifest'
import { loadSave } from '@/store/save'
import { useGameStore } from '@/store/gameStore'
import { BitmapLabel } from '@/ui/components/BitmapLabel'

/**
 * 타이틀 메뉴의 단계.
 *
 * 한 화면에 다 늘어놓으면 처음 온 사람이 무엇부터 눌러야 할지 모른다.
 * 먼저 **하고 싶은 것**(플레이/설정)을 고르고, 그 다음에 **어떻게 할지**(비회원/로그인)를 고른다.
 */
export type TitleStep = 'ROOT' | 'PLAY'

interface TitleScreenProps {
  step: TitleStep
  /** 제목이 내려앉는 연출을 할지. 처음 들어왔을 때만 참이다. */
  intro: boolean
  onStep: (step: TitleStep) => void
  onLogin: () => void
}

export function TitleScreen({ step, intro, onStep, onLogin }: TitleScreenProps) {
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
      <div className={`title-overlay${intro ? ' is-intro' : ''}`}>
        {/* 배경이 먼저 자리를 잡고, 제목이 쿵 내려앉은 뒤, 버튼이 차례로 미끄러져 들어온다. */}
        <div className="title-logo">
          <BitmapLabel text="YOUR ZOO" size={110} align="center" />
        </div>

        {/*
          `key` 로 단계마다 새로 붙인다. 그래야 들어갈 때도 나올 때도
          버튼이 다시 미끄러져 들어와 단계가 바뀐 것이 눈에 보인다.
        */}
        {step === 'ROOT' ? (
          <div className="title-menu" key="root">
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
            <button type="button" className="text-button" onClick={() => onStep('PLAY')}>
              <BitmapLabel text="PLAY" size={48} align="center" />
            </button>
            {/* 타이틀 메뉴는 텍스트 버튼으로 통일한다. 여기만 아이콘이면 시각적으로 튄다. */}
            <button type="button" className="text-button" onClick={() => openModal('OPTIONS')}>
              <BitmapLabel text="OPTIONS" size={44} align="center" />
            </button>
          </div>
        ) : (
          <div className="title-menu" key="play">
            {/*
              계정이 있어야 하는 이유는 하나다 — 다른 기기에서 이어하기.
              그게 필요 없으면 비회원으로 바로 시작하면 된다. 그래서 비회원이 위다.
            */}
            <button type="button" className="text-button" onClick={startNewGame}>
              <BitmapLabel text="PLAY AS GUEST" size={44} align="center" />
              <BitmapLabel text="NO ACCOUNT NEEDED" size={15} align="center" />
            </button>
            <button type="button" className="text-button" onClick={onLogin}>
              <BitmapLabel text="LOGIN" size={44} align="center" />
              <BitmapLabel text="CONTINUE ON ANY DEVICE" size={15} align="center" />
            </button>
            <button type="button" className="text-button" onClick={() => onStep('ROOT')}>
              <BitmapLabel text="BACK" size={30} align="center" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
