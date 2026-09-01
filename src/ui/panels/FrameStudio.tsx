import { useEffect, useMemo, useState } from 'react'
import { GUI } from '@/assets/manifest'
import type { GuideShape } from '@/domain/templates'
import type { ExportedDrawing } from '@/draw/export'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { DrawModal } from '@/ui/modals/DrawModal'

export interface FrameRow {
  /** 줄 이름. 동물은 IDLE/MOVE/SIGNATURE, 프롭은 한 줄뿐이라 비워 둔다. */
  readonly label: string
  readonly count: number
}

interface FrameStudioProps {
  rows: readonly FrameRow[]
  /** 칸별 그림. 길이는 모든 줄의 칸 수를 합친 것과 같다. */
  frames: readonly (ExportedDrawing | null)[]
  onChange: (index: number, drawing: ExportedDrawing) => void
  /** 밑그림. 상세 그리기에서도 템플릿을 깔 수 있다. */
  guide: readonly GuideShape[]
}

/**
 * 여러 칸을 그리는 화면.
 *
 * 칸을 한 번에 하나씩만 연다 — 24칸을 동시에 편집할 방법은 없고,
 * 있다 해도 화면에 다 들어가지 않는다. 목록은 **어디까지 그렸는지 보여 주는 용도**다.
 *
 * 앞 칸을 밑그림으로 깔아 준다(어니언 스킨). 걷기처럼 조금씩 달라지는 동작을
 * 맨 캔버스에서 이어 그리는 건 사실상 불가능하다.
 */
export function FrameStudio({ rows, frames, onChange, guide }: FrameStudioProps) {
  const [editing, setEditing] = useState<number | null>(null)

  const total = useMemo(() => rows.reduce((n, r) => n + r.count, 0), [rows])
  const drawn = frames.filter(Boolean).length

  // 칸을 지우고 줄었을 때 열린 칸이 범위를 벗어나면 닫는다.
  useEffect(() => {
    if (editing !== null && editing >= total) setEditing(null)
  }, [editing, total])

  /** 이 칸을 그릴 때 뒤에 깔아 줄 그림. 바로 앞 칸이다. */
  const onionFor = (index: number): ExportedDrawing | null => {
    for (let i = index - 1; i >= 0; i--) {
      const frame = frames[i]
      if (frame) return frame
    }
    return null
  }

  let offset = 0
  return (
    <div className="studio">
      <div className="studio-head">
        <BitmapLabel text={`${drawn} OF ${total} FRAMES`} size={20} />
        <BitmapLabel text="EMPTY FRAMES REUSE THE ONE BEFORE" size={14} />
      </div>

      <div className="studio-rows">
        {rows.map((row) => {
          const start = offset
          offset += row.count
          return (
            <div key={row.label || 'STRIP'} className="studio-row">
              {row.label && <BitmapLabel text={row.label} size={16} />}
              <div className="studio-cells">
                {Array.from({ length: row.count }, (_, i) => {
                  const index = start + i
                  return (
                    <FrameCell
                      key={index}
                      index={index}
                      drawing={frames[index] ?? null}
                      onOpen={() => setEditing(index)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {editing !== null && (
        <DrawModal
          title={`FRAME ${editing + 1}`}
          // 칸이 바뀌면 캔버스도 새로 시작한다. 어니언 스킨은 뒤 레이어라
          // 이것 없이는 앞 칸 그림이 캔버스에 그대로 남아 PNG 에 섞인다.
          sessionKey={editing}
          guide={guide}
          {...(onionFor(editing) && { onion: onionFor(editing)!.blob })}
          {...(frames[editing] && { initial: frames[editing]!.blob })}
          onClose={() => setEditing(null)}
          onDone={(result) => {
            onChange(editing, result)
            // 이어서 다음 칸을 연다. 한 칸 그릴 때마다 목록으로 돌아가면 24번을 오간다.
            setEditing(editing + 1 < total ? editing + 1 : null)
          }}
        />
      )}
    </div>
  )
}

interface FrameCellProps {
  index: number
  drawing: ExportedDrawing | null
  onOpen: () => void
}

function FrameCell({ index, drawing, onOpen }: FrameCellProps) {
  const url = useMemo(() => (drawing ? URL.createObjectURL(drawing.blob) : null), [drawing])
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  return (
    <button
      type="button"
      className={drawing ? 'studio-cell is-drawn' : 'studio-cell'}
      onClick={onOpen}
    >
      {url ? (
        <img src={url} alt="" className="studio-cell-art" />
      ) : (
        <IconGlyph icon={GUI.PENCIL} size={20} />
      )}
      <span className="studio-cell-index">
        <BitmapLabel text={`${index + 1}`} size={11} />
      </span>
    </button>
  )
}

/** 상세 그리기를 마쳤는지. 한 칸도 없으면 만들 수 없다. */
export function hasAnyFrame(frames: readonly (ExportedDrawing | null)[]): boolean {
  return frames.some(Boolean)
}

/** 목록 위에 놓는 되돌리기 버튼 묶음. 지금은 전체 지우기만 있다. */
export function StudioActions({ onClear }: { onClear: () => void }) {
  return (
    <div className="studio-actions">
      <IconButton icon={GUI.TRASH} size={40} title="CLEAR ALL" onClick={onClear} />
    </div>
  )
}
