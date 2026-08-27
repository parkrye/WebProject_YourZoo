import type { AnimalMotion } from '@/domain/animal'

export type { AnimalMotion }

export interface ViewBox {
  width: number
  height: number
}

export interface AnimalRenderState {
  /** 정규화 좌표. y 는 동물의 발밑(수면/지면 접점). */
  x: number
  y: number
  facing: 1 | -1
  motion: AnimalMotion
  /** 해당 모션에 들어간 뒤 경과 시간(초) */
  motionTime: number
  /** 현재 속도 / 최대 속도 */
  speed01: number
  /** 원근을 반영한 최종 높이(정규화) */
  scale: number
}

/**
 * 동물 렌더 전략.
 *
 * 지금은 플레이어가 그린 **단일 비트맵**을 절차적으로 변형해 움직인다.
 * 추후 외부 SDK 가 그림 1장 → 8프레임 × 3모션 시트를 만들어 주면
 * `SheetRenderer` 로 **교체만** 하면 되도록 인터페이스를 분리해 둔다.
 *
 * 시뮬레이션(`AnimalAgent`)이 이미 `motion` 을 상태로 들고 있으므로
 * 마이그레이션 비용은 사실상 렌더러 교체뿐이다.
 *
 * @see docs/02-architecture.md §3.1
 */
export interface AnimalRenderer {
  draw(ctx: CanvasRenderingContext2D, state: AnimalRenderState, view: ViewBox): void
}
