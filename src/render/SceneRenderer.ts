import { getAssets } from '@/assets/AssetStore'
import {
  LOGICAL_HEIGHT, LOGICAL_WIDTH, VISITOR_BASELINE_Y, VISITOR_HEIGHT,
  type BiomeId, type Habitat,
} from '@/assets/manifest'
import { easeInOutCubic } from '@/core/math'
import { phaseBlend, timeLighting, type EnclosureLight } from '@/domain/clock'
import type { AnimalAgent } from '@/sim/AnimalAgent'
import type { EnclosureSim } from '@/sim/EnclosureSim'
import { PROP_BOB, type PlacedProp } from '@/sim/props'
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
    // 하늘은 시간대별 이미지가 이미 다르다. 색을 얹기만 하고 어둡게 하지 않는다.
    if (light.sky.alpha > 0) {
      fillWith(ctx, view, 'multiply', light.sky.multiply, light.sky.alpha)
    }

    ctx.drawImage(getAssets().area[sim.biome], 0, 0, view.width, view.height)
    this.drawSkyAnimals(ctx, sim, view)
    this.drawSortedLayer(ctx, sim, 'LAND', view)
    this.drawSortedLayer(ctx, sim, 'WATER', view)

    // 우리 안쪽 조명은 펜스보다 먼저다. 펜스는 관람로 쪽이라 우리 안 그늘을 받지 않는다.
    this.drawEnclosureLight(ctx, light.enclosure, view)

    ctx.drawImage(getAssets().fence, 0, input.fenceOffset * view.height, view.width, view.height)
    this.drawVisitors(ctx, sim.visitors, input.fenceOffset, view)

    // 마지막으로 화면 전체를 한 색조로 묶는다.
    if (light.global.glowAlpha > 0 || light.global.multiply !== '#ffffff') {
      fillWith(ctx, view, 'multiply', light.global.multiply, 1)
      if (light.global.glowAlpha > 0) {
        fillWith(ctx, view, 'lighter', light.global.glow, light.global.glowAlpha)
      }
    }
  }

  /**
   * 우리 안쪽 조명.
   *
   * 그늘을 깔고 그 위에 **위에서 내려오는 빛**을 세로 그라디언트로 얹는다.
   * 한낮엔 빛이 바닥까지 닿고, 해가 낮아질수록 얕게 들다가, 밤엔 달빛만 위쪽에 남는다.
   * 평평하게 어둡게만 하면 시간이 아니라 밝기만 바뀐 것처럼 보인다.
   */
  private drawEnclosureLight(
    ctx: CanvasRenderingContext2D,
    light: EnclosureLight,
    view: ViewBox,
  ): void {
    if (light.shadeAlpha <= 0 && light.lightAlpha <= 0) return

    ctx.save()
    if (light.shadeAlpha > 0) {
      ctx.globalCompositeOperation = 'multiply'
      ctx.globalAlpha = light.shadeAlpha
      ctx.fillStyle = light.shade
      ctx.fillRect(0, 0, view.width, view.height)
    }

    if (light.lightAlpha > 0) {
      const gradient = ctx.createLinearGradient(0, 0, 0, view.height * light.reach)
      gradient.addColorStop(0, light.light)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')

      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = light.lightAlpha
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, view.width, view.height)
    }
    ctx.restore()
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

  /** 하늘 동물은 원경이라 y 정렬이 의미 없다. 바이옴 배경 바로 위에 그린다. */
  private drawSkyAnimals(ctx: CanvasRenderingContext2D, sim: EnclosureSim, view: ViewBox): void {
    for (const agent of sim.animals) {
      if (agent.habitat !== 'SKY') continue
      this.drawAgent(ctx, agent, view)
    }
  }

  private drawSortedLayer(
    ctx: CanvasRenderingContext2D,
    sim: EnclosureSim,
    layer: Habitat,
    view: ViewBox,
  ): void {
    // 프레임마다 배열을 새로 만들면 GC 압력이 커진다. 하나를 비워 재사용한다.
    this.buffer.length = 0

    for (const prop of sim.props) {
      if (prop.layer === layer) this.buffer.push({ kind: 'PROP', y: prop.y, prop })
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

  private drawProp(
    ctx: CanvasRenderingContext2D,
    biome: BiomeId,
    prop: PlacedProp,
    view: ViewBox,
  ): void {
    const atlas = getAssets().prop[biome]
    const frame = atlas.frame(prop.sprite)
    const height = prop.height * view.height
    const width = height * (frame.sw / frame.sh)
    const x = prop.x * view.width
    const y = prop.y * view.height

    // 땅 프롭은 가만히 있는다. 물에 뜬 것만 잔물결에 흔들린다.
    if (prop.layer !== 'WATER') {
      atlas.draw(ctx, prop.sprite, x - width / 2, y - height, width, height)
      return
    }

    const wave = this.time * PROP_BOB.speed + prop.bobPhase
    ctx.save()
    ctx.translate(x, y + Math.sin(wave) * PROP_BOB.amplitude * view.height)
    ctx.rotate(Math.sin(wave * 0.7) * PROP_BOB.tilt)
    atlas.draw(ctx, prop.sprite, -width / 2, -height, width, height)
    ctx.restore()
  }

  private drawVisitors(
    ctx: CanvasRenderingContext2D,
    visitors: readonly VisitorAgent[],
    fenceOffset: number,
    view: ViewBox,
  ): void {
    const { visitor } = getAssets()
    const drawH = VISITOR_HEIGHT * view.height

    for (const v of visitors) {
      // 검출된 프레임은 손님마다 크기가 다르다. 그대로 같은 높이로 그리면
      // **작게 그려진 아이가 어른만큼 커진다.** 원본에서의 상대 크기를 그대로 살린다.
      // 실측: 행별 밴드 높이 235 / 224 / 168(아이) / 188.
      const frame = visitor.frame(v.spriteIndex)
      const relative = frame.sh / visitor.maxFrameHeight
      const own = drawH * relative * v.heightScale
      const footY = (VISITOR_BASELINE_Y + fenceOffset + v.bobOffset) * view.height
      const sq = v.squash
      const vh = own * sq
      const vw = (own * (frame.sw / frame.sh)) / sq
      visitor.draw(ctx, v.spriteIndex, v.x * view.width - vw / 2, footY - vh, vw, vh)
    }
  }
}

const byDepth = (a: Drawable, b: Drawable): number => a.y - b.y

/** 화면 전체를 한 색으로 덮는다. 조명 층마다 반복되는 코드라 따로 뺐다. */
function fillWith(
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
