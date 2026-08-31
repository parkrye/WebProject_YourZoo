import { useRef, useState } from 'react'
import { GUI } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { ConfirmPopup } from '@/ui/components/ConfirmPopup'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { Popup } from '@/ui/components/Popup'
import { Slider } from '@/ui/components/Slider'
import { useGameStore, type SyncState } from '@/store/gameStore'

/** 음소거를 풀 때 돌아갈 기본값. 직전 값이 없거나 0 이었을 때 쓴다. */
const DEFAULT_VOLUME = { bgm: 0.7, sfx: 0.8 } as const

const SYNC_LABEL: Record<SyncState, string> = {
  OFF: '',
  PENDING: 'NOT SAVED YET',
  SYNCED: 'SAVED TO SERVER',
  FAILED: 'SERVER UNREACHABLE',
}

export function OptionsModal() {
  const closeModal = useGameStore((s) => s.closeModal)
  const options = useGameStore((s) => s.options)
  const setOption = useGameStore((s) => s.setOption)
  const account = useGameStore((s) => s.account)
  const userId = useGameStore((s) => s.userId)
  const logOut = useGameStore((s) => s.logOut)
  const sync = useGameStore((s) => s.sync)
  const goToTitle = useGameStore((s) => s.goToTitle)
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)

  /*
    음소거를 풀 때 돌아갈 자리. 스토어가 아니라 여기 두는 이유는
    **저장할 값이 아니기 때문이다** — 다음에 켰을 때 기억해야 할 것은
    지금 소리 크기지, 껐다 켜는 과정이 아니다.
  */
  const previous = useRef({ bgm: options.bgm, sfx: options.sfx })

  const toggle = (key: 'bgm' | 'sfx'): void => {
    const current = options[key]
    if (current > 0) {
      previous.current[key] = current
      setOption(key, 0)
      return
    }
    setOption(key, previous.current[key] || DEFAULT_VOLUME[key])
  }

  return (
    <>
      <Popup title="OPTIONS" width={720} height={560} onClose={closeModal}>
        <div className="stack">
          <Slider
            label="BGM"
            value={options.bgm}
            onChange={(v) => setOption('bgm', v)}
            icon={{ on: GUI.MUSIC_ON, off: GUI.MUSIC_OFF }}
            onToggle={() => toggle('bgm')}
          />
          <Slider
            label="SFX"
            value={options.sfx}
            onChange={(v) => setOption('sfx', v)}
            icon={{ on: GUI.VOLUME_ON, off: GUI.VOLUME_OFF }}
            onToggle={() => toggle('sfx')}
          />

          <div className="options-account">
            <div className="options-account-who">
              <IconGlyph icon={GUI.INFO} size={28} />
              <div className="options-account-lines">
                <BitmapLabel text={account ? `LOGGED IN AS ${account.userId}` : `GUEST ${userId}`} size={20} />
                {/* 동기화가 조용히 실패하면 "저장됐겠지" 하고 믿게 된다. 상태를 늘 보여 준다. */}
                {account && (
                  <BitmapLabel text={SYNC_LABEL[sync]} size={14} />
                )}
              </div>
            </div>

            {/*
              비회원에게는 로그아웃할 것이 없다. 대신 계정을 만들면 무엇이 좋은지만 알려 준다 —
              여기서 곧바로 가입시키면 지금 놀던 동물원이 어디로 가는지 설명할 자리가 없다.
            */}
            {account ? (
              <button type="button" className="text-button" onClick={() => setConfirming(true)}>
                <BitmapLabel text="LOG OUT" size={22} />
              </button>
            ) : (
              <BitmapLabel text="SIGN UP FROM THE TITLE TO SYNC" size={15} />
            )}
          </div>

          {/* 나가는 문. 계정을 놓는 로그아웃과 달리 저장만 하고 타이틀로 돌아간다. */}
          <div className="options-exit">
            <button type="button" className="labeled-button" onClick={() => setLeaving(true)}>
              <IconGlyph icon={GUI.BACK} size={34} />
              <BitmapLabel text="BACK TO TITLE" size={20} />
            </button>
          </div>
        </div>
      </Popup>

      {leaving && (
        <ConfirmPopup
          title="BACK TO TITLE"
          lines={['YOUR ZOO IS SAVED HERE', 'GO TO THE TITLE ?']}
          onCancel={() => setLeaving(false)}
          onConfirm={goToTitle}
        />
      )}

      {confirming && (
        <ConfirmPopup
          title="LOG OUT"
          lines={['THIS ZOO STAYS ON THIS DEVICE', 'LOG OUT NOW ?']}
          onCancel={() => setConfirming(false)}
          onConfirm={logOut}
        />
      )}
    </>
  )
}
