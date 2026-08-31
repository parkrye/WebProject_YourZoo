import { create } from 'zustand'
import type { BiomeId } from '@/assets/manifest'
import { createAnimalId, placedIn, type Animal } from '@/domain/animal'
import {
  ANIMAL_CREATE_COST, ANIMAL_NAME_MAX_LENGTH, ANIMAL_SELL_REFUND, CASH_TO_GOLD, DAY_DURATION_SEC,
  MAX_ANIMALS_PER_ENCLOSURE,
  PROP_CREATE_COST, PROP_SELL_RATIO, SHEET_COST, SHIPPING_DAYS,
  START_CASH, START_GOLD, START_REPUTATION, UNLOCK_COST, UNLOCK_REPUTATION,
  productTotal, type CashProduct,
} from '@/domain/balance'
import { canPlaceProp, createPropId, propPrice, type OwnedProp } from '@/domain/prop'
import {
  isShopAnimal, shopAnimalAppeal, shopAnimalTraits, sheetImageId, shopPropName,
  type ShopAnimal, type ShopProp,
} from '@/domain/shop'
import { MOTION_PROFILES } from '@/domain/motion'
import { templateOf } from '@/domain/templates'
import { bakeSheet } from '@/render/animal/bakeSheet'
import { advanceClock, type ClockAdvanceResult, type ClockState } from '@/domain/clock'
import { createUserId, isUserId } from '@/domain/userId'
import { dayIncome, settleDay, type DailyReport } from '@/domain/economy'
import { ENCLOSURE_ORDER, neighborEnclosure, neighborUnlocked } from '@/domain/enclosure'
import { createOrder, expireOrders, matchesOrder, MAX_ACTIVE_ORDERS, type Order } from '@/domain/orders'
import {
  emptyAnimalDraft, emptyPropDraft, emptyRequestDraft,
  type AnimalDraft, type PropDraft, type RequestDraft, type RequestTab,
} from '@/domain/requestDraft'
import { type TutorialStep } from '@/domain/tutorial'
import { createRng } from '@/core/rng'
import { audio } from '@/audio/AudioManager'
import { ensureBitmap, forgetBitmap, getBitmap, preloadRemote, registerFromBlob } from '@/sim/imageCache'
import { deleteImage, putImage } from './imageDb'
import { clearSave, loadSave, writeSave, type SaveV2 } from './save'
import { publishZoo, type ZooDoc } from '@/net/zooApi'
import {
  fetchCloudSave, logIn, pushCloudSave, signUp, type Account,
} from '@/net/authApi'
import { getImage } from './imageDb'

export type ScreenId = 'TITLE' | 'AUTH' | 'NAMING' | 'ZOO' | 'ZOO_DETAIL'
export type ModalId =
  | 'OPTIONS' | 'STATUS' | 'REQUEST' | 'REPORT' | 'SHOP' | 'VISIT' | 'ARRIVAL' | null

/**
 * 서버 동기화 상태.
 *
 * `OFF`     비회원. 올릴 곳이 없다
 * `PENDING` 계정은 있는데 아직 한 번도 올리지 못했다
 * `SYNCED`  마지막 시도가 성공했다
 * `FAILED`  서버에 못 닿았다. 로컬 세이브는 멀쩡하다
 */
export type SyncState = 'OFF' | 'PENDING' | 'SYNCED' | 'FAILED'

/** 하루가 시작될 때 창고에 도착한 것들. */
export interface Arrivals {
  readonly animals: readonly Animal[]
  readonly props: readonly OwnedProp[]
}

/**
 * 하루가 넘어갈 때의 암전 단계.
 *
 * `OUT` 어두워지는 중 (시계 정지, 정산 대기)
 * `HOLD` 완전히 어두움. 정산이 끝났고 리포트가 떠 있다
 * `IN` 다시 밝아지는 중
 */
export type DayFade = 'NONE' | 'OUT' | 'HOLD' | 'IN'

/**
 * 동물원을 오갈 때의 암전 단계.
 *
 * 하루 넘김과 단계 이름은 같지만 **뜻이 다르다** — 여기서 `HOLD` 는 읽을 것이 있어
 * 멈춘 게 아니라, 어디로 가는지 한 줄 읽을 시간을 주려고 잠깐 캄캄한 상태다.
 */
export type TravelPhase = 'NONE' | 'OUT' | 'HOLD' | 'IN'

export interface OptionsState {
  bgm: number
  sfx: number
}

