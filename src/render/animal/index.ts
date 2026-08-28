import type { Animal } from '@/domain/animal'
import { MOTION_PROFILES } from '@/domain/motion'
import { templateOf } from '@/domain/templates'
import { rigOf } from '@/domain/rig'
import type { AnimalRenderer } from './AnimalRenderer'
import { ProceduralRenderer } from './ProceduralRenderer'
import { RigRenderer } from './RigRenderer'
import { SheetRenderer } from './SheetRenderer'

export type { AnimalRenderer, AnimalRenderState, AnimalMotion, ViewBox } from './AnimalRenderer'
export { ProceduralRenderer } from './ProceduralRenderer'
export { RigRenderer } from './RigRenderer'
export { SheetRenderer } from './SheetRenderer'

/**
 * 동물 데이터에 맞는 렌더러를 고른다.
 *
 * `spriteSheet` 프레임 애니메이션. 칸마다 자세가 이미 그려져 있다
 * `rig`         파츠를 관절로 돌린다. 부위만 그리면 기계가 움직인다
 * 둘 다 없으면  단일 비트맵을 띠로 밀어 변형한다
 */
export function createAnimalRenderer(animal: Animal, bitmap: ImageBitmap): AnimalRenderer {
  if (animal.spriteSheet) return new SheetRenderer(bitmap, animal.spriteSheet)
  return new ProceduralRenderer(bitmap, MOTION_PROFILES[templateOf(animal.templateId).archetype])
}

/** 파츠가 모두 준비됐을 때 쓰는 리그 렌더러. */
export function createRigRenderer(
  animal: Animal,
  parts: ReadonlyMap<string, ImageBitmap>,
): AnimalRenderer {
  return new RigRenderer(rigOf(templateOf(animal.templateId).archetype), parts)
}
