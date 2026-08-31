import { getAssets } from '@/assets/AssetStore'
import {
  LOGICAL_HEIGHT, LOGICAL_WIDTH, ROAM_BOX, VISITOR_HEIGHT,
  type BiomeId, type Habitat,
} from '@/assets/manifest'
import { easeInOutCubic } from '@/core/math'
import { phaseBlend, timeLighting, type AreaLight, type FenceLight } from '@/domain/clock'
import type { AnimalAgent } from '@/sim/AnimalAgent'
import type { EnclosureSim } from '@/sim/EnclosureSim'
import { ensureBitmap, getBitmap } from '@/sim/imageCache'
import { propBand, PROP_BOB, PROP_SWAY, type PlacedProp } from '@/sim/props'
import type { VisitorAgent } from '@/sim/VisitorAgent'
import type { ViewBox } from './animal'
import { applyCamera, type Camera } from './camera'

export interface SceneInput {
  sim: EnclosureSim
  /** 오늘 경과 초 */
  elapsed: number
  /** 펜스 Y 오프셋 (화면 높이 비율). 상세보기에서 펜스를 내린다. */
  fenceOffset: number
  /** 상세보기 확대·팬. 우리 화면에서는 zoom 1, 중심 0.5. */
  camera: Camera
  /** 커서로 집은 동물. 발밑에 링을 그린다. */
  selectedId?: string | null
  /** 우리를 넘기는 중이면 두 씬을 나란히 밀어 보여준다. */
  transition?: EnclosureTransition | null
  /** 창고에서 무언가를 끌고 있는 중이면 놓을 수 있는 곳을 보여 준다. */
  dropGuide?: DropGuide | null
}

/**
 * 배치 안내.
 *
 * 끌어온 것이 **어디에 들어갈 수 있는지**를 점선으로 알려 준다.
 * 로밍 박스는 코드에만 있고 배경 그림에는 경계가 없어, 물가 잔디 위에 놓았다가
 * 거절당하는 일이 잦았다. 놓기 전에 보여 주면 될 일이다.
 */
export interface DropGuide {
  /** 들어갈 수 있는 서식지. `null` 이면 어디든 된다 — 프롭이 그렇다. */
  habitat: Habitat | null
  /** 정원이 찼거나 자리가 없어 어디에도 놓을 수 없는 상태. 전부 빨갛게 그린다. */
  blocked?: boolean
}

export interface EnclosureTransition {
  /** 빠져나가는 우리 */
  from: EnclosureSim
  /** 1 이면 새 우리가 오른쪽에서 들어온다. */
  direction: 1 | -1
  /** 0..1 */
  progress: number
}

/** y 정렬 대상. 프롭과 동물이 같은 목록에서 섞인다. */
type Drawable =
  | { kind: 'PROP'; y: number; prop: PlacedProp }
  | { kind: 'ANIMAL'; y: number; agent: AnimalAgent }

/**
 * 우리 화면의 레이어 합성.
 *
 * z0 하늘 → z1 바이옴 → z2 하늘동물 → z3 땅프롭+땅동물 → z4 물프롭+물동물
 * → z5 펜스 → z6 손님   (docs/01-assets.md §3)
 *
 * **손님은 펜스보다 앞이다.** 뒤에 그리면 펜스 안쪽에 서 있는 꼴이 되어
 * 관람객이 우리에 갇힌 것처럼 보인다. 관람객은 난간 이쪽 편에 서 있어야 한다.
 *
 * z3·z4 는 프롭과 동물을 **하나의 목록으로 합쳐 y 오름차순 정렬**해 그린다.
 * 그래야 동물이 프롭 뒤로 지나갈 때 프롭에 가려진다.
 */
export class SceneRenderer {
  private readonly buffer: Drawable[] = []
  private selectedId: string | null = null
  private time = 0
  private layer: HTMLCanvasElement | null = null
  private mask: HTMLCanvasElement | null = null
  private readonly visitorOrder: VisitorAgent[] = []

