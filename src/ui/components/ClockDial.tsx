import { useEffect, useRef } from 'react'
import { CLOSE_HOUR, OPEN_HOUR } from '@/domain/clock'
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
 *
 * 지금은 캔버스로 그린다. GUI 시트에 시계 문자판이 들어오면
 * 이 컴포넌트의 배경만 그 스프라이트로 바꾸면 된다 — 바늘은 그대로 얹는다.
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

    const r = size / 2
    const face = r * 0.86

    // 문자판
    ctx.beginPath()
    ctx.arc(r, r, face, 0, Math.PI * 2)
    ctx.fillStyle = '#f4e6c4'
    ctx.fill()
    ctx.lineWidth = Math.max(2, size * 0.055)
    ctx.strokeStyle = '#8a5a2b'
    ctx.stroke()

    // 눈금. 운영 시간을 시간마다 하나씩 찍는다.
    const hours = CLOSE_HOUR - OPEN_HOUR
    ctx.strokeStyle = 'rgba(138, 90, 43, 0.55)'
    ctx.lineWidth = Math.max(1, size * 0.03)
    for (let i = 0; i < hours; i++) {
      const angle = (i / hours) * Math.PI * 2 - Math.PI / 2
      const inner = face * (i % 3 === 0 ? 0.7 : 0.82)
      ctx.beginPath()
      ctx.moveTo(r + Math.cos(angle) * inner, r + Math.sin(angle) * inner)
      ctx.lineTo(r + Math.cos(angle) * face * 0.94, r + Math.sin(angle) * face * 0.94)
      ctx.stroke()
    }

    // 바늘. 하루가 한 바퀴다.
    const progress = Math.min(1, Math.max(0, elapsed / DAY_DURATION_SEC))
    const angle = progress * Math.PI * 2 - Math.PI / 2

    ctx.strokeStyle = '#7a2f22'
    ctx.lineWidth = Math.max(2, size * 0.075)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(r, r)
    ctx.lineTo(r + Math.cos(angle) * face * 0.66, r + Math.sin(angle) * face * 0.66)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(r, r, Math.max(1.5, size * 0.055), 0, Math.PI * 2)
    ctx.fillStyle = '#7a2f22'
    ctx.fill()
  }, [elapsed, size])

  return <canvas ref={canvasRef} className="clock-dial" style={{ width: size, height: size }} />
}
