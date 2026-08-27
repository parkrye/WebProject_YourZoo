import {
  LOGICAL_HEIGHT, LOGICAL_WIDTH, PROP_COUNT, PROP_HEIGHT,
  PROP_LAND_INDICES, PROP_WATER_INDICES, ROAM_BOX,
  type BiomeId, type Habitat,
} from '@/assets/manifest'
import { createRng, randRange, type Rng } from '@/core/rng'

export interface PlacedProp {
  /** 프롭 시트 인덱스 */
  readonly sprite: number
  readonly x: number
  readonly y: number
  /** 화면 높이 대비 정규화 높이 */
  readonly height: number
  /** 동물이 침범하지 못하는 반경 (정규화 x) */
  readonly radius: number
  readonly layer: Habitat
}

/** 바이옴마다 고정 배치. 우리를 넘겼다 돌아와도 같은 자리에 있어야 한다. */
const BIOME_SEED: Record<BiomeId, number> = {
  FIELD: 0x5f1e1d,
  DESERT: 0xd3a071,
  ICE: 0x1c8fe3,
}

const MIN_SEPARATION = 0.13
const ASPECT = LOGICAL_HEIGHT / LOGICAL_WIDTH

export function generateProps(biome: BiomeId): PlacedProp[] {
  const rng = createRng(BIOME_SEED[biome])
  return [
    ...placeLayer(rng, 'LAND', PROP_LAND_INDICES, PROP_COUNT.LAND, PROP_HEIGHT.LAND),
    ...placeLayer(rng, 'WATER', PROP_WATER_INDICES, PROP_COUNT.WATER, PROP_HEIGHT.WATER),
  ]
}

function placeLayer(
  rng: Rng,
  layer: Habitat,
  sprites: readonly number[],
  count: number,
  height: number,
): PlacedProp[] {
  const box = ROAM_BOX[layer]
  const placed: PlacedProp[] = []
  const pool = [...sprites]

  for (let i = 0; i < count && pool.length > 0; i++) {
    const spriteIndex = Math.floor(rng() * pool.length)
    const sprite = pool.splice(spriteIndex, 1)[0]
    if (sprite === undefined) break

    const spot = findSpot(rng, box.x0, box.x1, box.y0, box.y1, placed)
    placed.push({
      sprite,
      x: spot.x,
      y: spot.y,
      height,
      // 프롭 발밑 회피 반경. 화면 비율 때문에 정규화 x 로 환산해야 원이 된다.
      radius: height * ASPECT * 0.34,
      layer,
    })
  }

  return placed
}

/** 서로 겹치지 않는 자리를 찾는다. 못 찾으면 마지막 후보를 그냥 쓴다. */
function findSpot(
  rng: Rng,
  x0: number, x1: number, y0: number, y1: number,
  placed: readonly PlacedProp[],
): { x: number; y: number } {
  let candidate = { x: 0, y: 0 }

  for (let attempt = 0; attempt < 12; attempt++) {
    candidate = { x: randRange(rng, x0 + 0.05, x1 - 0.05), y: randRange(rng, y0, y1) }
    const tooClose = placed.some((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) < MIN_SEPARATION)
    if (!tooClose) return candidate
  }

  return candidate
}
