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

  /**
   * 늘어나는 부분은 **타일링**한다.
   *
   * 원본 센터는 386×160 뿐인데 큰 팝업에서는 1000×700 까지 늘어난다.
   * 4배 이상 확대하면 종이 질감이 그대로 뭉개져 흐릿한 얼룩이 된다.
   * 작은 패치를 반복해 채우면 원본 해상도가 유지된다.
   */
  const tile = (
    ssx: number, ssy: number, ssw: number, ssh: number,
    ddx: number, ddy: number, ddw: number, ddh: number,
    repeat: 'repeat' | 'repeat-x' | 'repeat-y',
  ): void => {
    if (ssw <= 0 || ssh <= 0 || ddw <= 0 || ddh <= 0) return

    const patch = patchOf(sheet, ssx, ssy, ssw, ssh)
    const pattern = ctx.createPattern(patch, repeat)
    if (!pattern) {
      put(ssx, ssy, ssw, ssh, ddx, ddy, ddw, ddh)
      return
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(ddx, ddy, ddw, ddh)
    ctx.clip()
    ctx.translate(ddx, ddy)
    // 한 축만 반복하는 엣지는 나머지 축을 목표 크기에 맞춰 늘린다.
    if (repeat === 'repeat-x') ctx.scale(1, ddh / ssh)
    if (repeat === 'repeat-y') ctx.scale(ddw / ssw, 1)
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, repeat === 'repeat-x' ? ddw : ddw, repeat === 'repeat-y' ? ddh : ddh)
    ctx.restore()
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

  // 상·하 엣지는 **늘린다**. 상단 나무 바 한가운데에 발바닥 엠블럼이 박혀 있어서
  // 가로로 타일링하면 엠블럼이 서너 개로 복제된다. 나무결은 늘려도 티가 나지 않는다.
  put(sx + srcL, sy, cw, srcT, dx + left, dy, dcw, top)
  put(sx + srcL, sy + sh - srcB, cw, srcB, dx + left, dy + dh - bottom, dcw, bottom)

  // 좌·우 엣지는 반복 가능한 나무 기둥이라 타일링해도 이음매가 보이지 않는다.
  tile(sx, sy + srcT, srcL, ch, dx, dy + top, left, dch, 'repeat-y')
  tile(sx + sw - srcR, sy + srcT, srcR, ch, dx + dw - right, dy + top, right, dch, 'repeat-y')

  // center — 종이 질감을 원본 해상도로 반복해 채운다
  tile(sx + srcL, sy + srcT, cw, ch, dx + left, dy + top, dcw, dch, 'repeat')
}


/**
 * 시트의 한 조각을 떼어낸 캔버스. `createPattern` 은 이미지 전체를 반복하므로
 * 조각을 먼저 잘라 두어야 한다. 같은 조각은 재사용한다.
 */
const patchCache = new Map<string, HTMLCanvasElement>()

function patchOf(
  sheet: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): HTMLCanvasElement {
  const key = `${sx},${sy},${sw},${sh}`
  const cached = patchCache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw))
  canvas.height = Math.max(1, Math.round(sh))
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

  patchCache.set(key, canvas)
  return canvas
}
