import type { Animal } from '@/domain/animal'
import { templateOf } from '@/domain/templates'
import type { AnimalRenderer } from './AnimalRenderer'
import { ProceduralRenderer } from './ProceduralRenderer'
import { SheetRenderer } from './SheetRenderer'

export type { AnimalRenderer, AnimalRenderState, AnimalMotion, ViewBox } from './AnimalRenderer'
export { ProceduralRenderer } from './ProceduralRenderer'
export { SheetRenderer } from './SheetRenderer'

/**
 * 동물 데이터에 맞는 렌더러를 고른다.
 * `spriteSheet` 가 있으면 프레임 애니메이션, 없으면 단일 비트맵 절차적 변형.
 */
export function createAnimalRenderer(animal: Animal, bitmap: ImageBitmap): AnimalRenderer {
  if (animal.spriteSheet) return new SheetRenderer(bitmap, animal.spriteSheet)
  return new ProceduralRenderer(bitmap, templateOf(animal.templateId).motion)
}
