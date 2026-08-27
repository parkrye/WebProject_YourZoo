import { POPUP_FRAME_0, POPUP_INSET } from '@/assets/manifest'
import { clamp } from '@/core/math'

/** 코너를 원본 크기로 그렸을 때 자연스러워 보이는 팝업의 기준 크기. */
const REFERENCE_SIZE = 620
const MIN_FRAME_SCALE = 0.5
/**
 * 1을 넘기지 않는다. 큰 팝업에서 코너까지 키우면 테두리가 두꺼워지며
 * 내용 영역을 그만큼 잡아먹는다 — 실제로 요청서 양쪽 칸이 모두 넘쳤다.
 */
const MAX_FRAME_SCALE = 1

/**
 * 팝업 크기에 맞는 프레임 배율.
 *
 * 코너를 항상 원본 크기(92px)로 그리면 작은 팝업에서는 테두리가 내용을 잡아먹고
 * 큰 팝업에서는 상대적으로 빈약해 보인다. 짧은 변을 기준으로 코너까지 함께 키우고 줄인다.
 */
export function popupFrameScale(width: number, height: number): number {
  return clamp(Math.min(width, height) / REFERENCE_SIZE, MIN_FRAME_SCALE, MAX_FRAME_SCALE)
}

/** 프레임 배율을 반영한 내용 여백. 팝업 본문 padding 에 그대로 쓴다. */
export function popupInsetFor(width: number, height: number) {
  const scale = popupFrameScale(width, height)
  return {
    top: POPUP_INSET.top * scale,
    right: POPUP_INSET.right * scale,
    bottom: POPUP_INSET.bottom * scale,
    left: POPUP_INSET.left * scale,
  }
}

/**
 * 팝업 프레임 9-슬라이스.
 *
 * 팝업 시트의 프레임이 비정형이라 **직사각 프레임 0 하나만** 늘려 쓴다. (docs/02 R2)
 * 코너는 비율을 유지한 채 `popupFrameScale` 만큼 축소·확대되고, 가운데만 늘어난다.
 */
export function drawPopupFrame(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  const { sx, sy, sw, sh } = POPUP_FRAME_0
  const scale = popupFrameScale(dw, dh)

  const top = POPUP_INSET.top * scale
  const right = POPUP_INSET.right * scale
  const bottom = POPUP_INSET.bottom * scale
  const left = POPUP_INSET.left * scale

  const cw = sw - POPUP_INSET.left - POPUP_INSET.right
  const ch = sh - POPUP_INSET.top - POPUP_INSET.bottom
  const dcw = Math.max(0, dw - left - right)
  const dch = Math.max(0, dh - top - bottom)

  const put = (
    ssx: number, ssy: number, ssw: number, ssh: number,
    ddx: number, ddy: number, ddw: number, ddh: number,
  ): void => {
    if (ssw <= 0 || ssh <= 0 || ddw <= 0 || ddh <= 0) return
    ctx.drawImage(sheet, ssx, ssy, ssw, ssh, ddx, ddy, ddw, ddh)
  }

  const srcL = POPUP_INSET.left
  const srcR = POPUP_INSET.right
  const srcT = POPUP_INSET.top
  const srcB = POPUP_INSET.bottom

  // corners — 원본 비율 그대로, 크기만 scale
  put(sx, sy, srcL, srcT, dx, dy, left, top)
  put(sx + sw - srcR, sy, srcR, srcT, dx + dw - right, dy, right, top)
  put(sx, sy + sh - srcB, srcL, srcB, dx, dy + dh - bottom, left, bottom)
  put(sx + sw - srcR, sy + sh - srcB, srcR, srcB, dx + dw - right, dy + dh - bottom, right, bottom)

  // edges — 한 축만 늘어난다
  put(sx + srcL, sy, cw, srcT, dx + left, dy, dcw, top)
  put(sx + srcL, sy + sh - srcB, cw, srcB, dx + left, dy + dh - bottom, dcw, bottom)
  put(sx, sy + srcT, srcL, ch, dx, dy + top, left, dch)
  put(sx + sw - srcR, sy + srcT, srcR, ch, dx + dw - right, dy + top, right, dch)

  // center
  put(sx + srcL, sy + srcT, cw, ch, dx + left, dy + top, dcw, dch)
}
