import { create } from 'zustand'
import type { BiomeId } from '@/assets/manifest'
import { placedIn, type Animal } from '@/domain/animal'
import {
  ANIMAL_CREATE_COST, ANIMAL_SELL_REFUND, MAX_ANIMALS_PER_ENCLOSURE,
  START_GOLD, START_REPUTATION, UNLOCK_COST,
} from '@/domain/balance'
import { advanceClock, type ClockState } from '@/domain/clock'
import { settleDay, type DailyReport } from '@/domain/economy'
import { neighborEnclosure } from '@/domain/enclosure'
import { forgetBitmap } from '@/sim/imageCache'
import { deleteImage } from './imageDb'
import { clearSave, loadSave, writeSave, type SaveV2 } from './save'

export type ScreenId = 'TITLE' | 'ZOO' | 'ZOO_DETAIL'
export type ModalId = 'OPTIONS' | 'STATUS' | 'REQUEST' | 'REPORT' | null

export interface OptionsState {
  bgm: number
  sfx: number
}

interface GameState {
  screen: ScreenId
  modal: ModalId
  gold: number
  reputation: number
  clock: ClockState
  currentEnclosure: BiomeId
  unlocked: BiomeId[]
  animals: Animal[]
  lastReport: DailyReport | null
  options: OptionsState

  setScreen(screen: ScreenId): void
  openModal(modal: Exclude<ModalId, null>): void
  closeModal(): void
  tickClock(dt: number): void
  moveEnclosure(direction: -1 | 1): void
  setOption<K extends keyof OptionsState>(key: K, value: OptionsState[K]): void
  /** 요청서 제출. 비용을 차감하고 배송 대기 상태로 넣는다. */
  orderAnimal(animal: Animal): boolean
  canOrderAnimal(): boolean
  /** 창고에서 우리로. 서식지·정원이 맞지 않으면 false. */
  placeAnimal(id: string, enclosureId: BiomeId): boolean
  /** 우리에서 창고로. */
  storeAnimal(id: string): boolean
  /** 창고에서 판매. 제작비의 절반을 돌려받는다. */
  sellAnimal(id: string): boolean
  canPlaceIn(enclosureId: BiomeId): boolean
  unlockEnclosure(id: BiomeId): boolean
  isUnlocked(id: BiomeId): boolean

  startNewGame(): void
  continueGame(): boolean
  snapshot(): SaveV2
}

const initial = {
  screen: 'TITLE' as ScreenId,
  modal: null as ModalId,
  gold: START_GOLD,
  reputation: START_REPUTATION,
  clock: { day: 1, elapsed: 0 } as ClockState,
  currentEnclosure: 'FIELD' as BiomeId,
  unlocked: ['FIELD'] as BiomeId[],
  animals: [] as Animal[],
  lastReport: null as DailyReport | null,
  options: { bgm: 0.7, sfx: 0.8 },
}