  draw(ctx: CanvasRenderingContext2D, input: SceneInput): void {
    const view: ViewBox = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT }

    // 카메라 변환 밖에서 지워야 확대 상태에서도 화면 전체가 깨끗해진다.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, view.width, view.height)
    this.selectedId = input.selectedId ?? null
    this.time = input.elapsed

    const transition = input.transition
    if (!transition) {
      this.drawScene(ctx, input.sim, input, view, 0)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      return
    }

    // 나가는 우리와 들어오는 우리를 화면 폭만큼 벌려 함께 민다.
    const eased = easeInOutCubic(transition.progress)
    const shift = transition.direction * view.width
    this.drawScene(ctx, transition.from, input, view, -eased * shift)
    this.drawScene(ctx, input.sim, input, view, (1 - eased) * shift)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  private drawScene(
    ctx: CanvasRenderingContext2D,
    sim: EnclosureSim,
    input: SceneInput,
    view: ViewBox,
    offsetX: number,
  ): void {
    applyCamera(ctx, input.camera, view.width, view.height, offsetX)

    const light = timeLighting(input.elapsed)

    this.drawSky(ctx, input.elapsed, view)
    // 하늘은 시간대 이미지가 이미 다르다. 밝기만 살짝 얹는다.
    dim(ctx, view, light.sky.brightness)

    ctx.drawImage(getAssets().area[sim.biome], 0, 0, view.width, view.height)
    // 하늘도 같은 패스를 쓴다. 예전에는 동물만 그려서 **하늘에 매단 프롭이 사라졌다.**
    this.drawSortedLayer(ctx, sim, 'SKY', view)
    this.drawSortedLayer(ctx, sim, 'LAND', view)
    this.drawSortedLayer(ctx, sim, 'WATER', view)
    this.drawAreaLight(ctx, light.area, view)

    // 안내선은 조명 뒤에 그린다. 밤에 같이 어두워지면 알려 주는 구실을 못 한다.
    if (input.dropGuide) this.drawDropGuide(ctx, input.dropGuide, view)

    // 울타리와 손님은 따로 그려 조명을 세게 먹인다.
    // 화면 전체에 걸면 관찰 대상인 우리 안까지 같이 어두워진다.
    this.drawFenceLayer(ctx, sim, light.fence, input.fenceOffset, view)
  }

  /**
   * 놓을 수 있는 곳과 없는 곳.
   *
   * 세 서식지의 로밍 박스를 모두 그린다. **되는 곳만 그리면** 나머지가 왜 안 되는지
   * 알 수 없고, 물처럼 화면 아래쪽에 있는 영역은 아예 있는 줄도 모른다.
   */
  private drawDropGuide(ctx: CanvasRenderingContext2D, guide: DropGuide, view: ViewBox): void {
    const { font } = getAssets()

    ctx.save()
    ctx.lineWidth = GUIDE_LINE_WIDTH
    ctx.setLineDash(GUIDE_DASH)
    for (const habitat of GUIDE_ORDER) {
      const box = ROAM_BOX[habitat]
      const ok = !guide.blocked && (guide.habitat === null || guide.habitat === habitat)
      const x = box.x0 * view.width
      const y = box.y0 * view.height
      const w = (box.x1 - box.x0) * view.width
      const h = (box.y1 - box.y0) * view.height

      ctx.fillStyle = ok ? GUIDE_OK_FILL : GUIDE_NO_FILL
      ctx.strokeStyle = ok ? GUIDE_OK_LINE : GUIDE_NO_LINE
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
      // 이름을 붙여 둔다. 색만으로는 어느 칸이 무엇인지 알 수 없다.
      font.draw(ctx, habitat, x + GUIDE_LABEL_PAD, y + GUIDE_LABEL_PAD, { size: GUIDE_LABEL_SIZE })
    }
    ctx.restore()
  }

