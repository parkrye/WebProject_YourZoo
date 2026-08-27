import { create } from 'zustand'
import type { BiomeId } from '@/assets/manifest'
import { createAnimalId, placedIn, type Animal } from '@/domain/animal'
import {
  ANIMAL_CREATE_COST, ANIMAL_SELL_REFUND, MAX_ANIMALS_PER_ENCLOSURE,
  START_GEMS, START_GOLD, START_REPUTATION, UNLOCK_COST,
} from '@/domain/balance'
import { advanceClock, type ClockAdvanceResult, type ClockState } from '@/domain/clock'
import { settleDay, type DailyReport } from '@/domain/economy'
import { neighborEnclosure } from '@/domain/enclosure'
import { createOrder, expireOrders, matchesOrder, MAX_ACTIVE_ORDERS, type Order } from '@/domain/orders'
import { emptyDraft, type RequestDraft } from '@/domain/requestDraft'
import { randomTraits } from '@/domain/traits'
import { skipsShipping, type TutorialStep } from '@/domain/tutorial'
import { createRng } from '@/core/rng'
import { audio } from '@/audio/AudioManager'
import { forgetBitmap } from '@/sim/imageCache'
import { deleteImage } from './imageDb'
import { clearSave, loadSave, writeSave, type SaveV2 } from './save'

export type ScreenId = 'TITLE' | 'NAMING' | 'ZOO' | 'ZOO_DETAIL'
export type ModalId = 'OPTIONS' | 'STATUS' | 'REQUEST' | 'REPORT' | null

/**
 * 하루가 넘어갈 때의 암전 단계.
 *
 * `OUT` 어두워지는 중 (시계 정지, 정산 대기)
 * `HOLD` 완전히 어두움. 정산이 끝났고 리포트가 떠 있다
 * `IN` 다시 밝아지는 중
 */
export type DayFade = 'NONE' | 'OUT' | 'HOLD' | 'IN'

export interface OptionsState {
  bgm: number
  sfx: number
}

interface GameState {
  screen: ScreenId
  modal: ModalId
  /** 플레이어가 지은 동물원 이름. A-Z / 0-9 / 공백만 가능. */
  zooName: string
  /** 그림판이 열려 있는가. 시계를 멈출지 판단하는 데 쓴다. */
  isDrawing: boolean
  tutorial: TutorialStep
  gold: number
  /** 유료 재화. 충전·소모는 아직 없고 보유량만 들고 있는다. */
  gems: number
  reputation: number
  clock: ClockState
  currentEnclosure: BiomeId
  unlocked: BiomeId[]
  animals: Animal[]
  orders: Order[]
  /** 작성 중인 요청서. 세션 동안만 유지되고 세이브에는 넣지 않는다. */
  draft: RequestDraft
  lastReport: DailyReport | null
  /** 최근 정산 기록. 운영 현황에서 되짚어 볼 수 있다. */
  reports: DailyReport[]
  options: OptionsState
  /** 하루가 넘어갈 때의 암전 단계. 세이브에는 넣지 않는다. */
  dayFade: DayFade
  /** 암전이 끝나면 처리할 날짜 넘김. 처리 전까지 시계는 멈춰 있다. */
  pendingDay: ClockAdvanceResult | null

  setScreen(screen: ScreenId): void
  setDrawing(drawing: boolean): void
  advanceTutorial(from: TutorialStep, to: TutorialStep): void
  skipTutorial(): void
  openModal(modal: Exclude<ModalId, null>): void
  closeModal(): void
  tickClock(dt: number): void
  /** 화면이 완전히 어두워졌다. 밀어 둔 정산을 지금 처리한다. */
  finishDay(): void
  /** 페이드인이 끝났다. 시계를 다시 돌린다. */
  endDayFade(): void
  moveEnclosure(direction: -1 | 1): void
  setOption<K extends keyof OptionsState>(key: K, value: OptionsState[K]): void
  /** 요청서 제출. 비용을 차감하고 배송 대기 상태로 넣는다. */
  orderAnimal(animal: Animal): boolean
  canOrderAnimal(): boolean
  patchDraft(patch: Partial<RequestDraft>): void
  clearDraft(): void
  /** 창고에서 우리로. 서식지·정원이 맞지 않으면 false. */
  placeAnimal(id: string, enclosureId: BiomeId): boolean
  /** 우리에서 창고로. */
  storeAnimal(id: string): boolean
  /** 창고에서 판매. 제작비의 절반을 돌려받는다. */
  sellAnimal(id: string): boolean
  /** 의뢰를 이행한다. 동물을 넘기고 보상을 받는다. */
  fulfillOrder(orderId: string, animalId: string): boolean
  canPlaceIn(enclosureId: BiomeId): boolean
  unlockEnclosure(id: BiomeId): boolean
  isUnlocked(id: BiomeId): boolean

