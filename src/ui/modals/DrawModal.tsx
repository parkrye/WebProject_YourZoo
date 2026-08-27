import { useEffect, useRef, useState } from 'react'
import { GUI, PALETTE_COLORS, type GuiIcon } from '@/assets/manifest'
import { DrawingCanvas, type DrawingCanvasHandle } from '@/draw/DrawingCanvas'
import type { ExportedDrawing } from '@/draw/export'
import type { DrawTool } from '@/draw/history'
import type { TemplateId } from '@/domain/templates'
import { useGameStore } from '@/store/gameStore'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { PaletteMenu } from '@/ui/components/PaletteMenu'
import { Popup } from '@/ui/components/Popup'

const CANVAS_DISPLAY = 420
const POPUP_WIDTH = 720
const POPUP_HEIGHT = 700

interface DrawModalProps {
  templateId: TemplateId
  onDone: (drawing: ExportedDrawing) => void
  onClose: () => void
}

const FIRST_COLOR = PALETTE_COLORS[0].hex

/**
 * 그림판.
 *
 * 도구는 **캔버스 위 가로 툴바**에 갈래별로 묶는다. 세로 한 줄로 늘어놓았더니
 * 도구가 하나 늘 때마다 아래쪽이 화면 밖으로 밀렸고, 어떤 버튼이 무슨 갈래인지도 읽히지 않았다.
 * 그리기 / 색 / 편집 세 묶음으로 나누고 완료는 따로 떼어 둔다.
 */
export function DrawModal({ templateId, onDone, onClose }: DrawModalProps) {
  const boardRef = useRef<DrawingCanvasHandle>(null)
  const [tool, setTool] = useState<DrawTool>('PENCIL')
  const [color, setColor] = useState<string>(FIRST_COLOR)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [history, setHistory] = useState({ canUndo: false, canRedo: false, isEmpty: true })
  const [busy, setBusy] = useState(false)

  // 그리는 동안에는 시계를 멈춘다. 한 장에 몇 분이 걸리기도 한다.
  useEffect(() => {
    useGameStore.getState().setDrawing(true)
    return () => useGameStore.getState().setDrawing(false)
  }, [])

  const activeColorIcon = PALETTE_COLORS.find((c) => c.hex === color)?.icon ?? GUI.PENCIL

  const finish = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    const result = await boardRef.current?.export()
    setBusy(false)
    if (!result) return
    onDone(result)
  }

  return (
    <Popup title="DRAW ANIMAL" width={POPUP_WIDTH} height={POPUP_HEIGHT} onClose={onClose}>
      <div className="draw-column">
        <div className="draw-toolbar">
          <div className="tool-group">
            <ToolButton
              icon={activeColorIcon}
              label="PENCIL"
              active={tool === 'PENCIL'}
              onClick={() => setTool('PENCIL')}
            />
            <ToolButton
              icon={GUI.MAP}
              label="FILL"
              active={tool === 'FILL'}
              onClick={() => setTool('FILL')}
            />
            <ToolButton
              icon={GUI.ERASER}
              label="ERASE"
              active={tool === 'ERASER'}
              onClick={() => setTool('ERASER')}
            />
          </div>

          <div className="tool-group palette-anchor">
            <ToolButton icon={GUI.PALETTE} label="COLOR" onClick={() => setPaletteOpen((v) => !v)} />
            <span className="color-chip" style={{ background: color }} />
            {paletteOpen && (
              <PaletteMenu selected={color} onSelect={setColor} onClose={() => setPaletteOpen(false)} />
            )}
          </div>

          <div className="tool-group">
            <ToolButton
              icon={GUI.UNDO}
              label="UNDO"
              disabled={!history.canUndo}
              onClick={() => boardRef.current?.undo()}
            />
            <ToolButton
              icon={GUI.REDO}
              label="REDO"
              disabled={!history.canRedo}
              onClick={() => boardRef.current?.redo()}
            />
            <ToolButton
              icon={GUI.TRASH}
              label="CLEAR"
              disabled={history.isEmpty}
              onClick={() => boardRef.current?.clearAll()}
            />
          </div>
        </div>

        <div className="draw-stage">
          <DrawingCanvas
            ref={boardRef}
            tool={tool}
            color={color}
            templateId={templateId}
            displaySize={CANVAS_DISPLAY}
            onHistoryChange={setHistory}
          />
        </div>

        <div className="draw-actions">
          <BitmapLabel text="DRAW YOUR ANIMAL FACING RIGHT" size={17} />
          <button
            type="button"
            className="labeled-button is-primary"
            disabled={history.isEmpty || busy}
            onClick={() => void finish()}
          >
            <IconGlyph icon={GUI.CONFIRM} size={38} />
            <BitmapLabel text="DONE" size={21} />
          </button>
        </div>
      </div>
    </Popup>
  )
}

interface ToolButtonProps {
  icon: GuiIcon
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function ToolButton({ icon, label, active = false, disabled = false, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={active ? 'tool-button is-active' : 'tool-button'}
      disabled={disabled}
      title={label}
      onClick={onClick}
    >
      <IconGlyph icon={icon} size={40} />
      <BitmapLabel text={label} size={13} align="center" />
    </button>
  )
}
