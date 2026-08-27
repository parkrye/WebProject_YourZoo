import { useEffect } from 'react'
import { phaseOf } from '@/domain/clock'
import { useGameStore } from '@/store/gameStore'
import { audio, type BgmId } from './AudioManager'

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

/** 첫 사용자 입력 전까지 브라우저가 소리를 막는다. 아무 입력이나 한 번 받으면 풀린다. */
function useAudioUnlock(): void {
  useEffect(() => {
    const unlock = (): void => audio.unlock()
    const events = ['pointerdown', 'keydown'] as const
    for (const type of events) window.addEventListener(type, unlock, { once: false })
    return () => {
      for (const type of events) window.removeEventListener(type, unlock)
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
}
