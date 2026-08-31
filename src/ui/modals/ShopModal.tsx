import { useEffect, useMemo, useState } from 'react'
import { GUI, type GuiIcon } from '@/assets/manifest'
import {
  CASH_PRODUCTS, CASH_TO_GOLD, SHIPPING_DAYS, SHOP_MAX_QUANTITY, type CashProduct,
} from '@/domain/balance'
import {
  isShopAnimal, shopProps, shopPropName, SHOP_ANIMALS,
  type ShopAnimal, type ShopProp,
} from '@/domain/shop'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { ConfirmPopup } from '@/ui/components/ConfirmPopup'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { Popup } from '@/ui/components/Popup'
import { PropThumb, SheetThumb } from '@/ui/components/SpriteThumb'
import { Tabs, type TabItem } from '@/ui/components/Tabs'
import { useGameStore } from '@/store/gameStore'

type ShopTab = 'CASH' | 'PROP' | 'ANIMAL'

const TABS: readonly TabItem<ShopTab>[] = [
  { id: 'ANIMAL', label: 'ANIMALS' },
  { id: 'PROP', label: 'PROPS' },
  { id: 'CASH', label: 'CASH' },
]

const POPUP_WIDTH = 1180
const POPUP_HEIGHT = 720
/** 오른쪽 판의 큰 그림. 목록의 썸네일과 확연히 달라야 "고른 것"으로 읽힌다. */
const PREVIEW_SIZE = 150

/**
 * 상점에서 고른 것. 캐시 상품과 환전까지 한 모양으로 모아 둔다 —
 * 판을 종류마다 따로 두면 같은 조작이 네 곳에 흩어진다.
 */
type ShopPick =
  | { kind: 'ANIMAL'; item: ShopAnimal }
  | { kind: 'PROP'; item: ShopProp }
  | { kind: 'CASH'; item: CashProduct }
  | { kind: 'EXCHANGE' }

/**
 * 상점.
 *
 * 동물과 프롭은 **코인**으로 산다. 캐시는 그린 동물을 프레임 애니메이션으로 만들 때 쓰고,
 * 남으면 코인으로 바꿀 수 있다. 반대 방향은 없다 — 코인으로 캐시를 살 수 있으면
 * 캐시로만 되는 것이 시간만 들이면 공짜가 되어 유료 재화라는 구분이 사라진다.
 *
 * 왼쪽에서 하나 고르면 오른쪽 판에 큰 그림과 수량이 뜬다.
 * **수량은 동물·프롭·환전에만 있다.** 캐시 상품은 묶음 자체가 상품이라
 * 두 개를 한 번에 사는 것과 큰 묶음을 사는 것이 다른 값이 되면 곤란하다.
 */
