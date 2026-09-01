import { GUI } from '@/assets/manifest'
import { averageVisitorMultiplier, settleDay } from '@/domain/economy'
import { ENCLOSURE_ORDER, enclosureLabel } from '@/domain/enclosure'
import { UNLOCK_COST, UNLOCK_REPUTATION } from '@/domain/balance'
import { useState } from 'react'
import { countBySentiment, type Review } from '@/domain/review'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { signed } from '@/ui/signed'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { IconButton } from '@/ui/components/IconButton'
import { Popup } from '@/ui/components/Popup'
import { Tabs, type TabItem } from '@/ui/components/Tabs'
import { useGameStore } from '@/store/gameStore'

type StatusTab = 'NOW' | 'REPORTS' | 'REVIEWS'

const TABS: readonly TabItem<StatusTab>[] = [
  { id: 'NOW', label: 'OVERVIEW' },
  { id: 'REPORTS', label: 'REPORTS' },
  { id: 'REVIEWS', label: 'VOICES' },
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
  const enclosureNames = useGameStore((s) => s.enclosureNames)
  const reviews = useGameStore((s) => s.reviews)

  const placed = animals.filter((a) => a.status === 'PLACED').length
  const storedCount = animals.filter((a) => a.status === 'STORED').length
  const shipping = animals.filter((a) => a.status === 'SHIPPING').length

  // 오늘 자정에 정산될 예상치. 지난 정산 결과보다 지금 상태를 판단하는 데 쓸모 있다.
  const forecast = settleDay({ day, animals, unlocked, reputation })

  return (
    <Popup title={zooName || 'ZOO STATUS'} width={1000} height={800} onClose={closeModal}>
      <Tabs items={TABS} active={tab} onChange={setTab} />

      {tab === 'REVIEWS' ? (
        <ReviewList reviews={reviews} />
      ) : tab === 'REPORTS' ? (
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
                  <BitmapLabel text={`NET ${signed(r.net)}`} size={22} />
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
            <IconButton icon={GUI.PAW} size={52} />
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
                <BitmapLabel text={enclosureLabel(id, enclosureNames)} size={24} />
                <BitmapLabel
                  // 잠긴 우리는 두 조건을 함께 적는다. 돈만 적어 두면 명성 조건을 모른다.
                  text={open ? `${count}` : `LOCKED ${UNLOCK_COST[id]}G ${UNLOCK_REPUTATION[id]} FAME`}
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
            <span className="report-label">
              <IconGlyph icon={GUI.PEOPLE} size={22} />
              <BitmapLabel text="VISITORS" size={24} />
            </span>
            <BitmapLabel text={`${forecast.visitors}`} size={24} align="right" />
          </div>
          <div className="report-row is-plus">
            <BitmapLabel text="TICKETS" size={24} />
            <BitmapLabel text={signed(forecast.ticketIncome, 'plus')} size={24} align="right" />
          </div>
          <div className="report-row is-plus">
            <BitmapLabel text="VIEWING" size={24} />
            <BitmapLabel text={signed(forecast.viewIncome, 'plus')} size={24} align="right" />
          </div>
          <div className="report-row is-minus">
            <BitmapLabel text="UPKEEP" size={24} />
            <BitmapLabel text={signed(forecast.upkeep, 'minus')} size={24} align="right" />
          </div>
          <div className="report-divider" />
          <div className={forecast.net < 0 ? 'report-row is-minus' : 'report-row is-plus'}>
            <BitmapLabel text="NET" size={30} />
            <BitmapLabel text={signed(forecast.net)} size={30} align="right" />
          </div>
          <div className="field-label">
            <BitmapLabel
              text={`DAY RATE ${Math.round(averageVisitorMultiplier() * 100)}%`}
              size={20}
            />
          </div>
        </section>
      </div>
      )}
    </Popup>
  )
}

/**
 * 손님이 남긴 말.
 *
 * 화면에서는 부호 하나로 스쳐 지나가고, 여기서 문장으로 읽는다.
 * 최근 것이 위다 — 오늘 우리 동물원이 어떻게 보였는지가 먼저 궁금한 것이다.
 */
function ReviewList({ reviews }: { reviews: readonly Review[] }) {
  const { good, bad } = countBySentiment(reviews)

  if (reviews.length === 0) {
    return (
      <div className="orders-list">
        <BitmapLabel text="NOBODY HAS SAID ANYTHING YET" size={26} />
        <BitmapLabel text="PLACE AN ANIMAL AND LET THEM LOOK" size={18} />
      </div>
    )
  }

  return (
    <div className="orders-list">
      <div className="review-tally">
        <span className="review-tally-side is-plus">
          <IconGlyph icon={GUI.HEART} size={26} />
          <BitmapLabel text={`${good}`} size={26} />
        </span>
        <span className="review-tally-side is-minus">
          <IconGlyph icon={GUI.CLOSE} size={26} />
          <BitmapLabel text={`${bad}`} size={26} />
        </span>
      </div>

      {reviews.map((review) => (
        <div key={review.id} className="review-row">
          <IconGlyph icon={review.sentiment === 1 ? GUI.HEART : GUI.CLOSE} size={24} />
          <BitmapLabel text={review.text} size={20} />
          <BitmapLabel text={`DAY ${review.day}`} size={15} align="right" />
        </div>
      ))}
    </div>
  )
}
