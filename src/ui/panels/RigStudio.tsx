import { useEffect, useMemo, useState } from 'react'
import { GUI } from '@/assets/manifest'
import type { RigPart, RigSpec } from '@/domain/rig'
import type { GuideShape } from '@/domain/templates'
import type { ExportedDrawing } from '@/draw/export'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { DrawModal } from '@/ui/modals/DrawModal'

interface RigStudioProps {
  spec: RigSpec
  parts: Record<string, ExportedDrawing>
  onChange: (partId: string, drawing: ExportedDrawing) => void
  /** 템플릿 실루엣. 어느 부위를 그리는 중인지 알려 주는 밑그림이다. */
  guide: readonly GuideShape[]
}

/**
 * 부위별로 그리는 화면.
 *
 * 왼쪽에 **부위가 어디쯤 붙는지** 그림으로 보여 준다. "FAR ARM" 이라는 말만으로는
 * 그게 화면 어느 자리에 얼마만 한 크기로 들어가는지 알 수 없다.
 *
 * 그릴 때는 그 부위의 상자만 크게 띄운다 — 다리를 그리는데 몸 전체 캔버스를 주면
 * 어디에 그려야 할지 몰라 가운데에 그리게 되고, 그러면 관절이 엉뚱한 데서 돈다.
 */
export function RigStudio({ spec, parts, onChange, guide }: RigStudioProps) {
  const [editing, setEditing] = useState<RigPart | null>(null)

  const ordered = useMemo(() => [...spec.parts].sort((a, b) => a.z - b.z), [spec])
  const drawn = ordered.filter((p) => parts[p.id]).length

  return (
    <div className="rig">
      <div className="rig-head">
        <BitmapLabel text={`${drawn} OF ${ordered.length} PARTS`} size={20} />
        <BitmapLabel text="JOINTS MOVE THEM FOR YOU" size={14} />
      </div>

      <div className="rig-body">
        {/* 부위가 어디 붙는지 보여 주는 지도. 고르는 자리이기도 하다. */}
        <div className="rig-map">
          {guide.length > 0 && <RigGuide guide={guide} />}
          {ordered.map((part) => (
            <button
              key={part.id}
              type="button"
              className={parts[part.id] ? 'rig-slot is-drawn' : 'rig-slot'}
              style={{
                left: `${(part.cx - part.w / 2) * 100}%`,
                top: `${(part.cy - part.h / 2) * 100}%`,
                width: `${part.w * 100}%`,
                height: `${part.h * 100}%`,
              }}
              onClick={() => setEditing(part)}
            >
              <PartArt drawing={parts[part.id] ?? null} />
              {/* 회전축을 점으로 찍는다. 여기를 중심으로 돈다는 걸 보여 준다. */}
              <span
                className="rig-pivot"
                style={{ left: `${part.px * 100}%`, top: `${part.py * 100}%` }}
              />
            </button>
          ))}
        </div>

        <div className="rig-list">
          {ordered.map((part) => (
            <button
              key={part.id}
              type="button"
              className={parts[part.id] ? 'rig-row is-drawn' : 'rig-row'}
              onClick={() => setEditing(part)}
            >
              <IconGlyph icon={parts[part.id] ? GUI.CONFIRM : GUI.PENCIL} size={22} />
              <BitmapLabel text={part.label} size={16} />
            </button>
          ))}
        </div>
      </div>

      {editing && (
        <DrawModal
          title={`DRAW ${editing.label}`}
          guide={[]}
          {...(parts[editing.id] && { initial: parts[editing.id]!.blob })}
          onClose={() => setEditing(null)}
          onDone={(result) => {
            onChange(editing.id, result)
            // 이어서 아직 안 그린 다음 부위를 연다. 목록으로 매번 돌아갈 이유가 없다.
            const next = ordered.find((p) => p.id !== editing.id && !parts[p.id])
            setEditing(next ?? null)
          }}
        />
      )}
    </div>
  )
}

function PartArt({ drawing }: { drawing: ExportedDrawing | null }) {
  const url = useMemo(() => (drawing ? URL.createObjectURL(drawing.blob) : null), [drawing])
  useEffect(() => {
    if (!url) return
    return () => URL.revokeObjectURL(url)
  }, [url])

  if (!url) return null
  return <img src={url} alt="" className="rig-slot-art" />
}

/** 지도 바탕에 깔리는 템플릿 실루엣. 어느 부위가 어디인지 가늠하게 해 준다. */
function RigGuide({ guide }: { guide: readonly GuideShape[] }) {
  return (
    <svg className="rig-guide" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
      {guide.map((shape, i) =>
        shape.kind === 'ELLIPSE' ? (
          <ellipse key={i} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
        ) : (
          <polyline
            key={i}
            points={shape.points.map(([x, y]) => `${x},${y}`).join(' ')}
            {...(shape.closed ? { className: 'is-closed' } : {})}
          />
        ),
      )}
    </svg>
  )
}