interface GameState {
  screen: ScreenId
  modal: ModalId
  /** 플레이어가 지은 동물원 이름. A-Z / 0-9 / 공백만 가능. */
  /** 이 동물원 주인의 식별자. 새 게임에서 발급하고 바뀌지 않는다. */
  userId: string
  /** 로그인한 계정. 비회원이면 null. 세이브에는 넣지 않는다 — 따로 보관한다. */
  account: Account | null
  zooName: string
  /** 그림판이 열려 있는가. 시계를 멈출지 판단하는 데 쓴다. */
  isDrawing: boolean
  tutorial: TutorialStep
  gold: number
  /**
   * 오늘 이미 손에 쥔 수입.
   *
   * 수입은 하루가 끝날 때 한꺼번에 들어오는 게 아니라 **시간에 비례해 조금씩** 들어온다.
   * 자정 정산은 오늘치에서 이 값을 뺀 나머지만 준다 — 안 그러면 두 번 받는다.
   */
  earnedToday: number
  /** 유료 재화. 충전·소모는 아직 없고 보유량만 들고 있는다. */
  /** 캐시(유료 재화). 상점에서 사고, 스프라이트 시트를 만들 때 쓴다. */
  cash: number
  reputation: number
  clock: ClockState
  currentEnclosure: BiomeId
  unlocked: BiomeId[]
  animals: Animal[]
  /** 소유한 프롭. 동물과 같은 배송 -> 창고 -> 배치 흐름을 탄다. */
  props: OwnedProp[]
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
  /** 구경 중인 남의 동물원. null 이면 내 동물원이다. 세이브에는 넣지 않는다. */
  visiting: ZooDoc | null
  /**
   * 동물원을 오갈 때의 암전 단계.
   *
   * 예전에는 남의 동물원이 **한 프레임 만에 바뀌었다.** 배경도 우리도 비슷해서
   * 들어간 건지 아직 내 동물원인지 알 수 없었다. 어두워졌다 밝아지고,
   * 캄캄한 동안 어디로 가는지 한 줄 적어 준다.
   */
  travel: TravelPhase
  /** 암전이 끝나면 적용할 이동. `visiting: null` 이면 집으로 돌아온다. */
  pendingTravel: { visiting: ZooDoc | null } | null
  /** 구경 중에 보고 있는 우리. 내 `currentEnclosure` 를 건드리지 않는다. */
  visitEnclosure: BiomeId
  /** 오늘 아침 창고에 도착한 것들. 알림을 닫으면 비운다. 세이브에는 넣지 않는다. */
  arrivals: Arrivals | null
  /** 서버 동기화 상태. 계정이 없으면 늘 `OFF`. */
  sync: SyncState

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
  /** 남의 동물원 구경을 시작한다. 그림을 먼저 받아 두고 들어간다. */
  startVisit(doc: ZooDoc): Promise<void>
  /** 구경을 끝내고 내 동물원으로 돌아온다. */
  endVisit(): void
  /** 암전의 다음 단계로. 진행은 화면 쪽(`TravelFade`)이 재고 여기서는 단계만 넘긴다. */
  advanceTravel(): void
  /** 도착 알림을 닫는다. */
  clearArrivals(): void
  moveEnclosure(direction: -1 | 1): void
  setOption<K extends keyof OptionsState>(key: K, value: OptionsState[K]): void
  /** 요청서 제출. 비용을 차감하고 배송 대기 상태로 넣는다. */
  /** 요청서 제출. 값은 만드는 방식이 정한다. */
  orderAnimal(animal: Animal, cost?: number): boolean
  canOrderAnimal(): boolean
  /** 요청서에서 보던 탭. 창을 닫았다 열어도 그 자리로 돌아온다. */
  setRequestTab(tab: RequestTab): void
  patchAnimalDraft(patch: Partial<AnimalDraft>): void
  patchPropDraft(patch: Partial<PropDraft>): void
  /** 창고에서 우리로. 서식지·정원이 맞지 않으면 false. */
  placeAnimal(id: string, enclosureId: BiomeId): boolean
  /** 우리에서 창고로. */
  storeAnimal(id: string): boolean
  /** 창고에서 판매. 제작비의 절반을 돌려받는다. */
  sellAnimal(id: string): boolean
  /** 캐시 상품 구매. 실제 결제는 없고 그냥 지급한다. */
  buyCash(product: CashProduct): void
  /** 캐시를 코인으로 바꾼다. 한 방향뿐이라 되돌릴 수 없다. */
  exchangeCash(count: number): boolean
  /** 캐시를 써서 8x3 스프라이트 시트를 만든다. 성공하면 true. */
  animateAnimal(id: string): Promise<boolean>
  /** 동물 이름을 바꾼다. 빈 이름은 무시한다. */
  renameAnimal(id: string, name: string): void
  /** 상점에서 동물을 산다. 코인을 내고 배송을 건다. */
  buyShopAnimal(item: ShopAnimal): boolean
  /** 상점에서 프롭을 산다. 코인을 내고 배송을 건다. */
  buyShopProp(item: ShopProp): boolean
  /** 직접 그린 프롭을 주문한다. 값은 만드는 방식이 정한다. */
  orderProp(prop: OwnedProp, cost?: number): boolean
  /** 창고에서 우리로. 자리를 함께 정한다. */
  placeProp(id: string, enclosureId: BiomeId, x: number, y: number): boolean
  /** 우리에서 창고로. */
  storeProp(id: string): boolean
  /** 창고에서 판매. 값의 절반을 돌려받는다. */
  sellProp(id: string): boolean
  /** 의뢰를 이행한다. 동물을 넘기고 보상을 받는다. */
  fulfillOrder(orderId: string, animalId: string): boolean
  canPlaceIn(enclosureId: BiomeId): boolean
  unlockEnclosure(id: BiomeId): boolean
  isUnlocked(id: BiomeId): boolean

