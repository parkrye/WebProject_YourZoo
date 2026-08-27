import type { AnimalMotion, SheetMeta } from '@/domain/animal'
import type { BandMotion, MotionProfile } from '@/domain/motion'
import { ProceduralRenderer } from './ProceduralRenderer'

/** 모션 한 줄에 담기는 프레임 수. 시트 규격이 8x3 이다. */
const COLS = 8
/** 시트의 행 순서. `SheetMeta.motions` 로 그대로 나간다. */
const ROWS: readonly AnimalMotion[] = ['IDLE', 'MOVE', 'SIGNATURE']

/** 셀 한 칸의 픽셀 크기. 화면에서 동물은 화면 높이의 12% 정도라 이 이상은 낭비다. */
const CELL = 192

/**
 * 셀 안에서 동물이 차지하는 높이 비율.
 *
 * 1 로 두면 보빙·기울기·시그니처 점프가 셀 밖으로 잘려 나간다.
 * 여백을 두고, 그만큼 화면에서는 시트를 키워 그리므로 최종 크기는 달라지지 않는다.
 */
const FIT = 0.7
/** 발이 닿는 자리. 아래 여백은 기울었을 때 발끝이 나가지 않을 만큼만 둔다. */
const BASELINE = 0.94

/** 시그니처 동작 길이(초). ProceduralRenderer 의 값과 맞춰야 한다. */
const SIGNATURE_DURATION = 1.2

export interface BakedSheet {
  readonly blob: Blob
  readonly meta: Omit<SheetMeta, 'imageId'>
}

/**
 * 절차적 애니메이션을 8프레임 x 3모션 스프라이트 시트로 굽는다.
 *
 * 외부 SDK 가 아직 없으므로, 이미 화면에서 돌고 있는 움직임을 그대로 프레임으로
 * 떠낸다. 결과가 지금과 똑같아 보이는 건 의도한 것이다 — 목적은 새 움직임이 아니라
 * **시트 경로(`SheetRenderer`)를 실제로 켜는 것**이다.
 * SDK 가 오면 이 함수만 갈아 끼우면 된다.
 *
 * @see docs/02-architecture.md §3.1
 */
export async function bakeSheet(bitmap: ImageBitmap, profile: MotionProfile): Promise<BakedSheet> {
  const loop = loopSeconds(profile)
  const baked = closeLoop(profile)

  const canvas = document.createElement('canvas')
  canvas.width = CELL * COLS
  canvas.height = CELL * ROWS.length
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('시트를 구울 캔버스를 만들 수 없다')

  const renderer = new ProceduralRenderer(bitmap, baked)
  const view = { width: CELL, height: CELL }

  for (let row = 0; row < ROWS.length; row++) {
    const motion = ROWS[row] as AnimalMotion
    // 시그니처는 반복 동작이 아니다. 시작과 끝이 있는 1.2초를 8등분해 훑는다.
    const span = motion === 'SIGNATURE' ? SIGNATURE_DURATION : loop

    for (let col = 0; col < COLS; col++) {
      ctx.save()
      ctx.translate(col * CELL, row * CELL)
      ctx.beginPath()
      ctx.rect(0, 0, CELL, CELL)
      ctx.clip()
      renderer.draw(
        ctx,
        {
          x: 0.5,
          y: BASELINE,
          facing: 1,
          motion,
          motionTime: (col / COLS) * span,
          // 걷는 줄만 전속력으로. 그래야 IDLE 과 MOVE 가 눈에 띄게 다르다.
          speed01: motion === 'MOVE' ? 1 : 0,
          scale: FIT,
        },
        view,
      )
      ctx.restore()
    }
  }

  const blob = await toBlob(canvas)
  // fit / baseline 을 빼먹으면 렌더러가 '프레임 = 동물의 바운딩 박스' 로 읽어
  // 여백까지 동물 크기로 세고, 발이 프레임 아래변에 붙는다. 반드시 함께 넘긴다.
  return {
    blob,
    meta: { cols: COLS, rows: ROWS.length, fps: COLS / loop, motions: ROWS, fit: FIT, baseline: BASELINE },
  }
}

/** 보빙 한 주기. 모든 위상의 기준이 된다. */
function loopSeconds(profile: MotionProfile): number {
  return (Math.PI * 2) / profile.bobSpeed
}

/**
 * 8프레임에서 정확히 닫히도록 띠 속도를 보정한다.
 *
 * 실시간 렌더는 띠마다 제멋대로인 `speed` 를 그대로 써도 된다 — 끝이 없으니까.
 * 시트는 마지막 프레임 다음에 첫 프레임이 와야 하므로, 주기가 안 맞으면
 * 한 바퀴마다 툭 튄다. 그래서 각 띠 속도를 **보빙 속도의 정수배로 반올림**한다.
 * 움직임의 성격(어느 부위가 얼마나 흔들리는지)은 그대로고 박자만 맞춰진다.
 */
function closeLoop(profile: MotionProfile): MotionProfile {
  const base = profile.bobSpeed
  const bands = profile.bands.map((band): BandMotion => {
    const multiple = Math.max(1, Math.round(band.speed / base))
    return { ...band, speed: base * multiple }
  })
  return { ...profile, bands }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('시트를 PNG 로 만들지 못했다'))
    }, 'image/png')
  })
}