  /**
   * 우리 안쪽 조명.
   *
   * 밝기와 색을 **약하게만** 얹는다. 여기는 플레이어가 들여다보는 곳이라
   * 시간에 맞춰 어두워지되 형체는 남아야 한다.
   * 그 위에 **몇 군데를 비추는 조명**을 얹어, 어두울수록 빛 웅덩이가 도드라지게 한다.
   */
  private drawAreaLight(ctx: CanvasRenderingContext2D, light: AreaLight, view: ViewBox): void {
    dim(ctx, view, light.brightness)
    if (light.tintAlpha > 0) fill(ctx, view, 'multiply', light.tint, light.tintAlpha)
    if (light.spotAlpha <= 0) return

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const spot of AREA_SPOTS) {
      const r = spot.radius * view.width

      // 바닥에 깔리는 빛은 원이 아니라 납작한 타원이다. 원으로 두면 안개처럼 뜬다.
      ctx.save()
      ctx.translate(spot.x * view.width, spot.y * view.height)
      ctx.scale(1, SPOT_FLATTEN)

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
      gradient.addColorStop(0, light.spotColor)
      gradient.addColorStop(0.3, light.spotColor)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')

      ctx.globalAlpha = light.spotAlpha * spot.strength
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    ctx.restore()
  }

  /**
   * 울타리와 손님을 별도 레이어에 그린 뒤 조명을 입혀 합성한다.
   * 덕분에 울타리 모양대로만 색이 먹고 뒤의 우리는 건드리지 않는다.
   *
   * 조명은 `multiply` 로 얹는다. 빛의 색은 어둡게만 만들어야 하고,
   * `source-atop` 은 밝게도 만들어 울타리가 우리 안보다 환해진다.
   *
   * 다만 `multiply` 는 이름과 달리 **투명한 픽셀을 불투명하게 만든다** —
   * 블렌드 모드의 합성 연산자는 여전히 `source-over` 라, 빈 곳은 곱해질 대상이 없어
   * 칠한 색이 그대로 남는다. 실제로 밝기를 alpha 1 로 곱했다가 레이어 전체가
   * 불투명해져 화면을 통째로 덮은 적이 있다.
   * 그래서 칠하기 전에 알파 마스크를 떠 두었다가 `destination-in` 으로 되돌린다.
   */
  private drawFenceLayer(
    ctx: CanvasRenderingContext2D,
    sim: EnclosureSim,
    light: FenceLight,
    fenceOffset: number,
    view: ViewBox,
  ): void {
    const layer = this.fenceLayer(view)
    const lctx = layer.getContext('2d')
    if (!lctx) return

    lctx.setTransform(1, 0, 0, 1, 0, 0)
    lctx.clearRect(0, 0, view.width, view.height)
    lctx.drawImage(getAssets().fence, 0, fenceOffset * view.height, view.width, view.height)
    this.drawVisitors(lctx, sim.visitors, fenceOffset, view)

    const lit = light.tintAlpha > 0 || light.brightness < 1
    if (lit) {
      const mask = this.fenceMask(view)
      const mctx = mask.getContext('2d')
      if (mctx) {
        mctx.setTransform(1, 0, 0, 1, 0, 0)
        mctx.globalCompositeOperation = 'copy'
        mctx.drawImage(layer, 0, 0)
      }

      lctx.globalCompositeOperation = 'multiply'
      if (light.tintAlpha > 0) {
        lctx.globalAlpha = light.tintAlpha
        lctx.fillStyle = light.tint
        lctx.fillRect(0, 0, view.width, view.height)
      }
      if (light.brightness < 1) {
        const v = Math.round(light.brightness * 255)
        lctx.globalAlpha = 1
        lctx.fillStyle = `rgb(${v},${v},${v})`
        lctx.fillRect(0, 0, view.width, view.height)
      }

      // 곱연산이 불투명하게 만들어 버린 빈 곳을 원래 알파로 되돌린다.
      lctx.globalCompositeOperation = 'destination-in'
      lctx.globalAlpha = 1
      lctx.drawImage(mask, 0, 0)
    }
    lctx.globalCompositeOperation = 'source-over'
    lctx.globalAlpha = 1

    ctx.drawImage(layer, 0, 0)
  }