export const useGameStore = create<GameState>((set, get) => ({
  ...initial,

  setScreen: (screen) => set({ screen, modal: null }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  /**
   * 게임 시계. 자정을 넘기면 정산하고 결과 팝업을 띄운다.
   *
   * **모달이 열려 있으면 시간이 흐르지 않는다.** 그림 한 장 그리는 데 몇 분이 걸리는데
   * 그동안 하루가 지나가면 플레이어가 손해를 본다.
   */
  tickClock: (dt) => {
    const state = get()
    if (state.modal !== null || state.screen === 'TITLE') return

    const { next, daysPassed } = advanceClock(state.clock, dt)
    if (daysPassed <= 0) {
      set({ clock: next })
      return
    }

    let gold = state.gold
    let reputation = state.reputation
    let animals = state.animals
    let report: DailyReport | null = null

    // 탭이 오래 비활성이었다면 여러 날이 한 번에 넘어갈 수 있다.
    for (let i = 0; i < daysPassed; i++) {
      const today = state.clock.day + i + 1

      // 배송 완료 처리를 정산보다 먼저 한다. 도착한 동물은 그날부터 창고 사육비를 낸다.
      const arriving = animals.filter((a) => a.status === 'SHIPPING' && a.arrivalDay <= today)
      if (arriving.length > 0) {
        animals = animals.map((a) =>
          a.status === 'SHIPPING' && a.arrivalDay <= today
            ? { ...a, status: 'STORED' as const }
            : a,
        )
      }

      report = settleDay({
        day: state.clock.day + i,
        animals,
        unlocked: state.unlocked,
        reputation,
        arrivedCount: arriving.length,
      })
      gold = Math.max(0, gold + report.net)
      reputation = Math.max(0, reputation + report.reputationDelta)
    }

    set({ clock: next, gold, reputation, animals, lastReport: report, modal: 'REPORT' })
  },

  moveEnclosure: (direction) => {
    set({ currentEnclosure: neighborEnclosure(get().currentEnclosure, direction) })
  },

  setOption: (key, value) => set((s) => ({ options: { ...s.options, [key]: value } })),

  isUnlocked: (id) => get().unlocked.includes(id),

  canOrderAnimal: () => get().gold >= ANIMAL_CREATE_COST,

  canPlaceIn: (enclosureId) => {
    const { animals, unlocked } = get()
    if (!unlocked.includes(enclosureId)) return false
    return placedIn(animals, enclosureId).length < MAX_ANIMALS_PER_ENCLOSURE
  },

  orderAnimal: (animal) => {
    if (!get().canOrderAnimal()) return false
    set((s) => ({ gold: s.gold - ANIMAL_CREATE_COST, animals: [...s.animals, animal] }))
    return true
  },

  placeAnimal: (id, enclosureId) => {
    const { animals } = get()
    const target = animals.find((a) => a.id === id)
    if (!target || target.status !== 'STORED') return false
    if (!get().canPlaceIn(enclosureId)) return false

    set({
      animals: animals.map((a) =>
        a.id === id ? { ...a, status: 'PLACED' as const, enclosureId } : a,
      ),
    })
    return true
  },

  storeAnimal: (id) => {
    const { animals } = get()
    const target = animals.find((a) => a.id === id)
    if (!target || target.status !== 'PLACED') return false

    set({
      animals: animals.map((a) =>
        a.id === id ? { ...a, status: 'STORED' as const, enclosureId: null } : a,
      ),
    })
    return true
  },

  sellAnimal: (id) => {
    const { animals } = get()
    const target = animals.find((a) => a.id === id)
    if (!target || target.status !== 'STORED') return false

    // 그림은 더 이상 참조되지 않는다. 저장소와 메모리 양쪽에서 지운다.
    void deleteImage(target.imageId)
    forgetBitmap(target.imageId)

    set((s) => ({
      gold: s.gold + ANIMAL_SELL_REFUND,
      animals: s.animals.filter((a) => a.id !== id),
    }))
    return true
  },

  unlockEnclosure: (id) => {
    const { gold, unlocked } = get()
    if (unlocked.includes(id)) return false

    const cost = UNLOCK_COST[id]
    if (gold < cost) return false

    set({ gold: gold - cost, unlocked: [...unlocked, id] })
    return true
  },

  startNewGame: () => {
    clearSave()
    set({ ...initial, screen: 'ZOO' })
  },

  continueGame: () => {
    const save = loadSave()
    if (!save) return false

    set({
      screen: 'ZOO',
      modal: null,
      gold: save.gold,
      reputation: save.reputation,
      clock: save.clock,
      currentEnclosure: save.currentEnclosure,
      unlocked: save.unlocked,
      animals: save.animals,
      lastReport: save.lastReport,
      options: save.options ?? initial.options,
    })
    return true
  },

  snapshot: () => {
    const s = get()
    return {
      version: 2,
      savedAt: Date.now(),
      gold: s.gold,
      reputation: s.reputation,
      clock: s.clock,
      currentEnclosure: s.currentEnclosure,
      unlocked: s.unlocked,
      animals: s.animals,
      lastReport: s.lastReport,
      options: s.options,
    }
  },
}))

const AUTOSAVE_INTERVAL_MS = 15000

/**
 * 즉시 저장을 트리거하는 필드들의 지문.
 * 게임 시계(clock.elapsed)는 60Hz 로 변하므로 **일부러 제외**한다.
 * 시계까지 넣으면 매 프레임 저장하게 된다. 시계 진행은 주기 저장이 담당한다.
 */
function saveKey(state: GameState): string {
  return [
    // 타이틀 -> 우리 전환도 저장 시점이다. 새 게임을 시작하자마자 새로고침해도 이어지도록.
    state.screen,
    state.gold,
    state.reputation,
    state.clock.day,
    state.animals.length,
    // 배치/창고 이동도 즉시 저장 대상이다.
    state.animals.filter((a) => a.status === 'PLACED').length,
    state.unlocked.length,
    state.currentEnclosure,
  ].join('|')
}

/**
 * 자동 저장.
 *
 * **상태 변경 구독 + 디바운스는 쓸 수 없다.** 게임 시계가 60Hz 로 상태를 갱신하기 때문에
 * 구독 콜백이 매 프레임 깨어나 디바운스 타이머를 무한히 리셋한다. 실제로 그렇게 만들었더니
 * 세이브가 탭을 떠날 때만 기록됐다.
 *
 * 그래서 세 갈래로 쓴다.
 *   1. 의미 있는 변화(정산·동물 추가·해금·우리 이동) 직후 즉시
 *   2. 15초 주기 — 시계 진행을 흘려보내지 않기 위해
 *   3. 탭을 떠나거나 페이지가 사라질 때
 *
 * 타이틀 화면에서는 쓰지 않는다 — 새 게임 초기 상태로 기존 세이브를 덮으면 안 된다.
 */
export function startAutosave(): () => void {
  const flush = (): void => {
    const state = useGameStore.getState()
    if (state.screen === 'TITLE') return
    writeSave(state.snapshot())
  }

  let lastKey = saveKey(useGameStore.getState())
  const unsubscribe = useGameStore.subscribe((state) => {
    const key = saveKey(state)
    if (key === lastKey) return
    lastKey = key
    flush()
  })

  const timer = window.setInterval(flush, AUTOSAVE_INTERVAL_MS)

  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') flush()
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', flush)

  return () => {
    window.clearInterval(timer)
    unsubscribe()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', flush)
  }
}
