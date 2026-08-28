import { useMemo, type CSSProperties } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { frameToBackgroundStyle } from '@/assets/atlas'
import { PROP_GRID, PROP_SRC, type BiomeId } from '@/assets/manifest'
import type { AnimalSheetAsset } from '@/assets/animalSheets'


interface PropThumbProps {
  biome: BiomeId
  sprite: number
  size: number
}

/** 프롭 시트의 한 칸. 상점 목록에서 무엇을 사는지 보여 준다. */
export function PropThumb({ biome, sprite, size }: PropThumbProps) {
  const style = useMemo<CSSProperties>(() => {
    const grid = PROP_GRID[biome]
    return frameToBackgroundStyle(
      PROP_SRC[biome], getAssets().prop[biome].frame(sprite), grid.sheetW, grid.sheetH, size, size,
    ) as CSSProperties
  }, [biome, sprite, size])

  return <span className="sprite-thumb" style={style} aria-hidden />
}

interface SheetThumbProps {
  sheet: AnimalSheetAsset
  size: number
}

/**
 * 동물 시트의 첫 칸(IDLE 0번 프레임).
 *
 * 시트를 통째로 줄여 넣으면 24칸이 한 덩어리로 뭉개진다.
 * 배경 위치를 옮겨 첫 칸만 창에 걸리게 한다 — 이미지 하나로 24칸을 다 들고 있으므로
 * 목록에 22종을 늘어놓아도 요청은 22건뿐이다.
 */
export function SheetThumb({ sheet, size }: SheetThumbProps) {
  const style = useMemo<CSSProperties>(() => {
    // 칸은 정사각이 아니다. 창을 칸 비율에 맞춰야 동물이 찌그러지지 않는다.
    const scale = Math.min(size / sheet.frameW, size / sheet.frameH)
    const w = sheet.frameW * scale
    const h = sheet.frameH * scale
    return {
      backgroundImage: `url(${sheet.src})`,
      backgroundSize: `${w * sheet.cols}px ${h * sheet.rows}px`,
      backgroundPosition: '0px 0px',
      backgroundRepeat: 'no-repeat',
      width: `${w}px`,
      height: `${h}px`,
    }
  }, [sheet, size])

  return <span className="sprite-thumb" style={style} aria-hidden />
}
