export type DrawTool = 'PENCIL' | 'ERASER' | 'FILL'

export interface StrokeCommand {
  kind: 'STROKE'
  tool: DrawTool
  color: string
  width: number
  /** 캔버스 논리 좌표 [x0, y0, x1, y1, ...] */
  points: number[]
}

export interface FillCommand {
  kind: 'FILL'
  /** 캔버스 논리 좌표 */
  x: number
  y: number
  color: string
}

export interface ClearCommand {
  kind: 'CLEAR'
}

export type DrawCommand = StrokeCommand | FillCommand | ClearCommand

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
  if (command.kind === 'FILL') {
    floodFill(ctx, command)
    return
  }
  drawStroke(ctx, command)
}

/** 색이 얼마나 달라야 경계로 볼지. 안티에일리어싱된 선 안쪽까지 채우도록 넉넉히 잡는다. */
const FILL_TOLERANCE = 60

/**
 * 페인트통.
 *
 * 클릭한 지점과 **같은 색으로 이어진** 영역을 칠한다. 선으로 둘러싸인 안쪽만 채워지고
 * 선 바깥으로 새지 않는다. 알파도 비교 대상에 넣어야 빈 캔버스(투명)를 칠할 수 있다.
 */
function floodFill(ctx: CanvasRenderingContext2D, command: FillCommand): void {
  const { width, height } = ctx.canvas
  const startX = Math.floor(command.x)
  const startY = Math.floor(command.y)
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return

  const image = ctx.getImageData(0, 0, width, height)
  const px = image.data
  const target = readPixel(px, (startY * width + startX) * 4)
  const fill = parseColor(command.color)
  if (matches(target, fill, 0)) return

  const visited = new Uint8Array(width * height)
  const stack: number[] = [startY * width + startX]
  visited[startY * width + startX] = 1

  while (stack.length > 0) {
    const index = stack.pop() as number
    const offset = index * 4
    if (!matches(readPixel(px, offset), target, FILL_TOLERANCE)) continue

    px[offset] = fill[0]
    px[offset + 1] = fill[1]
    px[offset + 2] = fill[2]
    px[offset + 3] = 255

    const x = index % width
    const y = (index / width) | 0
    if (x > 0) push(index - 1)
    if (x < width - 1) push(index + 1)
    if (y > 0) push(index - width)
    if (y < height - 1) push(index + width)
  }

  ctx.putImageData(image, 0, 0)

  function push(next: number): void {
    if (visited[next]) return
    visited[next] = 1
    stack.push(next)
  }
}

type Rgba = readonly [number, number, number, number]

function readPixel(px: Uint8ClampedArray, offset: number): Rgba {
  return [px[offset] as number, px[offset + 1] as number, px[offset + 2] as number, px[offset + 3] as number]
}

function matches(a: Rgba, b: Rgba, tolerance: number): boolean {
  // 둘 다 사실상 투명하면 색이 달라도 같은 영역으로 본다.
  if (a[3] < 16 && b[3] < 16) return true
  if (Math.abs(a[3] - b[3]) > tolerance) return false
  return (
    Math.abs(a[0] - b[0]) <= tolerance &&
    Math.abs(a[1] - b[1]) <= tolerance &&
    Math.abs(a[2] - b[2]) <= tolerance
  )
}

function parseColor(hex: string): Rgba {
  const value = hex.replace('#', '')
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    255,
  ]
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
