import { GUI } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

/** 자정 정산 결과. 이 팝업이 떠 있는 동안 시계는 멈춘다. */
export function ReportModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const report = useGameStore((s) => s.lastReport)
  const gold = useGameStore((s) => s.gold)
  const reputation = useGameStore((s) => s.reputation)

  if (!report) return null

  return (
    <Popup title={`DAY ${report.day} REPORT`} width={860} height={620} onClose={closeModal}>
      <div className="report">
        <ReportRow label="VISITORS" value={report.visitors} />
        <ReportRow label="TICKETS" value={report.ticketIncome} tone="plus" />
        <ReportRow label="VIEWING" value={report.viewIncome} tone="plus" />
        <ReportRow label="UPKEEP" value={report.upkeep} tone="minus" />

        <div className="report-divider" />

        <ReportRow label="NET" value={report.net} tone={report.net < 0 ? 'minus' : 'plus'} big />
        <ReportRow
          label="FAME"
          value={report.reputationDelta}
          tone={report.reputationDelta < 0 ? 'minus' : 'plus'}
          big
        />

        <div className="report-divider" />

        <div className="report-totals">
          <div className="stat-row">
            <IconButton icon={GUI.COIN} size={44} />
            <BitmapLabel text={`${gold}`} size={30} />
          </div>
          <div className="stat-row">
            <IconButton icon={GUI.MEDAL} size={44} />
            <BitmapLabel text={`${reputation}`} size={30} />
          </div>
        </div>

        <div className="report-actions">
          <IconButton icon={GUI.CONFIRM} size={72} title="OK" onClick={closeModal} />
        </div>
      </div>
    </Popup>
  )
}

interface ReportRowProps {
  label: string
  value: number
  tone?: 'plus' | 'minus'
  big?: boolean
}

function ReportRow({ label, value, tone, big = false }: ReportRowProps) {
  // 폰트에 +, − 기호가 없다. 부호는 색으로만 구분한다.
  const size = big ? 30 : 24
  return (
    <div className={tone ? `report-row is-${tone}` : 'report-row'}>
      <BitmapLabel text={label} size={size} />
      <BitmapLabel text={`${Math.abs(value)}`} size={size} align="right" />
    </div>
  )
}
