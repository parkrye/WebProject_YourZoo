import { clamp } from '@/core/math'

export interface Camera {
  /** 배율. 1 이면 화면 전체가 보인다. */
  zoom: number
  /** 화면 중앙에 오는 지점 (정규화 좌표) */
  x: number
  y: number
}

export const ZOOM_LEVELS = [1, 1.4, 1.9, 2.5] as const
export const MIN_ZOOM = ZOOM_LEVELS[0]
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1] as number

export function createCamera(): Camera {
  return { zoom: 1, x: 0.5, y: 0.5 }
}

/** 화면 밖의 빈 공간이 보이지 않도록 중심점을 가둔다. */
export function clampCamera(camera: Camera): Camera {
  const half = 0.5 / camera.zoom
  return {
    zoom: clamp(camera.zoom, MIN_ZOOM, MAX_ZOOM),
    x: clamp(camera.x, half, 1 - half),
    y: clamp(camera.y, half, 1 - half),
  }
}

export function zoomStep(camera: Camera, direction: -1 | 1): Camera {
  const current = ZOOM_LEVELS.indexOf(camera.zoom as (typeof ZOOM_LEVELS)[number])
  const nearest =
    current >= 0
      ? current
      : ZOOM_LEVELS.reduce(
          (best, level, i) =>
            Math.abs(level - camera.zoom) < Math.abs((ZOOM_LEVELS[best] as number) - camera.zoom) ? i : best,
          0,
        )

  const next = clamp(nearest + direction, 0, ZOOM_LEVELS.length - 1)
  return clampCamera({ ...camera, zoom: ZOOM_LEVELS[next] as number })
}

/** 화면 픽셀 이동량을 정규화 이동량으로 바꿔 중심점을 옮긴다. */
export function panCamera(
  camera: Camera,
  dxPixels: number,
  dyPixels: number,
  viewWidth: number,
  viewHeight: number,
): Camera {
  return clampCamera({
    ...camera,
    x: camera.x - dxPixels / (viewWidth * camera.zoom),
    y: camera.y - dyPixels / (viewHeight * camera.zoom),
  })
}

/**
 * 논리 픽셀 좌표를 정규화 씬 좌표로 되돌린다.
 * 커서로 동물을 집을 때 쓴다. `applyCamera` 의 역함수여야 한다.
 */
export function screenToScene(
  camera: Camera,
  px: number,
  py: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: (px - width / 2 + camera.x * width * camera.zoom) / (camera.zoom * width),
    y: (py - height / 2 + camera.y * height * camera.zoom) / (camera.zoom * height),
  }
}

/**
 * 캔버스 변환 행렬에 카메라를 적용한다.
 * `offsetX` 는 화면 픽셀 단위 가로 이동으로, 우리 전환 슬라이드에 쓴다.
 */
export function applyCamera(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  width: number,
  height: number,
  offsetX = 0,
): void {
  ctx.setTransform(
    camera.zoom, 0, 0, camera.zoom,
    width / 2 - camera.x * width * camera.zoom + offsetX,
    height / 2 - camera.y * height * camera.zoom,
  )
}
