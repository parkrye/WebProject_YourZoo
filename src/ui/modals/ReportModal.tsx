import { useEffect, useState } from 'react'
import { GUI } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

/** 자동으로 닫히기까지의 시간(초). 매일 뜨는 팝업이라 손이 가지 않아야 한다. */
const AUTO_CLOSE_SEC = 10

/**
 * 자정 정산 결과. 이 팝업이 떠 있는 동안 시계는 멈춘다.
 * 하루가 180초뿐이라 매일 직접 닫게 하면 성가시다. 읽을 시간만 주고 알아서 닫는다.
 * 지난 기록은 운영 현황에서 다시 볼 수 있다.
 */
export function ReportModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const report = useGameStore((s) => s.lastReport)
  const gold = useGameStore((s) => s.gold)
  const reputation = useGameStore((s) => s.reputation)
  const [remaining, setRemaining] = useState(AUTO_CLOSE_SEC)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining((left) => {
        if (left > 1) return left - 1
        window.clearInterval(timer)
        closeModal()
        return 0
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [closeModal])

  if (!report) return null

  return (
    <Popup title={`DAY ${report.day} REPORT`} width={860} height={620} onClose={closeModal}>
      <div className="report">
        {report.arrivedCount > 0 && <ReportRow label="ARRIVED" value={report.arrivedCount} tone="plus" />}
        <ReportRow label="VISITORS" value={report.visitors} />
        <ReportRow label="TICKETS" value={report.ticketIncome} tone="plus" />
        <ReportRow label="VIEWING" value={report.viewIncome} tone="plus" />
        <ReportRow label="UPKEEP" value={report.upkeep} tone="minus" />
        {report.storedCount > 0 && <ReportRow label="IN STORAGE" value={report.storedCount} />}

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
          <BitmapLabel text={`CLOSING IN ${remaining}`} size={18} />
          <IconButton icon={GUI.CONFIRM} size={64} title="OK" onClick={closeModal} />
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
