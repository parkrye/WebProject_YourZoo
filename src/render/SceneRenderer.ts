import { getAssets } from '@/assets/AssetStore'
import {
  LOGICAL_HEIGHT, LOGICAL_WIDTH, VISITOR_BASELINE_Y, VISITOR_HEIGHT,
  type BiomeId, type Habitat,
} from '@/assets/manifest'
import { phaseBlend } from '@/domain/clock'
import type { AnimalAgent } from '@/sim/AnimalAgent'
import type { EnclosureSim } from '@/sim/EnclosureSim'
import type { PlacedProp } from '@/sim/props'
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

  draw(ctx: CanvasRenderingContext2D, input: SceneInput): void {
    const view: ViewBox = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT }
    const { sim } = input

    // 카메라 변환 밖에서 지워야 확대 상태에서도 화면 전체가 깨끗해진다.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, view.width, view.height)
    applyCamera(ctx, input.camera, view.width, view.height)

    this.drawSky(ctx, input.elapsed, view)
    ctx.drawImage(getAssets().area[sim.biome], 0, 0, view.width, view.height)

    this.drawSkyAnimals(ctx, sim, view)
    this.drawSortedLayer(ctx, sim, 'LAND', view)
    this.drawSortedLayer(ctx, sim, 'WATER', view)
    ctx.drawImage(getAssets().fence, 0, input.fenceOffset * view.height, view.width, view.height)
    this.drawVisitors(ctx, sim.visitors, input.fenceOffset, view)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
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
      agent.renderer?.draw(ctx, agent.toRenderState(), view)
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
      item.agent.renderer?.draw(ctx, item.agent.toRenderState(), view)
    }
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
    atlas.draw(ctx, prop.sprite, prop.x * view.width - width / 2, prop.y * view.height - height, width, height)
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
      // 검출된 프레임은 손님마다 종횡비가 다르다. 프레임별로 폭을 계산해야 찌그러지지 않는다.
      const frame = visitor.frame(v.spriteIndex)
      const footY = (VISITOR_BASELINE_Y + fenceOffset + v.bobOffset) * view.height
      const sq = v.squash
      const vh = drawH * sq
      const vw = (drawH * (frame.sw / frame.sh)) / sq
      visitor.draw(ctx, v.spriteIndex, v.x * view.width - vw / 2, footY - vh, vw, vh)
    }
  }
}

const byDepth = (a: Drawable, b: Drawable): number => a.y - b.y
