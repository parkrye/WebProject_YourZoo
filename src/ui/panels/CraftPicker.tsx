import { GUI } from '@/assets/manifest'
import type { CraftSpec } from '@/domain/craft'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconGlyph } from '@/ui/components/IconGlyph'

interface CraftPickerProps<T extends string> {
  title: string
  order: readonly T[]
  specs: Record<T, CraftSpec>
  gold: number
  cash?: number
  onPick: (id: T) => void
}

/**
 * 만드는 방식 고르기. 만들기의 첫 걸음이다.
 *
 * 손이 적게 가는 것부터 늘어놓는다. 값과 그려야 할 칸 수를 함께 보여 줘서
 * **비싼 쪽이 왜 비싼지**가 카드 안에서 끝나게 한다.
 *
 * 아직 못 여는 방식도 자리는 보여 준다. 없는 것처럼 감추면 나중에 열렸을 때
 * 아무도 찾지 못한다.
 */
export function CraftPicker<T extends string>({
  title, order, specs, gold, cash = 0, onPick,
}: CraftPickerProps<T>) {
  return (
    <div className="wizard">
      <header className="wizard-head">
        <BitmapLabel text={title} size={26} />
      </header>

      <div className="wizard-body">
        <div className="craft-grid">
          {order.map((id) => {
            const spec = specs[id]
            const paysCash = spec.cash > 0
            const affordable = paysCash ? cash >= spec.cash : gold >= spec.coins
            const disabled = spec.locked || !affordable

            return (
              <button
                key={id}
                type="button"
                className={craftClass(spec.locked ?? false, affordable)}
                disabled={disabled}
                onClick={() => onPick(id)}
              >
                <div className="craft-card-head">
                  <BitmapLabel text={spec.label} size={24} />
                  {spec.locked && <IconGlyph icon={GUI.HELP} size={22} />}
                </div>

                <BitmapLabel text={spec.hint} size={13} />

                <div className="craft-card-foot">
                  <span className="shop-price">
                    <IconGlyph icon={paysCash ? GUI.PALETTE : GUI.COIN} size={22} />
                    <BitmapLabel text={`${paysCash ? spec.cash : spec.coins}`} size={20} />
                  </span>
                  <BitmapLabel
                    text={spec.frames > 1 ? `${spec.frames} FRAMES` : '1 DRAWING'}
                    size={13}
                  />
                </div>

                {spec.locked && (
                  <div className="craft-locked">
                    <BitmapLabel text="NOT OPEN YET" size={14} />
                  </div>
                )}
                {!spec.locked && !affordable && (
                  <div className="craft-locked">
                    <BitmapLabel text="NOT ENOUGH" size={14} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function craftClass(locked: boolean, affordable: boolean): string {
  return ['craft-card', locked ? 'is-locked' : '', !locked && !affordable ? 'is-poor' : '']
    .filter(Boolean)
    .join(' ')
}
