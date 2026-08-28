import { useCallback, useEffect, useState } from 'react'
import { GUI } from '@/assets/manifest'
import { ZOO_NAME_MAX_LENGTH } from '@/domain/balance'
import { fetchZoo, randomZoo, searchZoos, type ZooSummary } from '@/net/zooApi'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { Popup } from '@/ui/components/Popup'
import { useGameStore } from '@/store/gameStore'

/**
 * 다른 동물원 찾아가기.
 *
 * 아이디로도 동물원 이름으로도 찾는다 — 유저가 둘 중 뭘 들고 왔는지 신경 쓸 필요 없이
 * 서버가 양쪽을 다 뒤진다. 빈 검색어는 전체 목록이다.
 */
export function VisitModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const startVisit = useGameStore((s) => s.startVisit)
  const userId = useGameStore((s) => s.userId)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ZooSummary[]>([])
  const [status, setStatus] = useState('LOADING')
  const [busy, setBusy] = useState(false)

  const run = useCallback(
    async (text: string) => {
      setStatus('LOADING')
      const zoos = await searchZoos(text, userId)
      setResults(zoos)
      setStatus(zoos.length === 0 ? 'NO ZOOS FOUND' : '')
    },
    [userId],
  )

  // 열자마자 전체 목록을 보여 준다. 빈 화면에서 뭘 쳐야 할지 모르는 것보다 낫다.
  useEffect(() => {
    void run('')
  }, [run])

  const enter = useCallback(
    async (id: string) => {
      setBusy(true)
      const doc = await fetchZoo(id)
      if (!doc) {
        setStatus('ZOO IS GONE')
        setBusy(false)
        return
      }
      await startVisit(doc)
    },
    [startVisit],
  )

  const surprise = useCallback(async () => {
    setBusy(true)
    const doc = await randomZoo(userId)
    if (!doc) {
      // 저장된 동물원이 자기 것뿐이다. 이건 검색 실패와 다른 상황이라 따로 말해 준다.
      setStatus('ONLY YOUR ZOO EXISTS')
      setBusy(false)
      return
    }
    await startVisit(doc)
  }, [startVisit, userId])

  return (
    <Popup title="VISIT A ZOO" width={860} height={640} onClose={closeModal}>
      <div className="visit">
        {/*
          검색줄과 내 아이디를 한 띠에 묶는다. 예전에는 아이디가 위에 따로 떠 있어
          제목과 검색줄 사이에 아무것도 아닌 줄이 하나 끼어 있었다.
        */}
        <div className="visit-bar">
          <div className="visit-search">
            <BitmapInput
              value={query}
              maxLength={ZOO_NAME_MAX_LENGTH}
              placeholder="ID OR ZOO NAME"
              onChange={setQuery}
            />
            <IconButton icon={GUI.BINOCULARS} size={48} title="SEARCH" onClick={() => void run(query)} />
          </div>
          <button type="button" className="visit-random" disabled={busy} onClick={() => void surprise()}>
            <IconGlyph icon={GUI.MAP} size={34} />
            <BitmapLabel text="RANDOM" size={18} />
          </button>
          <div className="visit-me">
            <BitmapLabel text="YOUR ID" size={13} />
            <BitmapLabel text={userId || 'NONE'} size={20} />
          </div>
        </div>

        {status !== '' && (
          <div className="visit-empty">
            <IconGlyph icon={GUI.MAP} size={54} />
            <BitmapLabel text={status} size={22} align="center" />
          </div>
        )}

        {/* 한 줄짜리 목록은 어느 동물원이 볼 만한지 읽히지 않았다. 카드로 늘어놓는다. */}
        <div className="visit-grid">
          {results.map((zoo) => (
            <button
              key={zoo.userId}
              type="button"
              className="visit-card"
              disabled={busy}
              onClick={() => void enter(zoo.userId)}
            >
              <div className="visit-card-head">
                <BitmapLabel text={zoo.zooName || 'MY ZOO'} size={24} />
                <BitmapLabel text={zoo.userId} size={14} />
              </div>
              <div className="visit-card-stats">
                <span className="visit-stat">
                  <IconGlyph icon={GUI.MEDAL} size={24} />
                  <BitmapLabel text={`${zoo.reputation}`} size={20} />
                </span>
                <span className="visit-stat">
                  <IconGlyph icon={GUI.PAW} size={24} />
                  <BitmapLabel text={`${zoo.animalCount}`} size={20} />
                </span>
                <span className="visit-stat">
                  <BitmapLabel text={`DAY ${zoo.day}`} size={17} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Popup>
  )
}
