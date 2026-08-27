import bgmTitle from '@/assets/audio/bgm-title.mp3'
import bgmDay from '@/assets/audio/bgm-day.mp3'
import bgmAfternoon from '@/assets/audio/bgm-afternoon.mp3'
import bgmNight from '@/assets/audio/bgm-night.mp3'
import bgmDrawing from '@/assets/audio/bgm-drawing.mp3'
import stingReport from '@/assets/audio/sting-report.mp3'
import stingReward from '@/assets/audio/sting-reward.mp3'
import clickNormal from '@/assets/audio/click-normal.mp3'
import clickWrong from '@/assets/audio/click-wrong.mp3'
import ambientBirds from '@/assets/audio/ambient-birds.mp3'
import ambientRain from '@/assets/audio/ambient-rain.mp3'
import ambientSteam from '@/assets/audio/ambient-steam.mp3'

export type BgmId = 'TITLE' | 'DAY' | 'AFTERNOON' | 'NIGHT' | 'DRAWING'
export type StingId = 'REPORT' | 'REWARD' | 'CLICK' | 'DENY'
export type AmbientId = 'BIRDS' | 'RAIN' | 'STEAM'

const BGM_SRC: Record<BgmId, string> = {
  TITLE: bgmTitle,
  DAY: bgmDay,
  AFTERNOON: bgmAfternoon,
  NIGHT: bgmNight,
  DRAWING: bgmDrawing,
}

const STING_SRC: Record<StingId, string> = {
  REPORT: stingReport,
  REWARD: stingReward,
  CLICK: clickNormal,
  DENY: clickWrong,
}

const AMBIENT_SRC: Record<AmbientId, string> = {
  BIRDS: ambientBirds,
  RAIN: ambientRain,
  STEAM: ambientSteam,
}

/**
 * 앰비언트는 배경음이 아니라 **가끔 스치는 환경음**이다.
 * 계속 깔리면 BGM 과 뭉개지고 금세 질린다. 한참 조용하다가 슬며시 들어왔다 빠진다.
 */
const AMBIENT_VOLUME = 0.22
const AMBIENT_FADE_SEC = 3.5
/** 앰비언트가 끝나고 다음이 시작되기까지의 침묵 (초) */
const AMBIENT_GAP = { min: 22, max: 55 } as const
/** 한 번 들어왔을 때 머무는 시간 (초) */
const AMBIENT_PLAY = { min: 20, max: 45 } as const

/** 곡을 바꿀 때 겹쳐 페이드하는 시간(초). */
const CROSSFADE_SEC = 0.9
const FADE_STEP_MS = 40

/**
 * 배경음과 효과음.
 *
 * 브라우저는 사용자가 화면을 한 번 건드리기 전에는 소리를 못 내게 막는다.
 * 그래서 첫 재생 요청은 보류해 두었다가 첫 입력이 들어온 순간 되살린다 —
 * 그러지 않으면 타이틀 BGM 이 조용히 실패하고 아무도 이유를 모른다.
 *
 * 곡 전환은 크로스페이드다. 시간대가 바뀔 때마다 뚝 끊기면 하루가 180초뿐인
 * 이 게임에서는 특히 거슬린다.
 */
class AudioManager {
  private readonly bgm = new Map<BgmId, HTMLAudioElement>()
  private readonly stings = new Map<StingId, HTMLAudioElement>()
  private current: BgmId | null = null
  private pending: BgmId | null = null
  private unlocked = false
  private bgmVolume = 0.7
  private sfxVolume = 0.8
  private fadeTimer = 0

  private readonly ambients = new Map<AmbientId, HTMLAudioElement>()
  private ambientPool: readonly AmbientId[] = ['BIRDS', 'RAIN', 'STEAM']
  private ambientCurrent: HTMLAudioElement | null = null
  private ambientTimer = 0
  private ambientFade = 0
  private ambientRunning = false

  /** 첫 사용자 입력에 붙여 오디오 잠금을 푼다. */
  unlock(): void {
    if (this.unlocked) return
    this.unlocked = true
    if (this.pending) {
      const next = this.pending
      this.pending = null
      this.playBgm(next)
    }
  }

  setVolumes(bgm: number, sfx: number): void {
    this.bgmVolume = bgm
    this.sfxVolume = sfx
    const playing = this.current ? this.bgm.get(this.current) : null
    if (playing) playing.volume = bgm
  }

  /** 지금 우리에 어울리는 환경음 후보. 완전 무작위보다 장소가 읽힌다. */
  setAmbientPool(pool: readonly AmbientId[]): void {
    this.ambientPool = pool.length > 0 ? pool : ['BIRDS']
  }

  startAmbient(): void {
    if (this.ambientRunning) return
    this.ambientRunning = true
    this.scheduleAmbient(randomBetween(AMBIENT_GAP.min, AMBIENT_GAP.max))
  }

  stopAmbient(): void {
    this.ambientRunning = false
    window.clearTimeout(this.ambientTimer)
    window.clearInterval(this.ambientFade)
    const playing = this.ambientCurrent
    this.ambientCurrent = null
    if (playing) this.fadeOutAmbient(playing)
  }

