import { useEffect, useRef } from 'react'
import { guiSheet } from '@/assets/guiSheet'
import { CLOCK_FACE_CENTRE, CLOCK_HAND_PIVOT, CLOCK_HAND_REACH, GUI } from '@/assets/manifest'
import { DAY_DURATION_SEC } from '@/domain/balance'

interface ClockDialProps {
  /** 오늘 경과 초 (0 ~ DAY_DURATION_SEC). */
  elapsed: number
  size?: number
}

/**
 * 시곗바늘이 도는 시계.
 *
 * 숫자로 `14 00` 이라고 쓰면 읽어서 해석해야 하지만, 바늘은 **한눈에 지금이 어디쯤인지**
 * 보여 준다. 하루가 180초뿐이라 실제로 눈에 띄게 돈다는 점도 크다.
 *
 * 운영 시간(09~22시)만 도므로 12시간 시계가 아니라 **한 바퀴가 곧 하루**다.
 * 문 여는 시각이 12시 방향, 거기서 시계 방향으로 한 바퀴 돌면 문을 닫는다.
 */
export function ClockDial({ elapsed, size = 46 }: ClockDialProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const face = guiSheet(GUI.CLOCK_FACE)
    const hand = guiSheet(GUI.CLOCK_HAND)
    face.atlas.drawContained(ctx, face.index, 0, 0, size, size)

    /*
      바늘은 **아래쪽 구슬을 축으로** 돈다. 칸 한가운데로 돌리면 축이 문자판 중심에서
      벗어나 바늘이 원을 그리며 떠다닌다.

      두 아이콘은 각자 칸을 꽉 채우도록 그려져 있다. 그대로 같은 크기로 겹치면
      바늘이 문자판보다 커서 밖으로 뻗는다. 바늘 끝이 문자판 안에 들어오도록 줄인다.
    */
    const frame = hand.atlas.frame(hand.index)
    const handSize = (size * CLOCK_HAND_REACH) / CLOCK_HAND_PIVOT.y

    const progress = Math.min(1, Math.max(0, elapsed / DAY_DURATION_SEC))
    ctx.save()
    ctx.translate(size * CLOCK_FACE_CENTRE.x, size * CLOCK_FACE_CENTRE.y)
    ctx.rotate(progress * Math.PI * 2)
    ctx.drawImage(
      hand.atlas.image,
      frame.sx, frame.sy, frame.sw, frame.sh,
      -handSize * CLOCK_HAND_PIVOT.x, -handSize * CLOCK_HAND_PIVOT.y, handSize, handSize,
    )
    ctx.restore()
  }, [elapsed, size])

  return <canvas ref={canvasRef} className="clock-dial" style={{ width: size, height: size }} />
}
