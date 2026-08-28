import { useState } from 'react'
import { GUI } from '@/assets/manifest'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { ConfirmPopup } from '@/ui/components/ConfirmPopup'
import { IconGlyph } from '@/ui/components/IconGlyph'
import { Popup } from '@/ui/components/Popup'
import { Slider } from '@/ui/components/Slider'
import { useGameStore, type SyncState } from '@/store/gameStore'

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
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <Popup title="OPTIONS" width={720} height={520} onClose={closeModal}>
        <div className="stack">
          <Slider label="BGM" value={options.bgm} onChange={(v) => setOption('bgm', v)} />
          <Slider label="SFX" value={options.sfx} onChange={(v) => setOption('sfx', v)} />

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
        </div>
      </Popup>

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