  private scheduleAmbient(delaySec: number): void {
    window.clearTimeout(this.ambientTimer)
    this.ambientTimer = window.setTimeout(() => this.playAmbientOnce(), delaySec * 1000)
  }

  private playAmbientOnce(): void {
    if (!this.ambientRunning || !this.unlocked) {
      this.scheduleAmbient(randomBetween(AMBIENT_GAP.min, AMBIENT_GAP.max))
      return
    }

    const id = this.ambientPool[Math.floor(Math.random() * this.ambientPool.length)] as AmbientId
    const clip = this.ambientElement(id)
    const hold = randomBetween(AMBIENT_PLAY.min, AMBIENT_PLAY.max)

    clip.volume = 0
    clip.currentTime = 0
    void clip.play().catch(() => undefined)
    this.ambientCurrent = clip
    this.fadeAmbient(clip, this.ambientTarget(), AMBIENT_FADE_SEC)

    // 머무는 시간이 끝나면 서서히 빠지고, 그 뒤 다시 한참 조용해진다.
    window.setTimeout(() => {
      if (this.ambientCurrent !== clip) return
      this.ambientCurrent = null
      this.fadeOutAmbient(clip)
      this.scheduleAmbient(randomBetween(AMBIENT_GAP.min, AMBIENT_GAP.max))
    }, hold * 1000)
  }

  private ambientTarget(): number {
    return this.sfxVolume * AMBIENT_VOLUME
  }

  private ambientElement(id: AmbientId): HTMLAudioElement {
    const cached = this.ambients.get(id)
    if (cached) return cached

    const clip = new Audio(AMBIENT_SRC[id])
    clip.loop = true
    clip.preload = 'none'
    this.ambients.set(id, clip)
    return clip
  }

  private fadeOutAmbient(clip: HTMLAudioElement): void {
    this.fadeAmbient(clip, 0, AMBIENT_FADE_SEC, () => {
      clip.pause()
      clip.currentTime = 0
    })
  }

  private fadeAmbient(
    clip: HTMLAudioElement,
    target: number,
    seconds: number,
    done?: () => void,
  ): void {
    window.clearInterval(this.ambientFade)
    const from = clip.volume
    const steps = Math.max(1, Math.round((seconds * 1000) / FADE_STEP_MS))
    let step = 0

    this.ambientFade = window.setInterval(() => {
      step++
      const t = Math.min(1, step / steps)
      clip.volume = Math.max(0, Math.min(1, from + (target - from) * t))
      if (t < 1) return
      window.clearInterval(this.ambientFade)
      done?.()
    }, FADE_STEP_MS)
  }

  playBgm(id: BgmId): void {
    if (this.current === id) return

    if (!this.unlocked) {
      this.pending = id
      return
    }

    const next = this.element(id)
    const previous = this.current ? this.bgm.get(this.current) : null
    this.current = id

    next.volume = 0
    next.currentTime = 0
    void next.play().catch(() => {
      // 자동재생이 막혔다. 다음 입력 때 unlock 이 다시 시도한다.
      this.unlocked = false
      this.pending = id
      this.current = null
    })

    this.crossfade(previous ?? null, next)
  }

  stopBgm(): void {
    const playing = this.current ? this.bgm.get(this.current) : null
    this.current = null
    this.pending = null
    if (playing) this.crossfade(playing, null)
  }

  playSting(id: StingId): void {
    if (!this.unlocked) return
    if (this.sfxVolume <= 0) return
    const source = this.stings.get(id) ?? this.createSting(id)
    // 같은 스팅어가 연달아 울릴 수 있으니 복제해 겹쳐 재생한다.
    const clip = source.cloneNode() as HTMLAudioElement
    clip.volume = this.sfxVolume
    void clip.play().catch(() => undefined)
  }

  private element(id: BgmId): HTMLAudioElement {
    const cached = this.bgm.get(id)
    if (cached) return cached

    const audio = new Audio(BGM_SRC[id])
    audio.loop = true
    audio.preload = 'auto'
    this.bgm.set(id, audio)
    return audio
  }

  private createSting(id: StingId): HTMLAudioElement {
    const audio = new Audio(STING_SRC[id])
    audio.preload = 'auto'
    this.stings.set(id, audio)
    return audio
  }

  private crossfade(from: HTMLAudioElement | null, to: HTMLAudioElement | null): void {
    window.clearInterval(this.fadeTimer)

    const steps = Math.max(1, Math.round((CROSSFADE_SEC * 1000) / FADE_STEP_MS))
    let step = 0

    this.fadeTimer = window.setInterval(() => {
      step++
      const t = Math.min(1, step / steps)
      if (from) from.volume = Math.max(0, this.bgmVolume * (1 - t))
      if (to) to.volume = Math.min(1, this.bgmVolume * t)

      if (t < 1) return

      window.clearInterval(this.fadeTimer)
      if (from && from !== to) {
        from.pause()
        from.currentTime = 0
      }
    }, FADE_STEP_MS)
  }
}

export const audio = new AudioManager()

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
