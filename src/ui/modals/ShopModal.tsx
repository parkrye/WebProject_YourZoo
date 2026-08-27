import { useState } from 'react'
import { GUI } from '@/assets/manifest'
import { CASH_PRODUCTS, type CashProduct } from '@/domain/balance'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { ConfirmPopup } from '@/ui/components/ConfirmPopup'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

/**
 * 캐시 상점.
 *
 * 실제 결제는 없다 — 확인을 거치면 그냥 지급한다. 장난삼아 붙인 상점이라
 * 결제 연동 대신 **결제처럼 보이는 절차**만 남겨 둔다.
 * 화폐 기호(₩)와 쉼표는 폰트에 없어서 `500 KRW` 로 적는다.
 */
export function ShopModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const buyCash = useGameStore((s) => s.buyCash)
  const cash = useGameStore((s) => s.cash)
  const [picked, setPicked] = useState<CashProduct | null>(null)

  return (
    <>
      <Popup title="CASH SHOP" width={760} height={560} onClose={closeModal}>
        <div className="shop">
          <div className="shop-purse">
            <IconGlyph icon={GUI.PALETTE} size={34} />
            <BitmapLabel text={`${cash}`} size={30} />
          </div>

          <div className="shop-list">
            {CASH_PRODUCTS.map((product) => (
              <button
                key={product.id}
                type="button"
                className="shop-item"
                onClick={() => setPicked(product)}
              >
                <IconGlyph icon={GUI.PALETTE} size={54} />
                <BitmapLabel text={`${product.cash} CASH`} size={30} />
                <BitmapLabel text={`${product.krw} KRW`} size={22} />
              </button>
            ))}
          </div>

          <div className="shop-note">
            <BitmapLabel text="1 CASH MAKES ONE ANIMAL MOVE" size={20} align="center" />
            <BitmapLabel text="IN FULL FRAME ANIMATION" size={20} align="center" />
          </div>
        </div>
      </Popup>

      {picked && (
        <ConfirmPopup
          title="CONFIRM"
          lines={[`BUY ${picked.cash} CASH`, `FOR ${picked.krw} KRW ?`]}
          onCancel={() => setPicked(null)}
          onConfirm={() => {
            buyCash(picked)
            setPicked(null)
          }}
        />
      )}
    </>
  )
}
