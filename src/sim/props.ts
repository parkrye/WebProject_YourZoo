import { LOGICAL_HEIGHT, LOGICAL_WIDTH, PROP_HEIGHT, ROAM_BOX, type BiomeId, type Habitat } from '@/assets/manifest'
import type { OwnedProp } from '@/domain/prop'

export interface PlacedProp {
  /** 소유 프롭의 id. 상세보기에서 집어낼 때 쓴다. */
  readonly id: string
  /** 프롭 시트 인덱스. 그린 프롭은 null. */
  readonly sprite: number | null
  /** 어느 바이옴 시트에서 온 칸인가. 우리를 옮겨 놓아도 원래 시트로 그린다. */
  readonly sheetBiome: BiomeId | null
  /** 그린 프롭의 IndexedDB 키. 상점 프롭은 null. */
  readonly imageId: string | null
  readonly x: number
  readonly y: number
  /** 화면 높이 대비 정규화 높이 */
  readonly height: number
  /** 동물이 침범하지 못하는 반경 (정규화 x) */
  readonly radius: number
  readonly layer: Habitat
  /** 물에 뜬 프롭의 흔들림 위상. 전부 같은 박자로 움직이면 기계적으로 보인다. */
  readonly bobPhase: number
}

const ASPECT = LOGICAL_HEIGHT / LOGICAL_WIDTH

/**
 * 소유 프롭을 시뮬레이션이 쓰는 형태로 옮긴다.
 *
 * 예전에는 바이옴 시드로 **절차적으로 흩뿌렸다.** 지금은 플레이어가 상점에서 사서
 * 직접 놓는다 — 우리를 꾸미는 일이 놀이가 되려면 배치가 플레이어의 손에 있어야 한다.
 *
 * 흔들림 위상은 id 에서 뽑는다. 전부 같은 박자로 출렁이면 기계적으로 보이는데,
 * 난수로 두면 프레임마다 값이 달라져 프롭이 덜덜 떨린다.
 */
export function toPlacedProps(owned: readonly OwnedProp[]): PlacedProp[] {
  return owned.map((prop) => {
    const height = PROP_HEIGHT[prop.layer === 'WATER' ? 'WATER' : 'LAND']
    return {
      id: prop.id,
      sprite: prop.sprite,
      sheetBiome: prop.sheetBiome,
      imageId: prop.imageId,
      x: prop.x,
      y: prop.y,
      height,
      bobPhase: (hash(prop.id) % 1000) / 1000 * Math.PI * 2,
      // 프롭 발밑 회피 반경. 화면 비율 때문에 정규화 x 로 환산해야 원이 된다.
      radius: height * ASPECT * 0.34,
      layer: prop.layer,
    }
  })
}

function hash(text: string): number {
  let value = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

/** 물에 뜬 프롭의 상하 진폭(정규화 y)과 주기. 배와 뗏목이 잔물결에 흔들리는 정도. */
export const PROP_BOB = { amplitude: 0.006, speed: 1.5, tilt: 0.035 } as const

/** 하늘에 매단 프롭의 좌우 진폭(정규화 x)과 주기. 바람에 천천히 밀리는 정도. */
export const PROP_SWAY = { amplitude: 0.008, speed: 0.9, tilt: 0.05 } as const

/**
 * 프롭이 그려질 깊이 층.
 *
 * 예전에는 만들 때 고른 `layer` 로 정했지만, 이제 프롭은 어디에나 놓을 수 있다.
 * 하늘에 놓은 통나무가 땅 동물보다 앞에 그려지면 안 되므로 **놓인 높이**로 정한다.
 */
export function propBand(y: number): Habitat {
  if (y <= ROAM_BOX.LAND.y0) return 'SKY'
  if (y <= ROAM_BOX.WATER.y0) return 'LAND'
  return 'WATER'
}
