/* 이 파일은 scripts/prepare-assets.py 가 생성한다. 직접 고치지 말 것. */
import type { Habitat } from './manifest'

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

export const ANIMAL_SHEETS: readonly AnimalSheetAsset[] = []
