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
 * 시트를 통째로 줄이면 24칸이 한 덩어리로 뭉개지므로 첫 칸만 잘라 보여 준다.
 */
export function AnimalItemThumb({ animal, size }: AnimalItemThumbProps) {
  const sheet = animal.spriteSheet ? findSheet(animal.spriteSheet.imageId.replace('sheet:', '')) : null
  if (sheet) return <SheetThumb sheet={sheet} size={size} />
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