/** 천 단위를 끊어 적는다. `78900` 은 자릿수를 세어야 읽힌다. */
function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function ShopModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const buyCash = useGameStore((s) => s.buyCash)
  const exchangeCash = useGameStore((s) => s.exchangeCash)
  const buyShopProp = useGameStore((s) => s.buyShopProp)
  const buyShopAnimal = useGameStore((s) => s.buyShopAnimal)
  const gold = useGameStore((s) => s.gold)
  const cash = useGameStore((s) => s.cash)
  const unlocked = useGameStore((s) => s.unlocked)
  const animals = useGameStore((s) => s.animals)

  const [tab, setTab] = useState<ShopTab>('ANIMAL')
  const [pick, setPick] = useState<ShopPick | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [confirming, setConfirming] = useState(false)
  const props = useMemo(() => shopProps(unlocked), [unlocked])

  const max = pick ? maxQuantity(pick, gold, cash) : 1
  // 소지금이 줄면 살 수 있는 수도 줄어든다. 화면에 남은 숫자가 늘 살 수 있는 수여야 한다.
  useEffect(() => setQuantity((n) => Math.min(Math.max(1, n), max)), [max])

  /** 탭을 옮기면 고른 것도 놓는다. 다른 탭의 상품이 오른쪽에 남아 있으면 헷갈린다. */
  const switchTab = (next: ShopTab): void => {
    setTab(next)
    setPick(null)
    setQuantity(1)
  }

  const choose = (next: ShopPick): void => {
    setPick(next)
    setQuantity(1)
  }

  const apply = (): void => {
    if (!pick) return
    if (pick.kind === 'CASH') {
      buyCash(pick.item)
    } else if (pick.kind === 'EXCHANGE') {
      exchangeCash(quantity)
    } else if (pick.kind === 'PROP') {
      for (let i = 0; i < quantity; i++) if (!buyShopProp(pick.item)) break
    } else {
      for (let i = 0; i < quantity; i++) if (!buyShopAnimal(pick.item)) break
    }
    setConfirming(false)
    // 환전은 가진 캐시를 헐어 쓰므로 고른 채로 두면 방금 쓴 수량이 그대로 남는다.
    setQuantity(1)
  }

  return (
    <>
      <Popup title="SHOP" width={POPUP_WIDTH} height={POPUP_HEIGHT} onClose={closeModal}>
        <div className="shop">
          <div className="shop-head">
            <Tabs items={TABS} active={tab} onChange={switchTab} />
            <div className="shop-purse">
              <IconGlyph icon={GUI.COIN} size={30} />
              <BitmapLabel text={`${gold}`} size={24} />
              <IconGlyph icon={GUI.COIN_LARGE} size={30} />
              <BitmapLabel text={`${cash}`} size={24} />
            </div>
          </div>

          <div className="shop-body">
            <div className="shop-stock">
              {tab === 'CASH' && (
                <>
                  <div className="shop-list">
                    {CASH_PRODUCTS.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className={isPicked(pick, 'CASH', product.id) ? 'shop-item is-active' : 'shop-item'}
                        onClick={() => choose({ kind: 'CASH', item: product })}
                      >
                        <IconGlyph icon={GUI.COIN_LARGE} size={44} />
                        {/* 덤은 합치지 않고 `10 + 1` 로 적는다. 11 이라고만 쓰면 이득이 안 보인다. */}
                        <BitmapLabel
                          text={product.bonus > 0 ? `${product.cash} + ${product.bonus}` : `${product.cash} CASH`}
                          size={26}
                        />
                        <BitmapLabel text={`${groupThousands(product.krw)} KRW`} size={20} />
                      </button>
                    ))}
                  </div>

                  {/* 환전은 파는 물건이 아니라 가진 것을 바꾸는 일이라 줄을 나눠 아래에 둔다. */}
                  <div className="shop-divider">
                    <BitmapLabel text="EXCHANGE" size={18} />
                  </div>
                  <div className="shop-list">
                    <button
                      type="button"
                      className={pick?.kind === 'EXCHANGE' ? 'shop-item is-active' : 'shop-item'}
                      onClick={() => choose({ kind: 'EXCHANGE' })}
                    >
                      <span className="shop-trade">
                        <IconGlyph icon={GUI.COIN_LARGE} size={40} />
                        <BitmapLabel text=">" size={26} />
                        <IconGlyph icon={GUI.COIN} size={40} />
                      </span>
                      <BitmapLabel text={`1 TO ${CASH_TO_GOLD}`} size={26} />
                      <BitmapLabel text="ONE WAY ONLY" size={18} />
                    </button>
                  </div>
                </>
              )}

              {tab === 'ANIMAL' && SHOP_ANIMALS.length === 0 && (
                <div className="tray-empty">
                  <BitmapLabel text="NO ANIMALS IN STOCK" size={20} />
                  <BitmapLabel text="COME BACK LATER" size={15} />
                </div>
              )}

              {tab === 'ANIMAL' && SHOP_ANIMALS.length > 0 && (
                <div className="shop-grid">
                  {SHOP_ANIMALS.map((item) => (
                    <button
                      key={item.catalogId}
                      type="button"
                      className={isPicked(pick, 'ANIMAL', item.catalogId) ? 'shop-card is-active' : 'shop-card'}
                      disabled={gold < item.price}
                      onClick={() => choose({ kind: 'ANIMAL', item })}
                    >
                      <SheetThumb sheet={item.sheet} size={92} />
                      <BitmapLabel text={item.catalogId} size={17} align="center" />
                      <div className="shop-price">
                        <IconGlyph icon={GUI.COIN} size={20} />
                        <BitmapLabel text={`${item.price}`} size={18} />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {tab === 'PROP' && (
                <div className="shop-grid">
                  {props.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={isPicked(pick, 'PROP', item.id) ? 'shop-card is-active' : 'shop-card'}
                      disabled={gold < item.price}
                      onClick={() => choose({ kind: 'PROP', item })}
                    >
                      <PropThumb biome={item.biome} sprite={item.sprite} size={82} />
                      <BitmapLabel text={`${item.biome} ${item.layer}`} size={14} align="center" />
                      <div className="shop-price">
                        <IconGlyph icon={GUI.COIN} size={20} />
                        <BitmapLabel text={`${item.price}`} size={18} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ShopDetail
              pick={pick}
              quantity={quantity}
              max={max}
              onQuantity={setQuantity}
              onBuy={() => setConfirming(true)}
            />
          </div>

          <div className="shop-note">
            <BitmapLabel text={noteFor(tab, !animals.some(isShopAnimal))} size={18} align="center" />
          </div>
        </div>
      </Popup>

      {confirming && pick && (
        <ConfirmPopup
          title="CONFIRM"
          lines={confirmLines(pick, quantity)}
          onCancel={() => setConfirming(false)}
          onConfirm={apply}
        />
      )}
    </>
  )
}

interface ShopDetailProps {
  pick: ShopPick | null
  quantity: number
  max: number
  onQuantity: (n: number) => void
  onBuy: () => void
}

/**
 * 오른쪽 상세 판.
 *
 * 아무것도 고르지 않았을 때도 **자리를 그대로 남긴다.** 판이 통째로 나타났다
 * 사라지면 목록의 폭이 매번 바뀌어, 고르는 동안 화면이 출렁인다.
 */
function ShopDetail({ pick, quantity, max, onQuantity, onBuy }: ShopDetailProps) {
  if (!pick) {
    return (
      <aside className="shop-detail is-empty">
        <div className="shop-preview is-empty" />
        <BitmapLabel text="PICK SOMETHING" size={22} align="center" />
        <QuantityRow value={1} max={1} disabled onChange={onQuantity} />
        <button type="button" className="shop-buy" disabled>
          <BitmapLabel text="BUY" size={26} />
        </button>
      </aside>
    )
  }

  const stepped = pick.kind !== 'CASH'
  const total = totalOf(pick, quantity)

  return (
    <aside className="shop-detail">
      <div className="shop-preview">{previewOf(pick)}</div>
      <BitmapLabel text={titleOf(pick)} size={24} align="center" />
      <BitmapLabel text={unitOf(pick)} size={17} align="center" />

      <QuantityRow value={quantity} max={max} disabled={!stepped} onChange={onQuantity} />

      <div className="shop-total">
        <IconGlyph icon={total.icon} size={30} />
        <BitmapLabel text={total.text} size={28} />
      </div>

      <button type="button" className="shop-buy" onClick={onBuy}>
        <BitmapLabel text="BUY" size={26} />
      </button>
    </aside>
  )
}

interface QuantityRowProps {
  value: number
  max: number
  disabled?: boolean
  onChange: (n: number) => void
}

/** 수량 조절. 한 개씩 누르는 것과 끝까지 미는 것을 둘 다 둔다. */
function QuantityRow({ value, max, disabled = false, onChange }: QuantityRowProps) {
  const set = (n: number): void => onChange(Math.min(max, Math.max(1, n)))

  return (
    <div className={disabled ? 'shop-qty is-disabled' : 'shop-qty'}>
      <button type="button" className="qty-button" disabled={disabled || value <= 1} onClick={() => set(1)}>
        <BitmapLabel text="MIN" size={16} />
      </button>
      <button type="button" className="qty-button" disabled={disabled || value <= 1} onClick={() => set(value - 1)}>
        <BitmapLabel text="-" size={26} />
      </button>
      <span className="qty-value">
        <BitmapLabel text={`${value}`} size={30} align="center" />
      </span>
      <button type="button" className="qty-button" disabled={disabled || value >= max} onClick={() => set(value + 1)}>
        <BitmapLabel text="+" size={26} />
      </button>
      <button type="button" className="qty-button" disabled={disabled || value >= max} onClick={() => set(max)}>
        <BitmapLabel text="MAX" size={16} />
      </button>
    </div>
  )
}

function isPicked(pick: ShopPick | null, kind: ShopPick['kind'], id: string): boolean {
  if (!pick || pick.kind !== kind) return false
  if (pick.kind === 'ANIMAL') return pick.item.catalogId === id
  if (pick.kind === 'PROP') return pick.item.id === id
  if (pick.kind === 'CASH') return pick.item.id === id
  return true
}

/**
 * 한 번에 살 수 있는 수.
 *
 * 소지금으로 막되 상한을 함께 둔다. 후반에 수백 마리를 한 번에 사면
 * 그만큼의 사육비가 다음 자정에 한꺼번에 빠진다.
 */
function maxQuantity(pick: ShopPick, gold: number, cash: number): number {
  if (pick.kind === 'CASH') return 1
  if (pick.kind === 'EXCHANGE') return Math.max(1, cash)
  return Math.min(SHOP_MAX_QUANTITY, Math.max(1, Math.floor(gold / priceOf(pick))))
}

function priceOf(pick: ShopPick): number {
  if (pick.kind === 'ANIMAL' || pick.kind === 'PROP') return pick.item.price
  return 0
}

function titleOf(pick: ShopPick): string {
  if (pick.kind === 'ANIMAL') return pick.item.catalogId
  if (pick.kind === 'PROP') return shopPropName(pick.item)
  if (pick.kind === 'CASH') {
    return pick.item.bonus > 0
      ? `${pick.item.cash} + ${pick.item.bonus} CASH`
      : `${pick.item.cash} CASH`
  }
  return 'CASH TO COINS'
}

function unitOf(pick: ShopPick): string {
  if (pick.kind === 'CASH') return `${groupThousands(pick.item.krw)} KRW`
  if (pick.kind === 'EXCHANGE') return `1 CASH GIVES ${CASH_TO_GOLD} COINS`
  return `${priceOf(pick)} COINS EACH`
}

/** 치르는 값. 환전만 방향이 반대라 받는 것을 적는다. */
function totalOf(pick: ShopPick, quantity: number): { icon: GuiIcon; text: string } {
  if (pick.kind === 'CASH') return { icon: GUI.COIN_LARGE, text: `${groupThousands(pick.item.krw)} KRW` }
  if (pick.kind === 'EXCHANGE') {
    return { icon: GUI.COIN, text: `+ ${groupThousands(quantity * CASH_TO_GOLD)}` }
  }
  return { icon: GUI.COIN, text: `${groupThousands(priceOf(pick) * quantity)}` }
}

function previewOf(pick: ShopPick) {
  if (pick.kind === 'ANIMAL') return <SheetThumb sheet={pick.item.sheet} size={PREVIEW_SIZE} />
  if (pick.kind === 'PROP') {
    return <PropThumb biome={pick.item.biome} sprite={pick.item.sprite} size={PREVIEW_SIZE} />
  }
  if (pick.kind === 'CASH') return <IconGlyph icon={GUI.COIN_LARGE} size={PREVIEW_SIZE} />
  return (
    <span className="shop-trade">
      <IconGlyph icon={GUI.COIN_LARGE} size={64} />
      <BitmapLabel text=">" size={30} />
      <IconGlyph icon={GUI.COIN} size={64} />
    </span>
  )
}

function noteFor(tab: ShopTab, firstBuy: boolean): string {
  if (tab === 'CASH') return '1 CASH ANIMATES ONE DRAWN ANIMAL'
  // 처음 사는 동물은 기다리지 않는다. 그 사실을 사기 전에 알려 준다.
  if (tab === 'ANIMAL' && firstBuy) return 'YOUR FIRST ONE ARRIVES RIGHT AWAY'
  return `ARRIVES IN STORAGE IN ${SHIPPING_DAYS.SHOP} DAY`
}

function confirmLines(pick: ShopPick, quantity: number): string[] {
  if (pick.kind === 'CASH') {
    const { item } = pick
    return [
      item.bonus > 0 ? `BUY ${item.cash} PLUS ${item.bonus} CASH` : `BUY ${item.cash} CASH`,
      `FOR ${groupThousands(item.krw)} KRW ?`,
    ]
  }
  if (pick.kind === 'EXCHANGE') {
    return [
      `TURN ${quantity} CASH INTO ${groupThousands(quantity * CASH_TO_GOLD)} COINS ?`,
      'THIS CANNOT BE UNDONE',
    ]
  }
  const name = pick.kind === 'PROP' ? shopPropName(pick.item) : pick.item.catalogId
  return [`BUY ${quantity} ${name}`, `FOR ${groupThousands(priceOf(pick) * quantity)} COINS ?`]
}
