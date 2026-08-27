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
        <div className="visit-me">
          <BitmapLabel text="YOUR ID" size={18} />
          <BitmapLabel text={userId || 'NONE'} size={26} />
        </div>

        <div className="visit-search">
          <BitmapInput
            value={query}
            maxLength={ZOO_NAME_MAX_LENGTH}
            placeholder="ID OR ZOO NAME"
            onChange={setQuery}
          />
          <IconButton icon={GUI.BINOCULARS} size={52} title="SEARCH" onClick={() => void run(query)} />
          <button type="button" className="labeled-button" disabled={busy} onClick={() => void surprise()}>
            <IconGlyph icon={GUI.MAP} size={40} />
            <BitmapLabel text="RANDOM" size={17} />
          </button>
        </div>

        <div className="visit-list">
          {status !== '' && <BitmapLabel text={status} size={22} align="center" />}
          {results.map((zoo) => (
            <button
              key={zoo.userId}
              type="button"
              className="visit-row"
              disabled={busy}
              onClick={() => void enter(zoo.userId)}
            >
              <div className="visit-row-name">
                <BitmapLabel text={zoo.zooName || 'MY ZOO'} size={26} />
                <BitmapLabel text={zoo.userId} size={16} />
              </div>
              <div className="visit-row-stats">
                <IconGlyph icon={GUI.MEDAL} size={26} />
                <BitmapLabel text={`${zoo.reputation}`} size={22} />
                <BitmapLabel text={`ANIMALS ${zoo.animalCount}`} size={18} />
                <BitmapLabel text={`DAY ${zoo.day}`} size={18} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </Popup>
  )
}
