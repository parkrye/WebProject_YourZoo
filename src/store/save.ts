import type { BiomeId } from '@/assets/manifest'
import type { Animal } from '@/domain/animal'
import type { DailyReport } from '@/domain/economy'
import type { Order } from '@/domain/orders'
import type { TutorialStep } from '@/domain/tutorial'
import type { ClockState } from '@/domain/clock'

/**
 * 동물에 배송/창고 상태가 생기면서 스키마가 바뀌었다.
 * v1 세이브는 `enclosureId` 가 필수였고 `status` 가 없어 그대로 읽으면 깨진다.
 * 키를 바꿔 구버전은 조용히 무시한다 (개발 중이라 마이그레이션은 두지 않는다).
 */
const STORAGE_KEY = 'yourzoo.save.v2'

export interface SaveV2 {
  version: 2
  savedAt: number
  /** 이 동물원의 주인 식별자. 다른 유저가 검색해 찾아온다. */
  userId: string
  zooName: string
  tutorial: TutorialStep
  gold: number
  /** 캐시(유료 재화). 구버전 세이브에는 없다 — 그때는 0 으로 읽는다. */
  cash: number
  reputation: number
  clock: ClockState
  currentEnclosure: BiomeId
  unlocked: BiomeId[]
  /** 그림 픽셀은 IndexedDB 에 있고 여기에는 imageId 만 남는다. */
  animals: Animal[]
  orders: Order[]
  lastReport: DailyReport | null
  reports: DailyReport[]
  options: { bgm: number; sfx: number }
}

export function hasSave(): boolean {
  return readRaw() !== null
}

export function loadSave(): SaveV2 | null {
  const raw = readRaw()
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    return isSaveV2(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeSave(save: SaveV2): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
    return true
  } catch {
    // 쿼터 초과나 프라이빗 모드. 진행 자체를 막을 이유는 없다. (docs/02 R6)
    return false
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 지울 수 없으면 그냥 둔다.
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * 손상되거나 구버전인 세이브를 걸러낸다.
 * 필드 하나만 확인하고 넘기면 로드 직후 엉뚱한 곳에서 터진다.
 */
function isSaveV2(value: unknown): value is SaveV2 {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Partial<SaveV2>

  return (
    s.version === 2 &&
    typeof s.gold === 'number' &&
    typeof s.reputation === 'number' &&
    typeof s.currentEnclosure === 'string' &&
    Array.isArray(s.unlocked) &&
    Array.isArray(s.animals) &&
    typeof s.clock === 'object' &&
    s.clock !== null &&
    typeof s.clock.day === 'number' &&
    typeof s.clock.elapsed === 'number'
  )
  // userId 와 cash 는 확인하지 않는다. 나중에 붙은 필드라 구버전 세이브에는 없고,
  // 없으면 로드 시점에 각각 발급 / 0 으로 채운다. 여기서 막으면 멀쩡한 동물원이 날아간다.
}
