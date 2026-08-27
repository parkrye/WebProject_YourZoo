import { create } from 'zustand'
import type { BiomeId } from '@/assets/manifest'
import type { Animal } from '@/domain/animal'
import {
  ANIMAL_CREATE_COST, MAX_ANIMALS_PER_ENCLOSURE, START_GOLD, START_REPUTATION, UNLOCK_COST,
} from '@/domain/balance'
import { advanceClock, type ClockState } from '@/domain/clock'
import { settleDay, type DailyReport } from '@/domain/economy'
import { neighborEnclosure } from '@/domain/enclosure'
import { clearSave, loadSave, writeSave, type SaveV1 } from './save'

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
  addAnimal(animal: Animal): boolean
  canAddAnimal(enclosureId: BiomeId): boolean
  unlockEnclosure(id: BiomeId): boolean
  isUnlocked(id: BiomeId): boolean

  startNewGame(): void
  continueGame(): boolean
  snapshot(): SaveV1
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
    let report: DailyReport | null = null

    // 탭이 오래 비활성이었다면 여러 날이 한 번에 넘어갈 수 있다.
    for (let i = 0; i < daysPassed; i++) {
      report = settleDay({
        day: state.clock.day + i,
        animals: state.animals,
        unlocked: state.unlocked,
        reputation,
      })
      gold = Math.max(0, gold + report.net)
      reputation = Math.max(0, reputation + report.reputationDelta)
    }

    set({ clock: next, gold, reputation, lastReport: report, modal: 'REPORT' })
  },

  moveEnclosure: (direction) => {
    set({ currentEnclosure: neighborEnclosure(get().currentEnclosure, direction) })
  },

  setOption: (key, value) => set((s) => ({ options: { ...s.options, [key]: value } })),

  isUnlocked: (id) => get().unlocked.includes(id),

  canAddAnimal: (enclosureId) => {
    const { gold, animals, unlocked } = get()
    if (!unlocked.includes(enclosureId)) return false
    if (gold < ANIMAL_CREATE_COST) return false
    return animals.filter((a) => a.enclosureId === enclosureId).length < MAX_ANIMALS_PER_ENCLOSURE
  },

  addAnimal: (animal) => {
    if (!get().canAddAnimal(animal.enclosureId)) return false
    set((s) => ({ gold: s.gold - ANIMAL_CREATE_COST, animals: [...s.animals, animal] }))
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
      version: 1,
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
