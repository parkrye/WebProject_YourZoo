import { GUI } from '@/assets/manifest'
import { averageVisitorMultiplier, settleDay } from '@/domain/economy'
import { ENCLOSURE_ORDER, ENCLOSURES } from '@/domain/enclosure'
import { UNLOCK_COST } from '@/domain/balance'
import { useState } from 'react'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { Popup } from '@/ui/components/Popup'
import { Tabs, type TabItem } from '@/ui/components/Tabs'
import { useGameStore } from '@/store/gameStore'

type StatusTab = 'NOW' | 'REPORTS'

const TABS: readonly TabItem<StatusTab>[] = [
  { id: 'NOW', label: 'OVERVIEW' },
  { id: 'REPORTS', label: 'REPORTS' },
]

export function StatusModal() {
  const [tab, setTab] = useState<StatusTab>('NOW')
  const closeModal = useGameStore((s) => s.closeModal)
  const reports = useGameStore((s) => s.reports)
  const gold = useGameStore((s) => s.gold)
  const reputation = useGameStore((s) => s.reputation)
  const animals = useGameStore((s) => s.animals)
  const unlocked = useGameStore((s) => s.unlocked)
  const day = useGameStore((s) => s.clock.day)
  const zooName = useGameStore((s) => s.zooName)

  const placed = animals.filter((a) => a.status === 'PLACED').length
  const storedCount = animals.filter((a) => a.status === 'STORED').length
  const shipping = animals.filter((a) => a.status === 'SHIPPING').length

  // 오늘 자정에 정산될 예상치. 지난 정산 결과보다 지금 상태를 판단하는 데 쓸모 있다.
  const forecast = settleDay({ day, animals, unlocked, reputation })

  return (
    <Popup title={zooName || 'ZOO STATUS'} width={1000} height={800} onClose={closeModal}>
      <Tabs items={TABS} active={tab} onChange={setTab} />

      {tab === 'REPORTS' ? (
        <div className="orders-list">
          {reports.length === 0 && <BitmapLabel text="NO REPORTS YET" size={26} />}
          {reports.map((r) => (
            <div key={r.day} className="order-row">
              <div className="report-history-head">
                <BitmapLabel text={`DAY ${r.day}`} size={24} />
                <BitmapLabel text={`VISITORS ${r.visitors}`} size={18} />
                <BitmapLabel text={`TICKETS ${r.ticketIncome}`} size={18} />
                <BitmapLabel text={`VIEWING ${r.viewIncome}`} size={18} />
                <BitmapLabel text={`UPKEEP ${r.upkeep}`} size={18} />
                <div className={r.net < 0 ? 'report-net is-minus' : 'report-net is-plus'}>
                  <BitmapLabel text={`NET ${Math.abs(r.net)}`} size={22} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="status-layout">
        <section className="status-col">
          <div className="stat-row">
            <IconButton icon={GUI.COIN} size={52} />
            <BitmapLabel text={`GOLD ${gold}`} size={30} />
          </div>
          <div className="stat-row">
            <IconButton icon={GUI.MEDAL} size={52} />
            <BitmapLabel text={`FAME ${reputation}`} size={30} />
          </div>
          <div className="stat-row">
            <IconButton icon={GUI.BOOK} size={52} />
            <BitmapLabel text={`PLACED ${placed}`} size={30} />
          </div>
          <div className="stat-row">
            <BitmapLabel text="IN STORAGE" size={24} />
            <BitmapLabel text={`${storedCount}`} size={24} />
          </div>
          <div className="stat-row">
            <BitmapLabel text="SHIPPING" size={24} />
            <BitmapLabel text={`${shipping}`} size={24} />
          </div>

          <div className="field-label">
            <BitmapLabel text="ENCLOSURES" size={22} />
          </div>
          {ENCLOSURE_ORDER.map((id) => {
            const open = unlocked.includes(id)
            const count = animals.filter((a) => a.status === 'PLACED' && a.enclosureId === id).length
            return (
              <div key={id} className="stat-row">
                <BitmapLabel text={ENCLOSURES[id].label} size={24} />
                <BitmapLabel
                  text={open ? `${count}` : `LOCKED ${UNLOCK_COST[id]}`}
                  size={24}
                />
              </div>
            )
          })}
        </section>

        <section className="status-col">
          <div className="field-label">
            <BitmapLabel text="TODAY FORECAST" size={22} />
          </div>
          <div className="report-row">
            <BitmapLabel text="VISITORS" size={24} />
            <BitmapLabel text={`${forecast.visitors}`} size={24} align="right" />
          </div>
          <div className="report-row is-plus">
            <BitmapLabel text="TICKETS" size={24} />
            <BitmapLabel text={`${forecast.ticketIncome}`} size={24} align="right" />
          </div>
          <div className="report-row is-plus">
            <BitmapLabel text="VIEWING" size={24} />
            <BitmapLabel text={`${forecast.viewIncome}`} size={24} align="right" />
          </div>
          <div className="report-row is-minus">
            <BitmapLabel text="UPKEEP" size={24} />
            <BitmapLabel text={`${forecast.upkeep}`} size={24} align="right" />
          </div>
          <div className="report-divider" />
          <div className={forecast.net < 0 ? 'report-row is-minus' : 'report-row is-plus'}>
            <BitmapLabel text="NET" size={30} />
            <BitmapLabel text={`${Math.abs(forecast.net)}`} size={30} align="right" />
          </div>
          <div className="field-label">
            <BitmapLabel
              text={`DAY RATE ${Math.round(averageVisitorMultiplier() * 100)}`}
              size={20}
            />
          </div>
        </section>
      </div>
      )}
    </Popup>
  )
}
