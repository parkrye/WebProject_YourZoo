export type DrawTool = 'PENCIL' | 'ERASER'

export interface StrokeCommand {
  kind: 'STROKE'
  tool: DrawTool
  color: string
  width: number
  /** 캔버스 논리 좌표 [x0, y0, x1, y1, ...] */
  points: number[]
}

export interface ClearCommand {
  kind: 'CLEAR'
}

export type DrawCommand = StrokeCommand | ClearCommand

/**
 * 커맨드가 이만큼 쌓이면 앞쪽 절반을 비트맵으로 구워 baseline 에 합친다.
 * 실사용에서 도달할 일은 거의 없고, 메모리 폭주를 막는 안전장치다.
 */
const MAX_COMMANDS = 400
const FLATTEN_CHUNK = 200

/**
 * 그림판 undo/redo.
 *
 * ImageData 스냅샷 대신 **스트로크 커맨드**를 쌓고 되돌릴 때 처음부터 재생한다.
 * 512×512 스냅샷은 장당 1MB 라 30장만 쌓여도 30MB 를 먹지만, 커맨드는 KB 단위다.
 * 재생 비용은 undo/redo 순간에만 발생하고 수백 스트로크라도 수 ms 수준이다.
 * 덤으로 향후 스프라이트 생성 SDK 에 벡터 데이터를 그대로 넘길 수 있다.
 */
export class DrawHistory {
  private commands: DrawCommand[] = []
  private redoStack: DrawCommand[] = []
  private baseline: HTMLCanvasElement | null = null

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {}

  get canUndo(): boolean {
    return this.commands.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get isEmpty(): boolean {
    return this.baseline === null && this.commands.length === 0
  }

  push(command: DrawCommand): void {
    this.commands.push(command)
    this.redoStack.length = 0
    if (this.commands.length > MAX_COMMANDS) this.flatten()
  }

  undo(): boolean {
    const command = this.commands.pop()
    if (!command) return false
    this.redoStack.push(command)
    return true
  }

  redo(): boolean {
    const command = this.redoStack.pop()
    if (!command) return false
    this.commands.push(command)
    return true
  }

  reset(): void {
    this.commands.length = 0
    this.redoStack.length = 0
    this.baseline = null
  }

  replay(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, this.width, this.height)
    if (this.baseline) ctx.drawImage(this.baseline, 0, 0)
    for (const command of this.commands) applyCommand(ctx, command)
  }

  private flatten(): void {
    const canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (this.baseline) ctx.drawImage(this.baseline, 0, 0)
    for (const command of this.commands.splice(0, FLATTEN_CHUNK)) applyCommand(ctx, command)
    this.baseline = canvas
  }
}

export function applyCommand(ctx: CanvasRenderingContext2D, command: DrawCommand): void {
  if (command.kind === 'CLEAR') {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    return
  }
  drawStroke(ctx, command)
}

/** 점 목록을 이차 베지어로 부드럽게 이어 그린다. 점 하나짜리 탭은 원으로 찍는다. */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: StrokeCommand): void {
  const p = stroke.points
  if (p.length < 2) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.width
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.globalCompositeOperation = stroke.tool === 'ERASER' ? 'destination-out' : 'source-over'

  if (p.length === 2) {
    ctx.beginPath()
    ctx.arc(p[0] as number, p[1] as number, stroke.width / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(p[0] as number, p[1] as number)
  for (let i = 2; i < p.length - 2; i += 2) {
    const cx = p[i] as number
    const cy = p[i + 1] as number
    ctx.quadraticCurveTo(cx, cy, (cx + (p[i + 2] as number)) / 2, (cy + (p[i + 3] as number)) / 2)
  }
  ctx.lineTo(p[p.length - 2] as number, p[p.length - 1] as number)
  ctx.stroke()
  ctx.restore()
}