  /** 울타리 레이어는 한 번만 만들어 재사용한다. 프레임마다 캔버스를 새로 만들 이유가 없다. */
  private fenceLayer(view: ViewBox): HTMLCanvasElement {
    if (!this.layer) this.layer = blankCanvas(view)
    return this.layer
  }

  /** 조명을 먹이기 전 알파를 떠 두는 곳. 역시 한 번만 만든다. */
  private fenceMask(view: ViewBox): HTMLCanvasElement {
    if (!this.mask) this.mask = blankCanvas(view)
    return this.mask
  }

  private drawSky(ctx: CanvasRenderingContext2D, elapsed: number, view: ViewBox): void {
    const { sky } = getAssets()
    const blend = phaseBlend(elapsed)

    ctx.globalAlpha = 1
    ctx.drawImage(sky[blend.from], 0, 0, view.width, view.height)

    if (blend.t <= 0) return
    ctx.globalAlpha = blend.t
    ctx.drawImage(sky[blend.to], 0, 0, view.width, view.height)
    ctx.globalAlpha = 1
  }

  private drawSortedLayer(
    ctx: CanvasRenderingContext2D,
    sim: EnclosureSim,
    layer: Habitat,
    view: ViewBox,
  ): void {
    // 프레임마다 배열을 새로 만들면 GC 압력이 커진다. 하나를 비워 재사용한다.
    this.buffer.length = 0

    // 프롭은 만들 때 고른 거동과 무관하게 **놓인 높이**로 층이 정해진다.
    // 하늘에 매단 통나무가 땅 동물보다 앞에 오면 안 된다.
    for (const prop of sim.props) {
      if (propBand(prop.y) === layer) this.buffer.push({ kind: 'PROP', y: prop.y, prop })
    }
    for (const agent of sim.animals) {
      if (agent.habitat === layer) this.buffer.push({ kind: 'ANIMAL', y: agent.y, agent })
    }

    this.buffer.sort(byDepth)

    for (const item of this.buffer) {
      if (item.kind === 'PROP') {
        this.drawProp(ctx, sim.biome, item.prop, view)
        continue
      }
      this.drawAgent(ctx, item.agent, view)
    }
  }

  private drawAgent(ctx: CanvasRenderingContext2D, agent: AnimalAgent, view: ViewBox): void {
    if (!agent.renderer) return
    const state = agent.toRenderState()
    if (agent.id === this.selectedId) this.drawSelectionRing(ctx, agent, state.scale, view)
    agent.renderer.draw(ctx, state, view)
  }

