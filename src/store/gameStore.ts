import { create } from 'zustand'
import type { BiomeId } from '@/assets/manifest'
import type { Animal } from '@/domain/animal'
import { ANIMAL_CREATE_COST, MAX_ANIMALS_PER_ENCLOSURE, START_GOLD, START_REPUTATION } from '@/domain/balance'
import { advanceClock, type ClockState } from '@/domain/clock'
import { neighborEnclosure } from '@/domain/enclosure'

export type ScreenId = 'TITLE' | 'ZOO' | 'ZOO_DETAIL'
export type ModalId = 'OPTIONS' | 'STATUS' | 'REQUEST' | null

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
  options: OptionsState

  setScreen(screen: ScreenId): void
  openModal(modal: Exclude<ModalId, null>): void
  closeModal(): void
  tickClock(dt: number): void
  moveEnclosure(direction: -1 | 1): void
  setOption<K extends keyof OptionsState>(key: K, value: OptionsState[K]): void
  /** 제작 비용을 차감하고 동물을 배치한다. 비용 부족이나 정원 초과면 false. */
  addAnimal(animal: Animal): boolean
  canAddAnimal(enclosureId: BiomeId): boolean
}

export const useGameStore = create<GameState>((set, get) => ({
  screen: 'TITLE',
  modal: null,
  gold: START_GOLD,
  reputation: START_REPUTATION,
  clock: { day: 1, elapsed: 0 },
  currentEnclosure: 'FIELD',
  unlocked: ['FIELD'],
  animals: [],
  options: { bgm: 0.7, sfx: 0.8 },

  setScreen: (screen) => set({ screen, modal: null }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  tickClock: (dt) => {
    const { next, daysPassed } = advanceClock(get().clock, dt)
    // TODO(M4): daysPassed > 0 이면 domain/economy 의 자정 정산을 호출한다.
    void daysPassed
    set({ clock: next })
  },

  moveEnclosure: (direction) => {
    const { currentEnclosure, unlocked } = get()
    // 잠긴 우리는 건너뛰지 않고 그대로 보여준다(해금 안내를 띄우기 위해).
    void unlocked
    set({ currentEnclosure: neighborEnclosure(currentEnclosure, direction) })
  },

  setOption: (key, value) => set((s) => ({ options: { ...s.options, [key]: value } })),

  canAddAnimal: (enclosureId) => {
    const { gold, animals } = get()
    if (gold < ANIMAL_CREATE_COST) return false
    return animals.filter((a) => a.enclosureId === enclosureId).length < MAX_ANIMALS_PER_ENCLOSURE
  },

  addAnimal: (animal) => {
    if (!get().canAddAnimal(animal.enclosureId)) return false
    set((s) => ({ gold: s.gold - ANIMAL_CREATE_COST, animals: [...s.animals, animal] }))
    return true
  },
}))
