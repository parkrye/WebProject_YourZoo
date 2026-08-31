import type { Animal } from '@/domain/animal'
import type { OwnedProp } from '@/domain/prop'
import { findSheet } from '@/domain/shop'
import { AnimalThumb } from './AnimalThumb'
import { PropThumb, SheetThumb } from './SpriteThumb'

interface AnimalItemThumbProps {
  animal: Animal
  size: number
}

/**
 * 동물 썸네일.
 *
 * 그린 동물은 IndexedDB 의 그림이지만 상점 동물은 **시트**다.
 * 어느 쪽이든 보여 주는 것은 하나로 맞춘다 — **IDLE 의 첫 칸.**
 * 시트를 통째로 줄이면 24칸이 한 덩어리로 뭉개져 무엇을 산 건지 알 수 없다.
 */
export function AnimalItemThumb({ animal, size }: AnimalItemThumbProps) {
  const meta = animal.spriteSheet
  const catalog = meta ? findSheet(meta.imageId.replace('sheet:', '')) : null
  // 상점 시트는 번들 이미지라 CSS 배경으로 자르는 편이 싸다.
  if (catalog) return <SheetThumb sheet={catalog} size={size} />
  // 직접 구운 시트는 IndexedDB 비트맵이다. 캔버스에서 첫 칸을 잘라 그린다.
  if (meta) return <AnimalThumb imageId={meta.imageId} size={size} sheet={meta} />
  return <AnimalThumb imageId={animal.imageId} size={size} />
}

interface PropItemThumbProps {
  prop: OwnedProp
  size: number
}

/** 프롭 썸네일. 상점 프롭은 시트 칸, 그린 프롭은 그림이다. */
export function PropItemThumb({ prop, size }: PropItemThumbProps) {
  if (prop.sheetBiome !== null && prop.sprite !== null) {
    return <PropThumb biome={prop.sheetBiome} sprite={prop.sprite} size={size} />
  }
  if (prop.imageId) return <AnimalThumb imageId={prop.imageId} size={size} />
  return <span className="sprite-thumb" style={{ width: size, height: size }} aria-hidden />
}