  /** 선택 표시. 동물을 가리지 않도록 발밑에 납작한 링만 그린다. */
  private drawSelectionRing(
    ctx: CanvasRenderingContext2D,
    agent: AnimalAgent,
    scale: number,
    view: ViewBox,
  ): void {
    const box = agent.hitBox
    const radiusX = ((box.right - box.left) / 2) * view.width
    ctx.save()
    ctx.translate(agent.x * view.width, agent.y * view.height)
    ctx.strokeStyle = '#ffd766'
    ctx.lineWidth = Math.max(2, scale * view.height * 0.03)
    ctx.beginPath()
    ctx.ellipse(0, 0, Math.max(12, radiusX * 0.62), Math.max(5, radiusX * 0.24), 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  /**
   * 프롭 하나.
   *
   * 상점 프롭은 바이옴 시트의 한 칸이고, 그린 프롭은 IndexedDB 의 비트맵이다.
   * 시트는 **산 곳의 시트**로 그린다 — 사막 바위를 얼음 우리에 놓아도 사막 바위여야 한다.
   */
  private drawProp(
    ctx: CanvasRenderingContext2D,
    biome: BiomeId,
    prop: PlacedProp,
    view: ViewBox,
  ): void {
    const paint = this.propPainter(prop, biome)
    if (!paint) return

    const height = prop.height * view.height
    const width = height * paint.aspect
    const x = prop.x * view.width
    const y = prop.y * view.height

    // 땅 프롭은 가만히 있는다.
    if (prop.layer === 'LAND') {
      paint.draw(ctx, x - width / 2, y - height, width, height)
      return
    }

    // 물은 위아래로 뜨고, 하늘은 좌우로 밀린다. 흔들리는 축만 다르고 방식은 같다.
    const water = prop.layer === 'WATER'
    const spec = water ? PROP_BOB : PROP_SWAY
    const wave = this.time * spec.speed + prop.bobPhase
    const offset = Math.sin(wave) * spec.amplitude

    ctx.save()
    ctx.translate(
      x + (water ? 0 : offset * view.width),
      y + (water ? offset * view.height : 0),
    )
    ctx.rotate(Math.sin(wave * 0.7) * spec.tilt)
    paint.draw(ctx, -width / 2, -height, width, height)
    ctx.restore()
  }

  private propPainter(prop: PlacedProp, biome: BiomeId): PropPainter | null {
    if (prop.sprite !== null) {
      const atlas = getAssets().prop[prop.sheetBiome ?? biome]
      const frame = atlas.frame(prop.sprite)
      const sprite = prop.sprite
      return {
        aspect: frame.sw / frame.sh,
        draw: (ctx, x, y, w, h) => atlas.draw(ctx, sprite, x, y, w, h),
      }
    }

    if (!prop.imageId) return null
    // 그린 프롭. 아직 디코드 전이면 이번 프레임은 건너뛴다 — 곧 캐시에 들어온다.
    const bitmap = getBitmap(prop.imageId)
    if (!bitmap) {
      void ensureBitmap(prop.imageId)
      return null
    }

    // 여러 칸을 그린 프롭은 띠에서 지금 칸만 잘라 쓴다.
    if (prop.strip) {
      const { frames, fps } = prop.strip
      const fw = bitmap.width / frames
      const index = Math.floor(this.time * fps) % frames
      return {
        aspect: fw / bitmap.height,
        draw: (ctx, x, y, w, h) =>
          ctx.drawImage(bitmap, index * fw, 0, fw, bitmap.height, x, y, w, h),
      }
    }

    return {
      aspect: bitmap.width / bitmap.height,
      draw: (ctx, x, y, w, h) => ctx.drawImage(bitmap, x, y, w, h),
    }
  }

  private drawVisitors(
    ctx: CanvasRenderingContext2D,
    visitors: readonly VisitorAgent[],
    fenceOffset: number,
    view: ViewBox,
  ): void {
    const { visitor } = getAssets()
    const drawH = VISITOR_HEIGHT * view.height

    // 뒤에 선 사람부터 그려야 앞사람이 위로 온다.
    this.visitorOrder.length = 0
    for (const v of visitors) this.visitorOrder.push(v)
    this.visitorOrder.sort(byVisitorDepth)

    for (const v of this.visitorOrder) {
      // 아직 화면 밖에서 걸어오는 중이면 그릴 게 없다.
      if (!v.isOnScreen) continue
      // 검출된 프레임은 손님마다 크기가 다르다. 그대로 같은 높이로 그리면
      // **작게 그려진 아이가 어른만큼 커진다.** 원본에서의 상대 크기를 그대로 살린다.
      // 실측: 행별 밴드 높이 235 / 224 / 168(아이) / 188.
      const frame = visitor.frame(v.spriteIndex)
      const relative = frame.sh / visitor.maxFrameHeight
      // 앞뒤로 흩어 세운 만큼 크기도 달라진다. 그래야 관람로에 깊이가 생긴다.
      const own = drawH * relative * v.heightScale * v.perspective
      // 발 위치는 절대 기준선이 아니라 **자기 키에서 잠기는 만큼**으로 정한다.
      // 그래야 어른이든 아이든 같은 신체 부위에서 잘리고, 잘린 높이로 앞뒤가 읽힌다.
      const footY = view.height + own * v.submerge + (fenceOffset + v.bobOffset) * view.height
      const sq = v.squash
      const vh = own * sq
      const vw = (own * (frame.sw / frame.sh)) / sq
      visitor.draw(ctx, v.spriteIndex, v.x * view.width - vw / 2, footY - vh, vw, vh)
    }
  }
}

const byDepth = (a: Drawable, b: Drawable): number => a.y - b.y
const byVisitorDepth = (a: VisitorAgent, b: VisitorAgent): number => a.depth - b.depth

/** 화면 전체를 한 색으로 덮는다. 조명 층마다 반복되는 코드라 따로 뺐다. */
function fill(
  ctx: CanvasRenderingContext2D,
  view: ViewBox,
  mode: GlobalCompositeOperation,
  color: string,
  alpha: number,
): void {
  ctx.save()
  ctx.globalCompositeOperation = mode
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(0, 0, view.width, view.height)
  ctx.restore()
}

/**
 * 우리 안에서 조명이 비추는 자리.
 *
 * 등불 에셋이 없으므로 빛 웅덩이만 놓는다. 좌우는 울타리 기둥 안쪽,
 * 가운데는 우리 한복판 — 실제로 조명을 세울 법한 자리다.
 */
const AREA_SPOTS = [
  { x: 0.17, y: 0.63, radius: 0.115, strength: 1 },
  { x: 0.5, y: 0.6, radius: 0.135, strength: 0.8 },
  { x: 0.83, y: 0.63, radius: 0.115, strength: 1 },
] as const

/** 빛 웅덩이의 세로 납작 비율. 바닥면에 누운 것처럼 보이게 한다. */
const SPOT_FLATTEN = 0.42

/**
 * 밝기를 떨어뜨린다. 1 이면 아무것도 하지 않는다.
 *
 * 배경 위라 검정 베일로 충분하다 — 결과는 원본 x 밝기 로 곱연산과 같다.
 * 곱연산을 쓰면 투명한 곳까지 칠해져 오히려 위험하다.
 */
function dim(ctx: CanvasRenderingContext2D, view: ViewBox, brightness: number): void {
  if (brightness >= 1) return
  fill(ctx, view, 'source-over', '#000000', 1 - brightness)
}

function blankCanvas(view: ViewBox): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = view.width
  canvas.height = view.height
  return canvas
}

/** 프롭을 어떻게 그릴지. 시트 칸이든 그린 그림이든 이 모양으로 맞춰 쓴다. */
interface PropPainter {
  readonly aspect: number
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void
}

// ─────────────────────────────────────────────────────────────
// 배치 안내선
// ─────────────────────────────────────────────────────────────

/** 위에서 아래로. 그리는 순서가 곧 겹칠 때의 순서다. */
const GUIDE_ORDER: readonly Habitat[] = ['SKY', 'LAND', 'WATER']
const GUIDE_DASH = [16, 12]
const GUIDE_LINE_WIDTH = 4
const GUIDE_LABEL_SIZE = 22
const GUIDE_LABEL_PAD = 12
/** 팔레트의 초록·빨강과 같은 색. 게임 안에서 같은 뜻으로 쓰이던 색을 그대로 쓴다. */
const GUIDE_OK_LINE = '#7ce06a'
const GUIDE_NO_LINE = '#e8564b'
const GUIDE_OK_FILL = 'rgba(73, 168, 58, 0.16)'
const GUIDE_NO_FILL = 'rgba(216, 56, 47, 0.13)'
