import { useEffect, useRef, useState } from 'react'
import { GUI, PALETTE_COLORS } from '@/assets/manifest'
import { DrawingCanvas, type DrawingCanvasHandle } from '@/draw/DrawingCanvas'
import type { ExportedDrawing } from '@/draw/export'
import type { DrawTool } from '@/draw/history'
import type { TemplateId } from '@/domain/templates'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { PaletteMenu } from '@/ui/components/PaletteMenu'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

const CANVAS_DISPLAY = 400
const POPUP_WIDTH = 820
const POPUP_HEIGHT = 640

interface DrawModalProps {
  templateId: TemplateId
  onDone: (drawing: ExportedDrawing) => void
  onClose: () => void
}

const FIRST_COLOR = PALETTE_COLORS[0].hex

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

  const activeColorIcon =
    PALETTE_COLORS.find((c) => c.hex === color)?.icon ?? GUI.PENCIL

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
        <div className="draw-hint">
          <BitmapLabel text={tool === 'ERASER' ? 'ERASER' : 'PENCIL'} size={20} />
          <BitmapLabel text="DRAW YOUR ANIMAL FACING RIGHT" size={20} />
        </div>

        <div className="draw-layout">
        <DrawingCanvas
          ref={boardRef}
          tool={tool}
          color={color}
          templateId={templateId}
          displaySize={CANVAS_DISPLAY}
          onHistoryChange={setHistory}
        />

        <div className="draw-tools">
          <IconButton
            icon={tool === 'PENCIL' ? activeColorIcon : GUI.PENCIL}
            size={54}
            title="PENCIL"
            onClick={() => setTool('PENCIL')}
          />
          <div className="palette-anchor">
            <IconButton icon={GUI.PALETTE} size={54} title="PALETTE" onClick={() => setPaletteOpen((v) => !v)} />
            {paletteOpen && (
              <PaletteMenu selected={color} onSelect={setColor} onClose={() => setPaletteOpen(false)} />
            )}
          </div>
          <IconButton icon={GUI.ERASER} size={54} title="ERASER" onClick={() => setTool('ERASER')} />
          <IconButton
            icon={GUI.TRASH}
            size={54}
            title="CLEAR ALL"
            disabled={history.isEmpty}
            onClick={() => boardRef.current?.clearAll()}
          />
          <IconButton
            icon={GUI.UNDO}
            size={54}
            title="UNDO"
            disabled={!history.canUndo}
            onClick={() => boardRef.current?.undo()}
          />
          <IconButton
            icon={GUI.REDO}
            size={54}
            title="REDO"
            disabled={!history.canRedo}
            onClick={() => boardRef.current?.redo()}
          />
        </div>
        </div>

        {/*
          완성은 툴이 아니라 결정이다. 세로 툴바 맨 아래에 두었더니
          아이콘이 하나 늘 때마다 화면 밖으로 밀려 아예 보이지 않았다.
        */}
        <div className="draw-actions">
          <button
            type="button"
            className="labeled-button is-primary"
            disabled={history.isEmpty || busy}
            onClick={() => void finish()}
          >
            <IconGlyph icon={GUI.CONFIRM} size={40} />
            <BitmapLabel text="DONE" size={22} />
          </button>
        </div>
      </div>
    </Popup>
  )
}
