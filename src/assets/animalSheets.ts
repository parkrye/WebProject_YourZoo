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
}

export const ANIMAL_SHEETS: readonly AnimalSheetAsset[] = [
  { id: 'ALIGATOR', habitat: 'WATER', src: sheet0, fit: 0.3429, baseline: 1.0, frameW: 211, frameH: 210 },
  { id: 'BELUGA', habitat: 'WATER', src: sheet1, fit: 0.2989, baseline: 1.0, frameW: 155, frameH: 220 },
  { id: 'MARLIN', habitat: 'WATER', src: sheet2, fit: 0.4626, baseline: 1.0, frameW: 214, frameH: 220 },
  { id: 'PENGUIN', habitat: 'WATER', src: sheet3, fit: 0.4663, baseline: 1.0, frameW: 167, frameH: 193 },
  { id: 'PIRANHA', habitat: 'WATER', src: sheet4, fit: 0.5023, baseline: 1.0, frameW: 214, frameH: 215 },
  { id: 'SHARK', habitat: 'WATER', src: sheet5, fit: 0.5072, baseline: 1.0, frameW: 196, frameH: 207 },
  { id: 'TURTLE', habitat: 'WATER', src: sheet6, fit: 0.4226, baseline: 1.0, frameW: 169, frameH: 220 },
  { id: 'BEAR', habitat: 'LAND', src: sheet7, fit: 0.5792, baseline: 1.0, frameW: 173, frameH: 220 },
  { id: 'HORSE', habitat: 'LAND', src: sheet8, fit: 0.7, baseline: 1.0, frameW: 260, frameH: 220 },
  { id: 'MONKEY', habitat: 'LAND', src: sheet9, fit: 0.5861, baseline: 1.0, frameW: 171, frameH: 220 },
  { id: 'ORANGUTAN', habitat: 'LAND', src: sheet10, fit: 0.6122, baseline: 1.0, frameW: 172, frameH: 220 },
  { id: 'POLARBEAR', habitat: 'LAND', src: sheet11, fit: 0.4938, baseline: 1.0, frameW: 181, frameH: 220 },
  { id: 'RABBIT', habitat: 'LAND', src: sheet12, fit: 0.7176, baseline: 1.0, frameW: 175, frameH: 220 },
  { id: 'TIGGER', habitat: 'LAND', src: sheet13, fit: 0.5022, baseline: 1.0, frameW: 208, frameH: 220 },
  { id: 'BUTTERFLY', habitat: 'SKY', src: sheet14, fit: 0.6849, baseline: 1.0, frameW: 142, frameH: 220 },
  { id: 'CHICKEN', habitat: 'SKY', src: sheet15, fit: 0.7227, baseline: 1.0, frameW: 184, frameH: 220 },
  { id: 'CROW', habitat: 'SKY', src: sheet16, fit: 0.8622, baseline: 1.0, frameW: 204, frameH: 220 },
  { id: 'DRAGONFLY', habitat: 'SKY', src: sheet17, fit: 0.7514, baseline: 1.0, frameW: 177, frameH: 181 },
  { id: 'PARROT', habitat: 'SKY', src: sheet18, fit: 0.8221, baseline: 1.0, frameW: 188, frameH: 208 },
  { id: 'PEACOCK', habitat: 'SKY', src: sheet19, fit: 0.6667, baseline: 1.0, frameW: 181, frameH: 220 },
  { id: 'PIGEON', habitat: 'SKY', src: sheet20, fit: 0.5914, baseline: 1.0, frameW: 130, frameH: 220 },
  { id: 'SPAROW', habitat: 'SKY', src: sheet21, fit: 0.6653, baseline: 1.0, frameW: 154, frameH: 220 },
]
