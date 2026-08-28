/* 이 파일은 scripts/prepare-assets.py 가 생성한다. 직접 고치지 말 것. */
import type { Habitat } from './manifest'

import sheet0 from './images/animal/water-aligator.webp'
import sheet1 from './images/animal/water-beluga.webp'
import sheet2 from './images/animal/water-marlin.webp'
import sheet3 from './images/animal/water-penguin.webp'
import sheet4 from './images/animal/water-piranha.webp'
import sheet5 from './images/animal/water-shark.webp'
import sheet6 from './images/animal/water-turtle.webp'
import sheet7 from './images/animal/land-bear.webp'
import sheet8 from './images/animal/land-horse.webp'
import sheet9 from './images/animal/land-monkey.webp'
import sheet10 from './images/animal/land-orangutan.webp'
import sheet11 from './images/animal/land-polarbear.webp'
import sheet12 from './images/animal/land-rabbit.webp'
import sheet13 from './images/animal/land-tigger.webp'
import sheet14 from './images/animal/sky-butterfly.webp'
import sheet15 from './images/animal/sky-chicken.webp'
import sheet16 from './images/animal/sky-crow.webp'
import sheet17 from './images/animal/sky-dragonfly.webp'
import sheet18 from './images/animal/sky-parrot.webp'
import sheet19 from './images/animal/sky-peacock.webp'
import sheet20 from './images/animal/sky-pigeon.webp'
import sheet21 from './images/animal/sky-sparow.webp'

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
}

export const ANIMAL_SHEETS: readonly AnimalSheetAsset[] = [
  { id: 'ALIGATOR', habitat: 'WATER', src: sheet0, fit: 0.8182, baseline: 1.0, frameW: 233, frameH: 88, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'BELUGA', habitat: 'WATER', src: sheet1, fit: 0.5329, baseline: 1.0, frameW: 216, frameH: 152, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'MARLIN', habitat: 'WATER', src: sheet2, fit: 0.6287, baseline: 1.0, frameW: 226, frameH: 167, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'PENGUIN', habitat: 'WATER', src: sheet3, fit: 0.7317, baseline: 1.0, frameW: 213, frameH: 123, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'PIRANHA', habitat: 'WATER', src: sheet4, fit: 0.7606, baseline: 1.0, frameW: 212, frameH: 142, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'SHARK', habitat: 'WATER', src: sheet5, fit: 0.7241, baseline: 1.0, frameW: 217, frameH: 145, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'TURTLE', habitat: 'WATER', src: sheet6, fit: 0.6352, baseline: 1.0, frameW: 224, frameH: 159, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'BEAR', habitat: 'LAND', src: sheet7, fit: 0.678, baseline: 1.0, frameW: 218, frameH: 205, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'HORSE', habitat: 'LAND', src: sheet8, fit: 0.8102, baseline: 1.0, frameW: 223, frameH: 216, cols: 8, rows: 3, frames: [8, 7, 8] },
  { id: 'MONKEY', habitat: 'LAND', src: sheet9, fit: 0.9756, baseline: 1.0, frameW: 253, frameH: 164, cols: 8, rows: 3, frames: [8, 7, 8] },
  { id: 'ORANGUTAN', habitat: 'LAND', src: sheet10, fit: 0.6944, baseline: 1.0, frameW: 270, frameH: 216, cols: 8, rows: 3, frames: [8, 7, 8] },
  { id: 'POLARBEAR', habitat: 'LAND', src: sheet11, fit: 0.6452, baseline: 1.0, frameW: 213, frameH: 186, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'RABBIT', habitat: 'LAND', src: sheet12, fit: 0.9839, baseline: 1.0, frameW: 202, frameH: 186, cols: 8, rows: 3, frames: [8, 7, 8] },
  { id: 'TIGGER', habitat: 'LAND', src: sheet13, fit: 0.7308, baseline: 1.0, frameW: 267, frameH: 156, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'BUTTERFLY', habitat: 'SKY', src: sheet14, fit: 1.0, baseline: 1.0, frameW: 179, frameH: 163, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'CHICKEN', habitat: 'SKY', src: sheet15, fit: 1.0, baseline: 1.0, frameW: 233, frameH: 185, cols: 7, rows: 3, frames: [7, 7, 7] },
  { id: 'CROW', habitat: 'SKY', src: sheet16, fit: 1.0, baseline: 1.0, frameW: 252, frameH: 194, cols: 7, rows: 3, frames: [7, 7, 7] },
  { id: 'DRAGONFLY', habitat: 'SKY', src: sheet17, fit: 1.0, baseline: 1.0, frameW: 213, frameH: 136, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'PARROT', habitat: 'SKY', src: sheet18, fit: 0.855, baseline: 1.0, frameW: 231, frameH: 200, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'PEACOCK', habitat: 'SKY', src: sheet19, fit: 0.9412, baseline: 1.0, frameW: 275, frameH: 187, cols: 7, rows: 3, frames: [7, 7, 7] },
  { id: 'PIGEON', habitat: 'SKY', src: sheet20, fit: 0.9935, baseline: 1.0, frameW: 182, frameH: 153, cols: 8, rows: 3, frames: [8, 8, 8] },
  { id: 'SPAROW', habitat: 'SKY', src: sheet21, fit: 0.9209, baseline: 1.0, frameW: 231, frameH: 177, cols: 8, rows: 3, frames: [8, 8, 8] },
]
