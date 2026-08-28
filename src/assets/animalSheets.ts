/* 이 파일은 scripts/prepare-assets.py 가 생성한다. 직접 고치지 말 것. */
import type { Habitat } from './manifest'
import type { AnimalMotion } from '@/domain/animal'

import sheet0 from './images/animal/land-bear.webp'
import sheet1 from './images/animal/water-beluga.webp'
import sheet2 from './images/animal/land-orangutan.webp'
import sheet3 from './images/animal/sky-parrot.webp'
import sheet4 from './images/animal/sky-peacock.webp'
import sheet5 from './images/animal/water-shark.webp'

export interface AnimalSheetAsset {
  readonly id: string
  readonly habitat: Habitat
  readonly src: string
  /** 프레임 높이 대비 서 있는 자세의 높이 */
  readonly fit: number
  /** 프레임 안에서 발이 놓이는 y (0..1) */
  readonly baseline: number
  /** 칸 하나의 픽셀 크기. 썸네일 비율을 맞출 때 쓴다. */
  readonly frameW: number
  readonly frameH: number
  /** 격자 크기. 시트마다 다르다 — 닭과 까마귀와 공작은 7칸이다. */
  readonly cols: number
  readonly rows: number
  /** 줄마다의 실제 프레임 수. 한 시트 안에서도 다르다 — 말은 8/7/8 이다. */
  readonly frames: readonly number[]
  /** 줄 순서에 대응하는 모션. 시그니처가 없는 시트는 두 줄이다. */
  readonly motions: readonly AnimalMotion[]
}

export const ANIMAL_SHEETS: readonly AnimalSheetAsset[] = [
  { id: 'BEAR', habitat: 'LAND', src: sheet0, fit: 1.0, baseline: 1.0, frameW: 256, frameH: 219, cols: 8, rows: 2, frames: [8, 8], motions: ['IDLE', 'MOVE'] },
  { id: 'BELUGA', habitat: 'WATER', src: sheet1, fit: 0.9826, baseline: 0.9999, frameW: 223, frameH: 115, cols: 8, rows: 2, frames: [8, 8], motions: ['IDLE', 'MOVE'] },
  { id: 'ORANGUTAN', habitat: 'LAND', src: sheet2, fit: 1.0, baseline: 1.0, frameW: 227, frameH: 220, cols: 8, rows: 2, frames: [8, 8], motions: ['IDLE', 'MOVE'] },
  { id: 'PARROT', habitat: 'SKY', src: sheet3, fit: 0.8664, baseline: 0.9357, frameW: 243, frameH: 220, cols: 8, rows: 2, frames: [8, 8], motions: ['IDLE', 'MOVE'] },
  { id: 'PEACOCK', habitat: 'SKY', src: sheet4, fit: 0.9615, baseline: 0.972, frameW: 252, frameH: 208, cols: 8, rows: 2, frames: [8, 8], motions: ['IDLE', 'MOVE'] },
  { id: 'SHARK', habitat: 'WATER', src: sheet5, fit: 0.9161, baseline: 0.9161, frameW: 240, frameH: 155, cols: 8, rows: 2, frames: [8, 8], motions: ['IDLE', 'MOVE'] },
]
