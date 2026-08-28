import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { GuideShape } from '@/domain/templates'
import { TemplateGuide } from './TemplateGuide'
import { DrawHistory, drawStroke, type DrawTool, type StrokeCommand } from './history'
import { exportDrawing, type ExportedDrawing } from './export'

/**
 * 그림판 논리 해상도. 정사각으로 두면 향후 8×3 시트 변환 시 프레임 규격을 잡기 쉽다.
 *
 * 그림은 **오른쪽을 보고 있는 것으로 간주**한다. 렌더러가 왼쪽으로 이동할 때만
 * 좌우를 뒤집으므로, 플레이어가 왼쪽을 보게 그리면 이동 방향과 어긋난다.
 */
export const DRAW_SIZE = 512

const PENCIL_WIDTH = 10
const ERASER_WIDTH = 34
/** 이 거리보다 가까운 포인터 이동은 버린다. 점이 과하게 촘촘해지는 걸 막는다. */
const MIN_POINT_DISTANCE = 2

export interface DrawingCanvasHandle {
  undo(): void
  redo(): void
  clearAll(): void
  export(): Promise<ExportedDrawing | null>
}

interface DrawingCanvasProps {
  tool: DrawTool
  color: string
  /** 바탕에 깔릴 가이드. 그림 데이터에는 섞이지 않는다. */
  guide: readonly GuideShape[]
  /** 방향 안내를 띄울지. 밑그림이 없을 때만 쓴다. */
  showFacingHint: boolean
  /**
   * 앞 칸을 옅게 깔아 준다 (어니언 스킨).
   *
   * 걷기처럼 조금씩 달라지는 동작을 맨 캔버스에서 이어 그리는 건 사실상 불가능하다.
   * 캔버스 **뒤** 레이어라 내보낸 PNG 에는 섞이지 않는다.
   */
  onionUrl?: string | undefined
  /** 이미 그린 칸을 다시 열 때의 시작 그림. */
  initial?: Blob | undefined
  /** 화면 표시 크기(px). 논리 해상도와 무관하게 자유롭게 잡는다. */
  displaySize: number
  /** undo/redo 버튼 활성화 상태를 부모에 알린다. */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean; isEmpty: boolean }) => void
}

export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(function DrawingCanvas(
  { tool, color, guide, showFacingHint, onionUrl, initial, displaySize, onHistoryChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef(new DrawHistory(DRAW_SIZE, DRAW_SIZE))
  const strokeRef = useRef<StrokeCommand | null>(null)
  const [, bump] = useState(0)

  const context = (): CanvasRenderingContext2D | null =>
    canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null

  const notify = (): void => {
    const h = historyRef.current
    onHistoryChange?.({ canUndo: h.canUndo, canRedo: h.canRedo, isEmpty: h.isEmpty })
    bump((n) => n + 1)
  }

  useEffect(notify, [])

  // 다시 여는 칸은 그린 그림 위에서 시작한다. 빈 캔버스가 뜨면 지운 줄 안다.
  useEffect(() => {
    if (!initial) return
    let cancelled = false
    void createImageBitmap(initial).then((bitmap) => {
      const ctx = context()
      if (cancelled || !ctx) return
      historyRef.current.setBaseline(bitmap)
      historyRef.current.replay(ctx)
      notify()
    })
    return () => {
      cancelled = true
    }
  }, [initial])

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (!historyRef.current.undo()) return
      replay()
      notify()
    },
    redo: () => {
      if (!historyRef.current.redo()) return
      replay()
      notify()
    },
    clearAll: () => {
      historyRef.current.push({ kind: 'CLEAR' })
      replay()
      notify()
    },
    export: async () => {
      const canvas = canvasRef.current
      if (!canvas) return null
      return exportDrawing(canvas)
    },
  }))

  const replay = (): void => {
    const ctx = context()
    if (!ctx) return
    historyRef.current.replay(ctx)
  }

  const toLocal = (event: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect()
    // Stage 가 CSS transform 으로 축소되어 있어도 getBoundingClientRect 가 반영해 준다.
    return [
      ((event.clientX - rect.left) / rect.width) * DRAW_SIZE,
      ((event.clientY - rect.top) / rect.height) * DRAW_SIZE,
    ]
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.button !== 0) return
    const [x, y] = toLocal(event)

    // 페인트통은 한 번의 클릭으로 끝난다. 끌 게 없으니 스트로크를 시작하지 않는다.
    if (tool === 'FILL') {
      historyRef.current.push({ kind: 'FILL', x, y, color })
      replay()
      notify()
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    strokeRef.current = {
      kind: 'STROKE',
      tool,
      color,
      width: tool === 'ERASER' ? ERASER_WIDTH : PENCIL_WIDTH,
      points: [x, y],
    }
    redrawLiveStroke()
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const stroke = strokeRef.current
    if (!stroke) return

    const [x, y] = toLocal(event)
    const lastX = stroke.points[stroke.points.length - 2] as number
    const lastY = stroke.points[stroke.points.length - 1] as number
    if (Math.hypot(x - lastX, y - lastY) < MIN_POINT_DISTANCE) return

    stroke.points.push(x, y)
    redrawLiveStroke()
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const stroke = strokeRef.current
    if (!stroke) return
    strokeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    historyRef.current.push(stroke)
    replay()
    notify()
  }

  /**
   * 그리는 중에는 확정된 히스토리를 다시 깔고 진행 중인 스트로크만 덧그린다.
   * 이렇게 해야 이차 베지어 스무딩이 매 프레임 일관되게 적용된다.
   */
  const redrawLiveStroke = (): void => {
    const ctx = context()
    const stroke = strokeRef.current
    if (!ctx || !stroke) return
    historyRef.current.replay(ctx)
    drawStroke(ctx, stroke)
  }

  return (
    // 가이드는 캔버스 뒤 DOM 레이어다. 캔버스에 직접 그리면 내보낸 PNG 에 섞여 들어간다.
    <div className="drawing-board" style={{ width: displaySize, height: displaySize }}>
      {/* 템플릿 가이드가 이미 방향을 알려 주므로 화살표는 FREE 일 때만 띄운다. */}
      {showFacingHint && (
        <div className="drawing-guide" aria-hidden>
          <span className="drawing-guide-arrow" />
          <span className="drawing-guide-text">FACING RIGHT</span>
        </div>
      )}
      {onionUrl && <img src={onionUrl} alt="" className="drawing-onion" aria-hidden />}
      <TemplateGuide guide={guide} size={displaySize} />
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        width={DRAW_SIZE}
        height={DRAW_SIZE}
        style={{ width: displaySize, height: displaySize }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  )
})
