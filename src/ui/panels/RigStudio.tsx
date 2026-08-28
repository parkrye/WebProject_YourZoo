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
export function RigStudio({ spec, parts, onChange }: RigStudioProps) {
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
        {/*
          지도에는 파츠 밑그림만 깐다. 템플릿 실루엣까지 함께 그리면 같은 자리에
          두 겹이 겹쳐 무엇이 어느 부위인지 오히려 안 보인다 —
          파츠 밑그림을 다 모으면 그게 곧 그 실루엣이다.
        */}
        <div className="rig-map">
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
              {/*
                아직 안 그린 자리에는 밑그림을 띄운다. 빈 상자만 늘어놓으면
                어느 것이 다리이고 어느 것이 꼬리인지 이름을 읽어야 안다.
                슬롯은 파츠 상자 비율이라, 같은 좌표가 여기서는 완성됐을 때의 모습이 된다.
              */}
              {parts[part.id]
                ? <PartArt drawing={parts[part.id] ?? null} />
                : <RigGuide guide={part.guide} />}
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
          guide={editing.guide}
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
      {guide.map((shape, i) => {
        if (shape.kind === 'ELLIPSE') {
          return <ellipse key={i} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} />
        }
        const points = shape.points.map(([x, y]) => `${x},${y}`).join(' ')
        // 닫힌 도형은 polygon 이어야 한다. polyline 으로 그리면 마지막 변이 빠져
        // 다리와 몸통이 한쪽이 터진 채로 보인다.
        return shape.closed
          ? <polygon key={i} points={points} />
          : <polyline key={i} points={points} />
      })}
    </svg>
  )
}
