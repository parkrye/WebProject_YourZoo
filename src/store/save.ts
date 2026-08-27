import type { BiomeId } from '@/assets/manifest'
import type { Animal } from '@/domain/animal'
import type { DailyReport } from '@/domain/economy'
import type { ClockState } from '@/domain/clock'

const STORAGE_KEY = 'yourzoo.save.v1'

export interface SaveV1 {
  version: 1
  savedAt: number
  gold: number
  reputation: number
  clock: ClockState
  currentEnclosure: BiomeId
  unlocked: BiomeId[]
  /** 그림 픽셀은 IndexedDB 에 있고 여기에는 imageId 만 남는다. */
  animals: Animal[]
  lastReport: DailyReport | null
  options: { bgm: number; sfx: number }
}

export function hasSave(): boolean {
  return readRaw() !== null
}

export function loadSave(): SaveV1 | null {
  const raw = readRaw()
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as unknown
    return isSaveV1(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeSave(save: SaveV1): boolean {
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
function isSaveV1(value: unknown): value is SaveV1 {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Partial<SaveV1>

  return (
    s.version === 1 &&
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
}
