import { useRef, useState } from 'react'
import { GUI, PALETTE_COLORS } from '@/assets/manifest'
import { DrawingCanvas, type DrawingCanvasHandle } from '@/draw/DrawingCanvas'
import type { ExportedDrawing } from '@/draw/export'
import type { DrawTool } from '@/draw/history'
import type { TemplateId } from '@/domain/templates'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { PaletteMenu } from '@/ui/components/PaletteMenu'
import { Popup } from '@/ui/components/Popup'

const CANVAS_DISPLAY = 430
const POPUP_WIDTH = 900
const POPUP_HEIGHT = 720

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
            size={62}
            title="PENCIL"
            onClick={() => setTool('PENCIL')}
          />
          <div className="palette-anchor">
            <IconButton icon={GUI.PALETTE} size={62} title="PALETTE" onClick={() => setPaletteOpen((v) => !v)} />
            {paletteOpen && (
              <PaletteMenu selected={color} onSelect={setColor} onClose={() => setPaletteOpen(false)} />
            )}
          </div>
          <IconButton icon={GUI.ERASER} size={62} title="ERASER" onClick={() => setTool('ERASER')} />
          <IconButton
            icon={GUI.TRASH}
            size={62}
            title="CLEAR ALL"
            disabled={history.isEmpty}
            onClick={() => boardRef.current?.clearAll()}
          />
          <IconButton
            icon={GUI.UNDO}
            size={62}
            title="UNDO"
            disabled={!history.canUndo}
            onClick={() => boardRef.current?.undo()}
          />
          <IconButton
            icon={GUI.REDO}
            size={62}
            title="REDO"
            disabled={!history.canRedo}
            onClick={() => boardRef.current?.redo()}
          />
          <div className="draw-tools-spacer" />
          <IconButton
            icon={GUI.CONFIRM}
            size={72}
            title="DONE"
            disabled={history.isEmpty || busy}
            onClick={() => void finish()}
          />
        </div>
      </div>

      <div className="draw-hint">
        <BitmapLabel text={tool === 'ERASER' ? 'ERASER' : 'PENCIL'} size={22} />
        <BitmapLabel text="DRAW YOUR ANIMAL FACING RIGHT" size={20} />
      </div>
    </Popup>
  )
}
