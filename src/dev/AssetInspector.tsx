import { useEffect, useRef } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { FONT_CHARS, GUI_GRID } from '@/assets/manifest'
import { drawPopupFrame } from '@/render/NineSlice'

/**
 * 개발용 검증 페이지. `?dev=assets` 로 진입한다.
 *
 * 이 프로젝트의 두 급소를 눈으로 확인하기 위한 것:
 *   1. 폰트 시트 알파 컷아웃이 제대로 됐는가 (docs/02 R1)
 *   2. GUI 아이콘 36개 슬라이싱이 셀 경계와 맞는가
 *   3. 팝업 9-슬라이스가 임의 크기에서 깨지지 않는가 (docs/02 R2)
 */
export function AssetInspector() {
  const fontRef = useRef<HTMLCanvasElement>(null)
  const popupRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const { font, fontSheet, popup } = getAssets()

    const fc = fontRef.current
    if (fc) {
      const ctx = fc.getContext('2d')
      if (ctx) {
        // 컷아웃 결과가 투명한지 보이도록 체커보드를 깐다.
        drawChecker(ctx, fc.width, fc.height)
        font.draw(ctx, 'ABCDEFGHIJKLM', 20, 20, { size: 56 })
        font.draw(ctx, 'NOPQRSTUVWXYZ', 20, 100, { size: 56 })
        font.draw(ctx, '0123456789', 20, 180, { size: 56 })
        font.draw(ctx, 'DAY 12 GOLD 1200 FAME 340', 20, 260, { size: 34 })
        font.draw(ctx, 'CENTERED TEXT', fc.width / 2, 320, { size: 40, align: 'center' })
      }
    }

    const pc = popupRef.current
    if (pc) {
      const ctx = pc.getContext('2d')
      if (ctx) {
        drawChecker(ctx, pc.width, pc.height)
        drawPopupFrame(ctx, popup, 10, 10, 380, 240)
        drawPopupFrame(ctx, popup, 410, 10, 620, 300)
        drawPopupFrame(ctx, popup, 10, 270, 380, 320)
      }
    }

    void fontSheet
  }, [])

  const { gui, fontSheet, visitor } = getAssets()

  return (
    <div style={PAGE}>
      <h2 style={H2}>1. FONT — 글자 외곽선이 온전한지, 배경이 투명한지 (R1)</h2>
      <canvas ref={fontRef} width={1000} height={380} style={CANVAS} />

      <h2 style={H2}>2. FONT SHEET (원본)</h2>
      <img src={fontSheet.src} alt="font sheet" style={{ ...CANVAS, width: 320 }} />

      <h2 style={H2}>3. GUI ICONS — 36 cells, 경계 잘림 확인</h2>
      <div style={GRID}>
        {Array.from({ length: gui.count }, (_, i) => (
          <IconCell key={i} index={i} />
        ))}
      </div>

      <h2 style={H2}>4. POPUP 9-SLICE — 임의 크기 3종 (R2)</h2>
      <canvas ref={popupRef} width={1040} height={600} style={CANVAS} />

      <h2 style={H2}>5. VISITORS — 검은 배경 컷아웃 확인 (원본에 알파 없음)</h2>
      <div style={{ ...GRID, gridTemplateColumns: 'repeat(16, 1fr)' }}>
        {Array.from({ length: visitor.count }, (_, i) => (
          <VisitorCell key={i} index={i} />
        ))}
      </div>
    </div>
  )
}

function IconCell({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    drawChecker(ctx, c.width, c.height)
    getAssets().gui.draw(ctx, index, 0, 0, c.width, c.height)
  }, [index])
  return (
    <div style={CELL}>
      <canvas ref={ref} width={72} height={72} />
      <span style={CELL_LABEL}>{index}</span>
    </div>
  )
}

function VisitorCell({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    drawChecker(ctx, c.width, c.height)
    getAssets().visitor.drawContained(ctx, index, 0, 0, c.width, c.height)
  }, [index])
  return <canvas ref={ref} width={60} height={60} />
}

function drawChecker(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const size = 12
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#3a3a3a' : '#4a4a4a'
      ctx.fillRect(x, y, size, size)
    }
  }
}

const PAGE = { padding: 24, color: '#ddd', font: '13px ui-monospace, monospace' } as const
const H2 = { fontSize: 14, margin: '28px 0 10px', color: '#d9a441' } as const
const CANVAS = { border: '1px solid #555', display: 'block' } as const
const GRID = { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, maxWidth: 1040 } as const
const CELL = { position: 'relative' } as const
const CELL_LABEL = { position: 'absolute', bottom: 0, right: 2, fontSize: 10, color: '#ff0' } as const

void FONT_CHARS
void GUI_GRID