  /** 비회원으로 시작한다. 무작위 아이디를 발급하고 이름 짓기로 간다. */
  startNewGame(): void
  /** 회원가입. 성공하면 아이디를 그 계정으로 두고 이름 짓기로 간다. */
  signUpAndStart(userId: string, password: string): Promise<string | null>
  /** 로그인. 서버에 세이브가 있으면 그걸로 이어하고, 없으면 이름 짓기로 간다. */
  logInAndStart(userId: string, password: string): Promise<string | null>
  /** 로그아웃하고 타이틀로 돌아간다. */
  logOut(): void
  /** 놀던 것을 저장해 두고 타이틀로 돌아간다. 로그아웃과 달리 계정은 그대로다. */
  goToTitle(): void
  /** 이름을 확정하고 게임에 진입한다. */
  confirmZooName(name: string): void
  continueGame(): boolean
  snapshot(): SaveV2
}

const initial = {
  screen: 'TITLE' as ScreenId,
  modal: null as ModalId,
  userId: '',
  account: null as Account | null,
  zooName: '',
  isDrawing: false,
  tutorial: 'DONE' as TutorialStep,
  gold: START_GOLD,
  earnedToday: 0,
  cash: START_CASH,
  reputation: START_REPUTATION,
  clock: { day: 1, elapsed: 0 } as ClockState,
  currentEnclosure: 'FIELD' as BiomeId,
  unlocked: ['FIELD'] as BiomeId[],
  animals: [] as Animal[],
  props: [] as OwnedProp[],
  orders: [] as Order[],
  draft: emptyRequestDraft(),
  lastReport: null as DailyReport | null,
  reports: [] as DailyReport[],
  options: { bgm: 0.7, sfx: 0.8 },
  dayFade: 'NONE' as DayFade,
  pendingDay: null as ClockAdvanceResult | null,
  visiting: null as ZooDoc | null,
  travel: 'NONE' as TravelPhase,
  pendingTravel: null as { visiting: ZooDoc | null } | null,
  visitEnclosure: 'FIELD' as BiomeId,
  arrivals: null as Arrivals | null,
  sync: 'OFF' as SyncState,
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
  /**
   * 정산 팝업을 닫는 건 하루 연출의 마지막 단계다. 닫히면서 화면이 다시 밝아진다.
   * 다만 오늘 도착한 것이 있으면 알림을 먼저 띄우고, 그게 닫힐 때 밝아진다.
   */
  closeModal: () =>
    set((s) => {
      if (s.dayFade !== 'HOLD') return { modal: null }
      if (s.modal === 'REPORT' && s.arrivals) return { modal: 'ARRIVAL' as const }
      return { modal: null, dayFade: 'IN' as const, arrivals: null }
    }),

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
    // 동물원을 오가는 동안에도 멈춘다. 캄캄한 사이에 자정이 오면 두 연출이 겹친다.
    if (state.travel !== 'NONE') return
    // 암전이 시작되면 정산이 끝나고 화면이 다시 밝아질 때까지 시계는 멈춘다.
    if (state.dayFade !== 'NONE') return
    // 남의 동물원을 보는 중에 내 하루가 끝나 암전과 리포트가 끼어들면 곤란하다.
    if (state.visiting) return

    const advance = advanceClock(state.clock, dt)
    if (advance.daysPassed <= 0) {
      /*
        수입을 시간에 비례해 조금씩 준다. 하루가 끝날 때 한꺼번에 주면
        노는 동안에는 아무 일도 안 일어나고 자정에만 숫자가 튄다.

        소수점은 들고 있지 않는다. **지금까지 벌었어야 할 총액**을 매번 새로 구하고
        이미 준 만큼을 뺀다. 그러면 반올림 오차가 쌓이지 않고,
        하루가 끝나는 순간 정확히 하루치가 된다.
      */
      const earned = Math.floor(
        dayIncome(state.animals, state.unlocked, state.reputation)
        * (advance.next.elapsed / DAY_DURATION_SEC),
      )
      const gain = earned - state.earnedToday
      set(gain > 0
        ? { clock: advance.next, gold: state.gold + gain, earnedToday: earned }
        : { clock: advance.next })
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
    let props = state.props
    let orders = state.orders
    // 여러 날이 한 번에 넘어갈 수 있다. 그 사이 도착한 것을 모아 한 번에 알린다.
    const arrivedAnimals: Animal[] = []
    const arrivedProps: OwnedProp[] = []
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
        arrivedAnimals.push(...arriving.map((a) => ({ ...a, status: 'STORED' as const })))
      }

      // 프롭도 같은 날 도착한다. 사육비가 없어 정산에는 들어가지 않는다.
      const arrivingProps = props.filter((p) => p.status === 'SHIPPING' && p.arrivalDay <= today)
      if (arrivingProps.length > 0) {
        props = props.map((p) =>
          p.status === 'SHIPPING' && p.arrivalDay <= today
            ? { ...p, status: 'STORED' as const }
            : p,
        )
        arrivedProps.push(...arrivingProps.map((p) => ({ ...p, status: 'STORED' as const })))
      }

      report = settleDay({
        day: state.clock.day + i,
        animals,
        unlocked: state.unlocked,
        reputation,
        arrivedCount: arriving.length,
      })
      // 오늘치는 이미 조금씩 줬다. 그만큼 빼야 두 번 주지 않는다.
      // 탭이 오래 꺼져 여러 날이 한 번에 넘어가면 첫날만 뺀다 — 나머지 날은 준 적이 없다.
      gold = Math.max(0, gold + report.net - (i === 0 ? state.earnedToday : 0))
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
      earnedToday: 0,
      reputation,
      animals,
      props,
      orders,
      lastReport: report,
      reports: report ? [report, ...s.reports].slice(0, REPORT_HISTORY) : s.reports,
      modal: 'REPORT',
      dayFade: 'HOLD',
      pendingDay: null,
      // 도착 알림은 정산을 읽은 뒤에 뜬다. 둘을 한 화면에 겹치면 어느 쪽도 안 읽힌다.
      arrivals:
        arrivedAnimals.length + arrivedProps.length > 0
          ? { animals: arrivedAnimals, props: arrivedProps }
          : null,
    }))

    // 하루가 끝날 때 한 번만 올린다. 구경하는 사람이 보는 건 '어제 자정의 동물원'이다.
    void publishCurrentZoo()
    // 정산 직후는 반드시 올린다. 오토세이브의 간격 제한을 건너뛴다.
    void pushCurrentSave(true)
  },

  endDayFade: () => set({ dayFade: 'NONE' }),

  clearArrivals: () => set({ arrivals: null }),

  moveEnclosure: (direction) => {
    const { visiting, visitEnclosure, currentEnclosure } = get()
    // 구경 중에는 그 동물원이 연 우리 안에서만 돈다. 잠긴 우리는 볼 수 없다.
    if (visiting) {
      set({ visitEnclosure: neighborUnlocked(visitEnclosure, direction, visiting.unlocked) })
      return
    }
    set({ currentEnclosure: neighborEnclosure(currentEnclosure, direction) })
  },

  startVisit: async (doc) => {
    // 남의 그림은 내 IndexedDB 에 없다. 들어가기 전에 받아 둬야 빈 우리를 보지 않는다.
    // 암전보다 **먼저** 받는다. 캄캄한 동안 받으면 밝아진 뒤에도 우리가 비어 있다.
    const ids = [
      ...doc.animals.flatMap((a) => [
        a.imageId,
        ...(a.spriteSheet ? [a.spriteSheet.imageId] : []),
        // 리그 동물은 부위 그림까지 받아야 한다. 빠지면 몸통 한 조각만 늘어난다.
        ...Object.values(a.rig ?? {}),
      ]),
      ...(doc.props ?? []).map((p) => p.imageId).filter((id): id is string => id !== null),
    ]
    await preloadRemote(ids)
    set({ travel: 'OUT', pendingTravel: { visiting: doc }, modal: null })
  },

  endVisit: () => set({ travel: 'OUT', pendingTravel: { visiting: null }, modal: null }),

  advanceTravel: () => {
    const { travel, pendingTravel } = get()
    if (travel === 'OUT') {
      const doc = pendingTravel?.visiting ?? null
      set({
        visiting: doc,
        ...(doc && { visitEnclosure: firstUnlocked(doc.unlocked) }),
        screen: 'ZOO',
        modal: null,
        pendingTravel: null,
        travel: 'HOLD',
      })
      return
    }
    set({ travel: travel === 'HOLD' ? 'IN' : 'NONE' })
  },

  setOption: (key, value) => set((s) => ({ options: { ...s.options, [key]: value } })),

  goToTitle: () => {
    /*
      화면을 바꾸기 **전에** 저장한다. 주기 저장은 동물원 안에서만 도는데,
      화면부터 넘기면 그 구독이 타이틀에서 깨어나 아무것도 쓰지 않고 돌아간다.
      그러면 마지막 저장 이후의 진행이 통째로 사라진다.
    */
    writeSave(get().snapshot())
    void pushCurrentSave(true)
    set({
      screen: 'TITLE',
      modal: null,
      // 남의 동물원을 보던 중이었다면 그것부터 놓는다. 암전도 함께 걷는다.
      visiting: null,
      travel: 'NONE',
      pendingTravel: null,
    })
  },

  isUnlocked: (id) => get().unlocked.includes(id),

  canOrderAnimal: () => get().gold >= ANIMAL_CREATE_COST,

  setRequestTab: (tab) => set((s) => ({ draft: { ...s.draft, tab } })),
  patchAnimalDraft: (patch) =>
    set((s) => ({ draft: { ...s.draft, animal: { ...s.draft.animal, ...patch } } })),
  patchPropDraft: (patch) =>
    set((s) => ({ draft: { ...s.draft, prop: { ...s.draft.prop, ...patch } } })),

  canPlaceIn: (enclosureId) => {
    const { animals, unlocked } = get()
    if (!unlocked.includes(enclosureId)) return false
    return placedIn(animals, enclosureId).length < MAX_ANIMALS_PER_ENCLOSURE
  },

  orderAnimal: (animal, cost = ANIMAL_CREATE_COST) => {
    const state = get()
    if (state.gold < cost) return false

    /*
      **처음 그린 동물은 배송을 건너뛴다.** 하루를 기다리게 하면 흐름이 끊긴다 —
      막 그림을 그려 놓고 아무 일도 일어나지 않으면 무엇을 만들었는지 확인할 수가 없다.

      튜토리얼을 봤는지와는 무관하다. 건너뛰고 시작한 사람도 첫 동물은 바로 받는다.
      두 번째부터는 배송을 기다린다 — 그때는 이미 흐름을 안다.
    */
    const first = !state.animals.some((a) => !isShopAnimal(a))
    const placed = first ? { ...animal, status: 'STORED' as const } : animal

    set((s) => ({
      gold: s.gold - cost,
      animals: [...s.animals, placed],
      tutorial: s.tutorial === 'DRAW' ? 'INSPECT' : s.tutorial,
      // 초안은 여기서만 비운다. 제출이 성공한 순간이 유일하게 안전한 시점이다.
      draft: { ...s.draft, animal: emptyAnimalDraft() },
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

  buyCash: (product) => set((s) => ({ cash: s.cash + productTotal(product) })),

  exchangeCash: (count) => {
    const { cash } = get()
    if (count < 1 || cash < count) return false
    set((s) => ({ cash: s.cash - count, gold: s.gold + count * CASH_TO_GOLD }))
    return true
  },

  buyShopAnimal: (item) => {
    const { gold, clock } = get()
    if (gold < item.price) return false

    const animal: Animal = {
      id: createAnimalId(),
      name: item.catalogId,
      // 상점 동물도 바로 우리에 들어가지 않는다. 배송 -> 창고 -> 배치 순이다.
      status: 'SHIPPING',
      enclosureId: null,
      // 그림이 없다. 시트가 곧 이 동물의 모습이라 같은 키를 쓴다.
      imageId: sheetImageId(item.catalogId),
      traits: shopAnimalTraits(item),
      templateId: 'FREE',
      spriteSheet: {
        imageId: sheetImageId(item.catalogId),
        cols: item.sheet.cols,
        rows: item.sheet.rows,
        frames: item.sheet.frames,
        // 한 줄이 1초에 한 바퀴 돈다. 칸이 7개면 조금 느리게 돈다.
        fps: item.sheet.cols,
        /*
          줄 수는 시트마다 다르다. 시그니처가 없는 두 줄짜리도 있고, 아직 걷는 줄이
          안 온 한 줄짜리도 있다. 세 줄이라고 박아 두면 없는 줄을 읽어 빈 칸이 뜬다.
          모르는 모션은 SheetRenderer 가 첫 줄로 돌린다.
        */
        motions: item.sheet.motions,
        fit: item.sheet.fit,
        baseline: item.sheet.baseline,
      },
      rig: null,
      orderedDay: clock.day,
      // 이미 만들어져 있는 물건이라 하루면 온다.
      arrivalDay: clock.day + SHIPPING_DAYS.SHOP,
      appeal: shopAnimalAppeal(item),
    }

    // 처음 산 동물은 바로 창고에 넣는다. 그린 동물과 같은 이유다.
    const first = !get().animals.some(isShopAnimal)
    const arrived = first ? { ...animal, status: 'STORED' as const } : animal

    set((s) => ({ gold: s.gold - item.price, animals: [...s.animals, arrived] }))
    return true
  },

  buyShopProp: (item) => {
    const { gold, clock } = get()
    if (gold < item.price) return false

    const prop: OwnedProp = {
      id: createPropId(),
      name: shopPropName(item),
      status: 'SHIPPING',
      enclosureId: null,
      sheetBiome: item.biome,
      sprite: item.sprite,
      imageId: null,
      strip: null,
      layer: item.layer,
      x: 0,
      y: 0,
      orderedDay: clock.day,
      arrivalDay: clock.day + SHIPPING_DAYS.SHOP,
    }

    set((s) => ({ gold: s.gold - item.price, props: [...s.props, prop] }))
    return true
  },

  orderProp: (prop, cost = PROP_CREATE_COST) => {
    const { gold } = get()
    if (gold < cost) return false
    set((s) => ({
      gold: s.gold - cost,
      props: [...s.props, prop],
      draft: { ...s.draft, prop: emptyPropDraft() },
    }))
    return true
  },

  placeProp: (id, enclosureId, x, y) => {
    const { props } = get()
    const target = props.find((p) => p.id === id)
    if (!target || target.status !== 'STORED') return false
    if (!canPlaceProp(props, enclosureId)) return false

    set((s) => ({
      props: s.props.map((p) =>
        p.id === id ? { ...p, status: 'PLACED' as const, enclosureId, x, y } : p,
      ),
    }))
    return true
  },

  storeProp: (id) => {
    const { props } = get()
    const target = props.find((p) => p.id === id)
    if (!target || target.status !== 'PLACED') return false

    set({
      props: props.map((p) =>
        p.id === id ? { ...p, status: 'STORED' as const, enclosureId: null } : p,
      ),
    })
    return true
  },

  sellProp: (id) => {
    const { props } = get()
    const target = props.find((p) => p.id === id)
    if (!target || target.status !== 'STORED') return false

    // 그린 프롭의 그림은 더 이상 참조되지 않는다. 저장소와 메모리 양쪽에서 지운다.
    if (target.imageId) {
      void deleteImage(target.imageId)
      forgetBitmap(target.imageId)
    }

    const refund = Math.floor(
      (target.imageId ? PROP_CREATE_COST : propPrice(target.layer)) * PROP_SELL_RATIO,
    )
    set((s) => ({ gold: s.gold + refund, props: s.props.filter((p) => p.id !== id) }))
    return true
  },

  renameAnimal: (id, name) => {
    const trimmed = name.trim().slice(0, ANIMAL_NAME_MAX_LENGTH)
    // 이름을 지워 빈 칸으로 두면 카드 머리가 비어 무엇을 보는 중인지 알 수 없다.
    if (trimmed === '') return
    set((s) => ({ animals: s.animals.map((a) => (a.id === id ? { ...a, name: trimmed } : a)) }))
  },

  /**
   * 캐시를 써서 그림을 스프라이트 시트로 굽는다.
   *
   * 캐시는 **굽기가 끝난 뒤에** 차감한다. 먼저 빼면 중간에 실패했을 때
   * 아무것도 못 얻고 캐시만 사라진다.
   */
  animateAnimal: async (id) => {
    const { animals, cash } = get()
    const target = animals.find((a) => a.id === id)
    if (!target || target.spriteSheet || cash < SHEET_COST) return false

    const source = getBitmap(target.imageId) ?? (await ensureBitmap(target.imageId))
    if (!source) return false

    try {
      const profile = MOTION_PROFILES[templateOf(target.templateId).archetype]
      const { blob, meta } = await bakeSheet(source, profile)
      const imageId = `${target.imageId}-sheet`
      await putImage(imageId, blob)
      await registerFromBlob(imageId, blob)

      set((s) => ({
        cash: s.cash - SHEET_COST,
        animals: s.animals.map((a) =>
          a.id === id ? { ...a, spriteSheet: { imageId, ...meta } } : a,
        ),
      }))
      return true
    } catch {
      // 캔버스나 저장소가 막힌 경우. 캐시는 아직 그대로다.
      return false
    }
  },

  unlockEnclosure: (id) => {
    const { gold, reputation, unlocked } = get()
    if (unlocked.includes(id)) return false

    // 돈과 명성을 **둘 다** 본다. 명성은 동물을 배치해야만 오르므로,
    // 화면만 켜 두고 모은 돈으로 우리를 늘리는 길을 막는다.
    if (reputation < UNLOCK_REPUTATION[id]) return false

    const cost = UNLOCK_COST[id]
    if (gold < cost) return false

    set({ gold: gold - cost, unlocked: [...unlocked, id] })
    return true
  },

  startNewGame: () => {
    clearSave()
    clearAccount()
    set({
      ...initial,
      userId: createUserId(),
      draft: emptyRequestDraft(),
      screen: 'NAMING',
    })
  },

  signUpAndStart: async (userId, password) => {
    const result = await signUp(userId.trim().toUpperCase(), password)
    if (!result.account) return result.error ?? 'SIGN UP FAILED'

    clearSave()
    writeAccount(result.account)
    // 가입 직후에는 이어할 것이 없다. 아이디만 계정 것으로 두고 새로 시작한다.
    set({
      ...initial,
      userId: result.account.userId,
      account: result.account,
      // 계정만 생겼을 뿐 아직 올린 것은 없다. 여기서 SYNCED 라고 하면 거짓말이 된다.
      sync: 'PENDING',
      draft: emptyRequestDraft(),
      screen: 'NAMING',
    })
    return null
  },

  logInAndStart: async (userId, password) => {
    const result = await logIn(userId.trim().toUpperCase(), password)
    if (!result.account) return result.error ?? 'LOGIN FAILED'

    writeAccount(result.account)
    const cloud = result.hasSave ? await fetchCloudSave(result.account) : null

    if (!cloud) {
      // 계정은 있는데 동물원이 아직 없다. 이름부터 짓는다.
      clearSave()
      set({
        ...initial,
        userId: result.account.userId,
        account: result.account,
        draft: emptyRequestDraft(),
        screen: 'NAMING',
      })
      return null
    }

    // 다른 기기에서 그린 그림은 이 기기에 없다. 들어가기 전에 받아 둔다.
    await preloadRemote(imageIdsOf(cloud))
    writeSave(cloud)
    set({ account: result.account, sync: 'SYNCED' })
    get().continueGame()
    return null
  },

  logOut: () => {
    clearAccount()
    set({ account: null, sync: 'OFF', screen: 'TITLE', modal: null })
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
      // 새로고침해도 로그인 상태는 남아 있어야 한다.
      account: get().account ?? readAccount(),
      // 구버전 세이브에는 아이디가 없다. 이어할 때 조용히 하나 발급한다.
      userId: isUserId(save.userId) ? save.userId : createUserId(),
      zooName: save.zooName ?? '',
      tutorial: save.tutorial ?? 'DONE',
      gold: save.gold,
      earnedToday: save.earnedToday ?? 0,
      cash: save.cash ?? START_CASH,
      reputation: save.reputation,
      clock: save.clock,
      currentEnclosure: save.currentEnclosure,
      unlocked: save.unlocked,
      animals: save.animals,
      props: save.props ?? [],
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
      userId: s.userId,
      zooName: s.zooName,
      tutorial: s.tutorial,
      gold: s.gold,
      earnedToday: s.earnedToday,
      cash: s.cash,
      reputation: s.reputation,
      clock: s.clock,
      currentEnclosure: s.currentEnclosure,
      unlocked: s.unlocked,
      animals: s.animals,
      props: s.props,
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
    // 오늘치 수입은 소지금과 함께 움직인다. 이것만 빠지면 새로고침으로 다시 받는다.
    state.earnedToday,
    // 캐시는 돈 주고 산 것이다. 사자마자 탭을 닫아도 남아 있어야 한다.
    state.cash,
    state.reputation,
    state.clock.day,
    state.animals.length,
    // 배치/창고 이동도 즉시 저장 대상이다.
    state.animals.filter((a) => a.status === 'PLACED').length,
    // 시트를 구웠다는 사실도. 캐시가 나간 결과라 다음 주기까지 미룰 수 없다.
    state.animals.filter((a) => a.spriteSheet !== null).length,
    // 프롭도 코인을 주고 산 것이다. 사고 나서 탭을 닫아도 남아 있어야 한다.
    state.props.length,
    state.props.filter((p) => p.status === 'PLACED').length,
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
  /**
   * 로컬에 쓰고, 계정이 있으면 서버에도 올린다.
   *
   * `urgent` 는 탭을 닫거나 숨길 때다. 그때는 간격 제한을 무시한다 —
   * 다음 기회가 없을지도 모르는 자리에서 아끼면 그대로 잃는다.
   */
  const flush = (urgent = false): void => {
    const state = useGameStore.getState()
    /*
      **동물원 안에 있을 때만** 저장한다. 저장하지 않을 화면을 나열하는 방식이었는데
      로그인 화면이 빠져 있었다 — 로그인 칸만 열어 보고 나와도 주기 저장이 돌아
      시작하지도 않은 동물원이 써지고, 타이틀에 CONTINUE 가 생겼다.
      화면은 앞으로도 늘어나므로 허용할 곳을 적는 쪽이 안전하다.
    */
    if (state.screen !== 'ZOO' && state.screen !== 'ZOO_DETAIL') return
    // 암전 중에는 시계가 어제 끝에 멈춰 있고 정산은 아직 안 끝났다.
    // 이때 저장하면 다시 켰을 때 같은 날을 한 번 더 정산한다.
    if (state.dayFade === 'OUT') return
    writeSave(state.snapshot())
    // 계정이 있으면 서버에도 올린다. 하루 정산까지 기다리면 짧게 놀고 닫은 진행이 날아간다.
    void pushCurrentSave(urgent)
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
    if (document.visibilityState === 'hidden') flush(true)
  }
  const onPageHide = (): void => flush(true)

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)

  return () => {
    window.clearInterval(timer)
    unsubscribe()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
  }
}

/** 해금된 우리 중 첫 번째. 남의 동물원은 늘 여기서부터 본다. */
function firstUnlocked(unlocked: readonly BiomeId[]): BiomeId {
  return ENCLOSURE_ORDER.find((id) => unlocked.includes(id)) ?? 'FIELD'
}

/**
 * 내 동물원을 서버에 올린다. 하루 정산 때 한 번.
 *
 * 배치된 동물만 올린다 — 창고에 쌓아 둔 건 구경하는 사람에게 보이지 않는다.
 * 소지금도 담지 않는다. 남의 지갑이 보이면 자랑하려고 숫자를 부풀리는 쪽으로 놀이가 기운다.
 *
 * 실패해도 조용히 넘어간다. 서버가 없어도(정적 호스팅) 게임은 그대로 돌아가야 한다.
 */
async function publishCurrentZoo(): Promise<void> {
  const s = useGameStore.getState()
  if (!s.userId) return

  const animals = s.animals.filter((a) => a.status === 'PLACED')
  if (animals.length === 0) return
  const props = s.props.filter((p) => p.status === 'PLACED')

  const images: Record<string, string> = {}
  for (const animal of animals) {
    await collectImage(images, animal.imageId)
    if (animal.spriteSheet) await collectImage(images, animal.spriteSheet.imageId)
    /*
      파츠로 만든 동물은 **부위마다 그림이 따로다.** 이걸 빼고 올리면
      구경하는 쪽에서 부위를 하나도 못 읽어, 대표 그림(몸통 한 조각)을
      동물 한 마리 크기로 늘려 그린다. 기괴하게 보이던 원인이 이것이었다.
    */
    for (const partId of Object.values(animal.rig ?? {})) await collectImage(images, partId)
  }
  for (const prop of props) {
    if (prop.imageId) await collectImage(images, prop.imageId)
  }

  await publishZoo(
    {
      userId: s.userId,
      zooName: s.zooName,
      reputation: s.reputation,
      day: s.clock.day,
      unlocked: s.unlocked,
      animals,
      props,
    },
    images,
    s.account?.token,
  )
}

async function collectImage(into: Record<string, string>, id: string): Promise<void> {
  if (into[id]) return
  const blob = await getImage(id)
  if (!blob) return
  into[id] = await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

// ─────────────────────────────────────────────────────────────
// 계정 보관
// ─────────────────────────────────────────────────────────────

/** 세이브와 따로 둔다. 세이브를 지워도 로그인 상태는 남아야 한다. */
const ACCOUNT_KEY = 'yourzoo.account'

export function readAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Account>
    if (typeof parsed.userId !== 'string' || typeof parsed.token !== 'string') return null
    return { userId: parsed.userId, token: parsed.token }
  } catch {
    return null
  }
}

function writeAccount(account: Account): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
  } catch {
    // 저장 못 해도 이번 세션은 로그인 상태다. 새로고침하면 풀릴 뿐이다.
  }
}

