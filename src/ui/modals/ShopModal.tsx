import { useMemo, useState } from 'react'
import { GUI } from '@/assets/manifest'
import { CASH_PRODUCTS, SHIPPING_DAYS, type CashProduct } from '@/domain/balance'
import { shopProps, shopPropName, SHOP_ANIMALS, type ShopAnimal, type ShopProp } from '@/domain/shop'
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

/** 확인 팝업에 넘길 거리. 탭마다 사는 것이 달라 한 모양으로 모아 둔다. */
type Pending =
  | { kind: 'CASH'; item: CashProduct }
  | { kind: 'PROP'; item: ShopProp }
  | { kind: 'ANIMAL'; item: ShopAnimal }

/**
 * 상점.
 *
 * 동물과 프롭은 **코인**으로 산다. 캐시는 그린 동물을 프레임 애니메이션으로 만들 때만 쓴다 —
 * 코인으로 살 수 있는 걸 캐시로도 팔면 무료 재화가 의미를 잃는다.
 *
 * 캐시 상품의 결제는 흉내만 낸다. 확인을 거치면 그냥 지급한다.
 */
/**
 * 천 단위를 띄어 적는다. `78900` 은 자릿수를 세어야 읽히는데,
 * 비트맵 폰트에 A-Z 와 0-9 밖에 없어 쉼표를 쓸 수 없다. 공백은 여백으로 그려진다.
 */
function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export function ShopModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const buyCash = useGameStore((s) => s.buyCash)
  const buyShopProp = useGameStore((s) => s.buyShopProp)
  const buyShopAnimal = useGameStore((s) => s.buyShopAnimal)
  const gold = useGameStore((s) => s.gold)
  const cash = useGameStore((s) => s.cash)
  const unlocked = useGameStore((s) => s.unlocked)

  const [tab, setTab] = useState<ShopTab>('ANIMAL')
  const [pending, setPending] = useState<Pending | null>(null)
  const props = useMemo(() => shopProps(unlocked), [unlocked])

  return (
    <>
      <Popup title="SHOP" width={980} height={680} onClose={closeModal}>
        <div className="shop">
          <div className="shop-head">
            <Tabs items={TABS} active={tab} onChange={setTab} />
            <div className="shop-purse">
              <IconGlyph icon={GUI.COIN} size={30} />
              <BitmapLabel text={`${gold}`} size={24} />
              <IconGlyph icon={GUI.COIN_LARGE} size={30} />
              <BitmapLabel text={`${cash}`} size={24} />
            </div>
          </div>

          {tab === 'CASH' && (
            <div className="shop-list">
              {CASH_PRODUCTS.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="shop-item"
                  onClick={() => setPending({ kind: 'CASH', item: product })}
                >
                  <IconGlyph icon={GUI.COIN_LARGE} size={54} />
                  {/*
                    덤은 총량에 합치지 않는다. 11 이라고만 쓰면 묶음이 이득이라는 게 안 보인다.

                    예전엔 `10 + 1` 로 적었는데 **폰트에 A-Z 와 0-9 밖에 없어 `+` 가 지워졌다.**
                    화면에는 `10 1` 이라고만 떠서 무슨 뜻인지 알 수 없었다. 그래서 말로 적는다.
                  */}
                  <BitmapLabel text={`${product.cash} CASH`} size={30} />
                  {/* 덤이 없는 상품도 자리는 남긴다. 안 그러면 그 카드만 가격 줄이 올라온다. */}
                  <span className="shop-item-bonus">
                    {product.bonus > 0 && (
                      <BitmapLabel text={`PLUS ${product.bonus} FREE`} size={17} />
                    )}
                  </span>
                  <BitmapLabel text={`${groupThousands(product.krw)} KRW`} size={22} />
                </button>
              ))}
            </div>
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
                  className="shop-card"
                  disabled={gold < item.price}
                  onClick={() => setPending({ kind: 'ANIMAL', item })}
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
                  className="shop-card"
                  disabled={gold < item.price}
                  onClick={() => setPending({ kind: 'PROP', item })}
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

          <div className="shop-note">
            <BitmapLabel text={noteFor(tab)} size={18} align="center" />
          </div>
        </div>
      </Popup>

      {pending && (
        <ConfirmPopup
          title="CONFIRM"
          lines={confirmLines(pending)}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (pending.kind === 'CASH') buyCash(pending.item)
            else if (pending.kind === 'PROP') buyShopProp(pending.item)
            else buyShopAnimal(pending.item)
            setPending(null)
          }}
        />
      )}
    </>
  )
}

function noteFor(tab: ShopTab): string {
  if (tab === 'CASH') return '1 CASH ANIMATES ONE DRAWN ANIMAL'
  return `ARRIVES IN STORAGE IN ${SHIPPING_DAYS.SHOP} DAY`
}

function confirmLines(pending: Pending): string[] {
  if (pending.kind === 'CASH') {
    const { item } = pending
    return [
      item.bonus > 0 ? `BUY ${item.cash} PLUS ${item.bonus} CASH` : `BUY ${item.cash} CASH`,
      `FOR ${groupThousands(item.krw)} KRW ?`,
    ]
  }
  if (pending.kind === 'PROP') {
    return [`BUY ${shopPropName(pending.item)}`, `FOR ${pending.item.price} COINS ?`]
  }
  return [`BUY ${pending.item.catalogId}`, `FOR ${pending.item.price} COINS ?`]
}