  /** 타이틀에서 새 게임을 고르면 이름 짓기 화면으로 간다. */
  startNewGame(): void
  /** 이름을 확정하고 게임에 진입한다. */
  confirmZooName(name: string): void
  continueGame(): boolean
  snapshot(): SaveV2
}

const initial = {
  screen: 'TITLE' as ScreenId,
  modal: null as ModalId,
  zooName: '',
  isDrawing: false,
  tutorial: 'DONE' as TutorialStep,
  gold: START_GOLD,
  gems: START_GEMS,
  reputation: START_REPUTATION,
  clock: { day: 1, elapsed: 0 } as ClockState,
  currentEnclosure: 'FIELD' as BiomeId,
  unlocked: ['FIELD'] as BiomeId[],
  animals: [] as Animal[],
  orders: [] as Order[],
  draft: emptyDraft(randomTraits(createRng(1))),
  lastReport: null as DailyReport | null,
  reports: [] as DailyReport[],
  options: { bgm: 0.7, sfx: 0.8 },
  dayFade: 'NONE' as DayFade,
  pendingDay: null as ClockAdvanceResult | null,
}

export const useGameStore = create<GameState>((set, get) => ({
  ...initial,

  setScreen: (screen) => set({ screen, modal: null }),
  setDrawing: (isDrawing) => set({ isDrawing }),

  // 플레이어가 실제로 그 행동을 했을 때만 넘어간다. 엉뚱한 단계에서 건너뛰지 않도록 from 을 확인한다.
  advanceTutorial: (from, to) => {
    if (get().tutorial !== from) return
    set({ tutorial: to })
  },

  skipTutorial: () => set({ tutorial: 'DONE' }),
  openModal: (modal) => set({ modal }),
  // 정산 팝업을 닫는 건 하루 연출의 마지막 단계다. 닫히면서 화면이 다시 밝아진다.
  closeModal: () =>
    set((s) => (s.dayFade === 'HOLD' ? { modal: null, dayFade: 'IN' } : { modal: null })),

  /**
   * 게임 시계. 자정을 넘기면 정산하고 결과 팝업을 띄운다.
   *
   * 멈추는 경우는 둘뿐이다.
   *   - **그림판** — 한 장 그리는 데 몇 분이 걸린다. 그동안 하루가 지나가면 손해다
   *   - **정산 팝업** — 결과를 읽는 중에 다음 자정이 오면 곤란하다
   *
   * 요청서나 운영 현황을 잠깐 여는 정도로는 멈추지 않는다.
   * 열어 두기만 하면 시간이 멈추니 그걸 이용해 무한정 버틸 수 있었다.
   */
  tickClock: (dt) => {
    const state = get()
    if (state.screen !== 'ZOO' && state.screen !== 'ZOO_DETAIL') return
    if (state.isDrawing || state.modal === 'REPORT') return
    // 암전이 시작되면 정산이 끝나고 화면이 다시 밝아질 때까지 시계는 멈춘다.
    if (state.dayFade !== 'NONE') return

    const advance = advanceClock(state.clock, dt)
    if (advance.daysPassed <= 0) {
      set({ clock: advance.next })
      return
    }

    // 정산은 화면이 완전히 어두워진 뒤에 한다. 하늘과 소지금이 눈앞에서 튀면 하루가 끝난 느낌이 없다.
    set({ dayFade: 'OUT', pendingDay: advance })
  },

  /**
   * 밀어 둔 하루 정산.
   *
   * 시계를 여기서 한 번에 넘긴다 — 암전 동안 시계를 멈춰 둔 덕분에
   * 정산과 날짜 넘김이 같은 `set` 안에서 원자적으로 일어난다.
   */
  finishDay: () => {
    const state = get()
    const pending = state.pendingDay
    // 페이드가 두 번 끝났다고 두 번 정산할 수는 없다.
    if (!pending) return
    const { next, daysPassed } = pending

    let gold = state.gold
    let reputation = state.reputation
    let animals = state.animals
    let orders = state.orders
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

      // 기한이 지난 의뢰를 걷어내고 자리가 있으면 하나 게시한다.
      orders = expireOrders(orders, today)
      if (orders.length < MAX_ACTIVE_ORDERS) {
        const rng = createRng(today * 2654435761 + orders.length)
        orders = [...orders, createOrder(createAnimalId(), today, reputation, rng)]
      }
    }

    set((s) => ({
      clock: next,
      gold,
      reputation,
      animals,
      orders,
      lastReport: report,
      reports: report ? [report, ...s.reports].slice(0, REPORT_HISTORY) : s.reports,
      modal: 'REPORT',
      dayFade: 'HOLD',
      pendingDay: null,
    }))
  },

  endDayFade: () => set({ dayFade: 'NONE' }),

  moveEnclosure: (direction) => {
    set({ currentEnclosure: neighborEnclosure(get().currentEnclosure, direction) })
  },

  setOption: (key, value) => set((s) => ({ options: { ...s.options, [key]: value } })),

  isUnlocked: (id) => get().unlocked.includes(id),

  canOrderAnimal: () => get().gold >= ANIMAL_CREATE_COST,

  patchDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  clearDraft: () => set({ draft: emptyDraft(randomTraits(createRng(Date.now() & 0xffff))) }),

  canPlaceIn: (enclosureId) => {
    const { animals, unlocked } = get()
    if (!unlocked.includes(enclosureId)) return false
    return placedIn(animals, enclosureId).length < MAX_ANIMALS_PER_ENCLOSURE
  },

  orderAnimal: (animal) => {
    const state = get()
    if (!state.canOrderAnimal()) return false

    // 튜토리얼 첫 동물은 배송을 건너뛴다. 하루를 기다리게 하면 흐름이 끊긴다.
    const placed = skipsShipping(state.tutorial)
      ? { ...animal, status: 'STORED' as const }
      : animal

    set((s) => ({
      gold: s.gold - ANIMAL_CREATE_COST,
      animals: [...s.animals, placed],
      tutorial: s.tutorial === 'DRAW' ? 'INSPECT' : s.tutorial,
      draft: emptyDraft(randomTraits(createRng(Date.now() & 0xffff))),
    }))
    return true
  },

  placeAnimal: (id, enclosureId) => {
    const { animals } = get()
    const target = animals.find((a) => a.id === id)
    if (!target || target.status !== 'STORED') return false
    if (!get().canPlaceIn(enclosureId)) return false

    set((s) => ({
      animals: s.animals.map((a) =>
        a.id === id ? { ...a, status: 'PLACED' as const, enclosureId } : a,
      ),
      tutorial: s.tutorial === 'PLACE' ? 'DONE' : s.tutorial,
    }))
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

  fulfillOrder: (orderId, animalId) => {
    const { orders, animals } = get()
    const order = orders.find((o) => o.id === orderId)
    const animal = animals.find((a) => a.id === animalId)
    if (!order || !animal || !matchesOrder(animal, order)) return false

    // 넘긴 동물은 동물원을 떠난다. 그림도 더는 참조되지 않는다.
    void deleteImage(animal.imageId)
    forgetBitmap(animal.imageId)

    audio.playSting('REWARD')

    set((s) => ({
      gold: s.gold + order.rewardGold,
      reputation: s.reputation + order.rewardFame,
      animals: s.animals.filter((a) => a.id !== animalId),
      orders: s.orders.filter((o) => o.id !== orderId),
    }))
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
    set({ ...initial, draft: emptyDraft(randomTraits(createRng(7))), screen: 'NAMING' })
  },

  confirmZooName: (name) => {
    // 첫날부터 게시판이 비어 있으면 탭이 왜 있는지 알 수 없다. 하나는 깔고 시작한다.
    const firstOrder = createOrder(createAnimalId(), 1, START_REPUTATION, createRng(0xa11ce))
    set({ zooName: name, orders: [firstOrder], screen: 'ZOO', tutorial: 'ORDER' })
  },

  continueGame: () => {
    const save = loadSave()
    if (!save) return false

    set({
      screen: 'ZOO',
      modal: null,
      dayFade: 'NONE',
      pendingDay: null,
      zooName: save.zooName ?? '',
      tutorial: save.tutorial ?? 'DONE',
      gold: save.gold,
      gems: save.gems ?? START_GEMS,
      reputation: save.reputation,
      clock: save.clock,
      currentEnclosure: save.currentEnclosure,
      unlocked: save.unlocked,
      animals: save.animals,
      orders: save.orders ?? [],
      lastReport: save.lastReport,
      reports: save.reports ?? [],
      options: save.options ?? initial.options,
    })
    return true
  },

  snapshot: () => {
    const s = get()
    return {
      version: 2,
      savedAt: Date.now(),
      zooName: s.zooName,
      tutorial: s.tutorial,
      gold: s.gold,
      gems: s.gems,
      reputation: s.reputation,
      clock: s.clock,
      currentEnclosure: s.currentEnclosure,
      unlocked: s.unlocked,
      animals: s.animals,
      orders: s.orders,
      lastReport: s.lastReport,
      reports: s.reports,
      options: s.options,
    }
  },
}))

/** 운영 현황에 남겨 두는 정산 기록 수. */
const REPORT_HISTORY = 7

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
    state.orders.length,
    state.tutorial,
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
    // 타이틀과 이름 짓기 중에는 저장하지 않는다. 기존 세이브를 덮으면 안 된다.
    if (state.screen === 'TITLE' || state.screen === 'NAMING') return
    // 암전 중에는 시계가 어제 끝에 멈춰 있고 정산은 아직 안 끝났다.
    // 이때 저장하면 다시 켰을 때 같은 날을 한 번 더 정산한다.
    if (state.dayFade === 'OUT') return
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