function clearAccount(): void {
  try {
    localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // 지울 수 없으면 그냥 둔다.
  }
}

/** 세이브가 참조하는 모든 그림. 배치된 것뿐 아니라 창고와 배송 중인 것까지. */
function imageIdsOf(save: SaveV2): string[] {
  const ids = new Set<string>()
  for (const animal of save.animals) {
    ids.add(animal.imageId)
    if (animal.spriteSheet) ids.add(animal.spriteSheet.imageId)
  }
  for (const prop of save.props ?? []) {
    if (prop.imageId) ids.add(prop.imageId)
  }
  return [...ids]
}

/**
 * 마지막으로 올린 시각. 세이브가 바뀔 때마다 그림까지 실어 보낼 수는 없다.
 *
 * 처음에는 음의 무한대다. 0 으로 두면 페이지를 연 지 20초가 되기 전의 첫 저장이
 * 간격 제한에 걸려 통째로 건너뛰어진다 — 들어가자마자 닫으면 아무것도 안 올라간다.
 */
let lastPushAt = Number.NEGATIVE_INFINITY
/** 올리는 최소 간격. 이보다 잦으면 건너뛴다. */
const PUSH_INTERVAL_MS = 20_000

/**
 * 계정 세이브를 서버에 올린다.
 *
 * 공개용 동물원 문서(`publishCurrentZoo`)와 다르다 — 저쪽은 남에게 보여 줄 것만 담고,
 * 이쪽은 **이어하기에 필요한 전부**를 담는다. 소지금도 창고도 배송 중인 것도 들어간다.
 *
 * 그림을 base64 로 실어 보내므로 한 번이 무겁다. 평소에는 간격을 두고,
 * 하루 정산처럼 놓치면 안 되는 시점에는 `force` 로 건너뛴다.
 */
async function pushCurrentSave(force = false): Promise<void> {
  const s = useGameStore.getState()
  if (!s.account) return

  const now = performance.now()
  if (!force && now - lastPushAt < PUSH_INTERVAL_MS) return
  lastPushAt = now

  try {
    const save = s.snapshot()
    const images: Record<string, string> = {}
    for (const id of imageIdsOf(save)) await collectImage(images, id)

    const pushed = await pushCloudSave(s.account, save, images)
    useGameStore.setState({ sync: pushed ? 'SYNCED' : 'FAILED' })
  } catch {
    // 그림을 못 읽었거나 서버가 없다. 로컬 세이브는 멀쩡하므로 놀이는 이어진다.
    useGameStore.setState({ sync: 'FAILED' })
  }
}
