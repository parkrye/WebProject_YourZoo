import type { ReactNode } from 'react'
import { GUI } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'

interface WizardFrameProps {
  title: string
  children: ReactNode
  onBack?: () => void
  /** 다음 걸음으로. `onSubmit` 과 함께 쓰지 않는다. */
  onNext?: () => void
  nextLabel?: string
  nextReady?: boolean
  /** 마지막 걸음. 여기서만 값을 치른다. */
  onSubmit?: () => void
  submitReady?: boolean
  cost?: number
  note?: string
  warning?: string | null
}

/**
 * 여러 걸음짜리 만들기 화면의 공통 틀.
 *
 * 걸음마다 제목 한 줄, 내용, 그리고 아래 띠에 뒤로/다음만 둔다.
 * 값과 안내는 **마지막 걸음에서만** 보여 준다 — 아직 무엇을 만들지도 정하지 않았는데
 * 가격이 먼저 보이면 고르는 일이 계산이 된다.
 */
export function WizardFrame({
  title,
  children,
  onBack,
  onNext,
  nextLabel = 'NEXT',
  nextReady = true,
  onSubmit,
  submitReady = true,
  cost,
  note,
  warning,
}: WizardFrameProps) {
  return (
    <div className="wizard">
      <header className="wizard-head">
        <BitmapLabel text={title} size={26} />
      </header>

      <div className="wizard-body">{children}</div>

      <footer className="wizard-foot">
        {onBack && <IconButton icon={GUI.BACK} size={52} title="BACK" onClick={onBack} />}

        <div className="wizard-foot-info">
          {cost !== undefined && (
            <span className="shop-price">
              <IconGlyph icon={GUI.COIN} size={26} />
              <BitmapLabel text={`${cost}`} size={24} />
            </span>
          )}
          {note && <BitmapLabel text={note} size={15} />}
          {warning && <BitmapLabel text={warning} size={16} />}
        </div>

        {onNext && (
          <button
            type="button"
            className="wizard-next"
            disabled={!nextReady}
            onClick={onNext}
          >
            <BitmapLabel text={nextLabel} size={22} />
          </button>
        )}
        {onSubmit && (
          <IconButton
            icon={GUI.SUBMIT}
            size={64}
            title="SUBMIT"
            disabled={!submitReady}
            onClick={onSubmit}
          />
        )}
      </footer>
    </div>
  )
}
