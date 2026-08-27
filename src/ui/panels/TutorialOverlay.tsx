import { useEffect, useLayoutEffect, useState } from 'react'
import type { TutorialHint } from '@/domain/tutorial'
import { BitmapLabel } from '@/ui/components/BitmapLabel'

interface TutorialOverlayProps {
  hint: TutorialHint
  onSkip: () => void
}

interface Spot {
  left: number
  top: number
  width: number
  height: number
}

const PADDING = 12
const POLL_MS = 250
/** 강조 대상과 카드 사이 간격. 겹치면 정작 눌러야 할 것이 가려진다. */
const CARD_GAP = 26
const CARD_HEIGHT = 130
const STAGE_HEIGHT = 941

/**
 * 튜토리얼 안내.
 *
 * 강조 대상 주위에 링을 두르고 그 옆에 설명을 붙인다.
 * **클릭은 통과시킨다** — 화면을 덮어 조작을 막으면 안내가 아니라 방해가 된다.
 * 대상이 아직 없거나 위치가 바뀔 수 있어 주기적으로 다시 잰다.
 */
export function TutorialOverlay({ hint, onSkip }: TutorialOverlayProps) {
  const [spot, setSpot] = useState<Spot | null>(null)

  useLayoutEffect(() => {
    if (!hint.target) {
      setSpot(null)
      return
    }

    const measure = (): void => {
      const el = document.querySelector(hint.target as string)
      const stage = document.querySelector('.stage-view')
      if (!el || !stage) {
        setSpot(null)
        return
      }

      // Stage 가 CSS 로 축소돼 있으므로 논리 좌표로 되돌린다.
      const a = el.getBoundingClientRect()
      const b = stage.getBoundingClientRect()
      const scale = b.width / (stage as HTMLElement).offsetWidth
      setSpot({
        left: (a.left - b.left) / scale,
        top: (a.top - b.top) / scale,
        width: a.width / scale,
        height: a.height / scale,
      })
    }

    measure()
    const timer = window.setInterval(measure, POLL_MS)
    return () => window.clearInterval(timer)
  }, [hint.target])

  useEffect(() => {
    setSpot(null)
  }, [hint.target])

  return (
    <div className="tutorial-layer">
      {spot && (
        <div
          className="tutorial-ring"
          style={{
            left: spot.left - PADDING,
            top: spot.top - PADDING,
            width: spot.width + PADDING * 2,
            height: spot.height + PADDING * 2,
          }}
        />
      )}

      <div
        className={spot ? 'tutorial-card is-anchored' : 'tutorial-card'}
        style={spot ? { left: spot.left + spot.width / 2, top: cardTop(spot) } : undefined}
      >
        <BitmapLabel text={hint.title} size={30} align="center" />
        <BitmapLabel text={hint.body} size={17} align="center" />
        <button type="button" className="tutorial-skip text-button" onClick={onSkip}>
          <BitmapLabel text="SKIP" size={16} align="center" />
        </button>
      </div>
    </div>
  )
}

/**
 * 카드를 대상 위에 두되, 화면 밖으로 나가면 아래로 넘긴다.
 * 하단 바처럼 화면 끝에 붙은 대상은 위에, 상단 요소는 아래에 놓여야 둘 다 보인다.
 */
function cardTop(spot: Spot): number {
  const above = spot.top - CARD_GAP - CARD_HEIGHT
  if (above >= 12) return above

  const below = spot.top + spot.height + CARD_GAP
  return Math.min(below, STAGE_HEIGHT - CARD_HEIGHT - 12)
}
