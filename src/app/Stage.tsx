import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@/assets/manifest'

interface StageProps {
  children: ReactNode
}

/**
 * 논리 해상도 1672×941 을 화면에 letterbox(contain) 로 배치한다.
 * canvas 와 UI DOM 이 **같은 변환**을 받으므로 픽셀 정합이 자동으로 맞는다.
 */
export function Stage({ children }: StageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const fit = (): void => {
      const { clientWidth, clientHeight } = host
      setScale(Math.min(clientWidth / LOGICAL_WIDTH, clientHeight / LOGICAL_HEIGHT))
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div ref={hostRef} className="stage-host">
      <div
        className="stage-view"
        style={{
          width: LOGICAL_WIDTH,
          height: LOGICAL_HEIGHT,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
