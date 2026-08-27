import { POPUP_FRAME_0, POPUP_INSET } from '@/assets/manifest'

/**
 * 팝업 프레임 9-슬라이스.
 *
 * 팝업 시트는 배경이 불투명하고 프레임이 비정형이라 컷아웃 실패 리스크가 있다.
 * 그래서 1차 구현은 **직사각 프레임 0 하나만** 9-슬라이스로 늘려 쓴다. (docs/02 R2)
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
  const { top, right, bottom, left } = POPUP_INSET

  const cw = sw - left - right
  const ch = sh - top - bottom
  const dcw = Math.max(0, dw - left - right)
  const dch = Math.max(0, dh - top - bottom)

  const put = (
    ssx: number, ssy: number, ssw: number, ssh: number,
    ddx: number, ddy: number, ddw: number, ddh: number,
  ): void => {
    if (ssw <= 0 || ssh <= 0 || ddw <= 0 || ddh <= 0) return
    ctx.drawImage(sheet, ssx, ssy, ssw, ssh, ddx, ddy, ddw, ddh)
  }

  // corners
  put(sx, sy, left, top, dx, dy, left, top)
  put(sx + sw - right, sy, right, top, dx + dw - right, dy, right, top)
  put(sx, sy + sh - bottom, left, bottom, dx, dy + dh - bottom, left, bottom)
  put(sx + sw - right, sy + sh - bottom, right, bottom, dx + dw - right, dy + dh - bottom, right, bottom)

  // edges
  put(sx + left, sy, cw, top, dx + left, dy, dcw, top)
  put(sx + left, sy + sh - bottom, cw, bottom, dx + left, dy + dh - bottom, dcw, bottom)
  put(sx, sy + top, left, ch, dx, dy + top, left, dch)
  put(sx + sw - right, sy + top, right, ch, dx + dw - right, dy + top, right, dch)

  // center
  put(sx + left, sy + top, cw, ch, dx + left, dy + top, dcw, dch)
}
