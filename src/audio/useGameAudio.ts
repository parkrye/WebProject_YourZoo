import { useEffect } from 'react'
import { phaseOf } from '@/domain/clock'
import { useGameStore } from '@/store/gameStore'
import type { BiomeId } from '@/assets/manifest'
import { audio, type AmbientId, type BgmId } from './AudioManager'

/**
 * 우리마다 어울리는 환경음 후보.
 * 완전 무작위로 돌리면 사막에서 새소리가 나 장소가 읽히지 않는다.
 * 후보를 겹치게 둬서 예측 가능해지지도 않게 했다.
 */
const AMBIENT_POOL: Record<BiomeId, readonly AmbientId[]> = {
  FIELD: ['BIRDS', 'RAIN'],
  DESERT: ['STEAM', 'BIRDS'],
  ICE: ['RAIN', 'STEAM'],
}

/**
 * 게임 상태에 맞는 곡을 고른다.
 *
 * 그림판이 최우선이다 — 그리는 동안 시간대 곡이 바뀌면 집중이 끊긴다.
 * 그다음이 화면, 마지막이 시간대다.
 */
function pickBgm(screen: string, isDrawing: boolean, elapsed: number): BgmId {
  if (isDrawing) return 'DRAWING'
  if (screen === 'TITLE' || screen === 'NAMING') return 'TITLE'
  return phaseOf(elapsed)
}

/**
 * 첫 사용자 입력 전까지 브라우저가 소리를 막는다. 아무 입력이나 한 번 받으면 풀린다.
 * 같은 리스너에서 버튼 클릭음도 낸다 — 버튼마다 핸들러를 다는 것보다 한 곳에서 끝난다.
 */
function useAudioUnlock(): void {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      audio.unlock()

      const target = event.target as HTMLElement | null
      const button = target?.closest('button')
      if (!button) return

      // 비활성 버튼은 click 이벤트가 오지 않으므로 pointerdown 에서 직접 구분한다.
      audio.playSting(button.hasAttribute('disabled') ? 'DENY' : 'CLICK')
    }

    const onKeyDown = (): void => audio.unlock()

    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}

export function useGameAudio(): void {
  useAudioUnlock()

  const screen = useGameStore((s) => s.screen)
  const isDrawing = useGameStore((s) => s.isDrawing)
  const modal = useGameStore((s) => s.modal)
  const options = useGameStore((s) => s.options)
  const elapsed = useGameStore((s) => s.clock.elapsed)
  const enclosure = useGameStore((s) => s.currentEnclosure)

  // 시간대는 초 단위로 바뀌므로 phase 만 뽑아 의존한다. elapsed 를 그대로 쓰면 매 프레임 재평가된다.
  const target = pickBgm(screen, isDrawing, elapsed)

  useEffect(() => {
    audio.setVolumes(options.bgm, options.sfx)
  }, [options.bgm, options.sfx])

  useEffect(() => {
    audio.playBgm(target)
  }, [target])

  // 정산 팝업이 뜨는 순간 한 번만 울린다.
  useEffect(() => {
    if (modal === 'REPORT') audio.playSting('REPORT')
  }, [modal])

  useEffect(() => {
    audio.setAmbientPool(AMBIENT_POOL[enclosure])
  }, [enclosure])

  // 환경음은 우리를 보고 있을 때만. 타이틀이나 그림판에서는 어울리지 않는다.
  useEffect(() => {
    const inZoo = (screen === 'ZOO' || screen === 'ZOO_DETAIL') && !isDrawing
    if (inZoo) audio.startAmbient()
    else audio.stopAmbient()
  }, [screen, isDrawing])
}
