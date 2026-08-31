import { useState } from 'react'
import { getAssets } from '@/assets/AssetStore'
import { GUI, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '@/assets/manifest'
import { useGameStore } from '@/store/gameStore'
import { BitmapInput } from '@/ui/components/BitmapInput'
import { BitmapLabel } from '@/ui/components/BitmapLabel'
import { IconButton } from '@/ui/components/IconButton'
import { useEffect, useRef } from 'react'

/** 아이디는 파일명이 되고 화면에도 뜬다. 서버의 규칙과 맞춰 둔다. */
const ID_MAX = 16
const PASSWORD_MAX = 20
/** 폰트 시트에 있는 글자여야 한다. `FONT_CHARS` 참고. */
const PASSWORD_MASK = '.'

type AuthMode = 'LOGIN' | 'SIGNUP'

interface AuthScreenProps {
  /** 로그인 칸에서 뒤로 갈 때. 회원가입에서는 로그인으로 먼저 되돌아온다. */
  onBack: () => void
}

/**
 * 로그인 / 회원가입.
 *
 * 비밀번호는 비트맵 폰트로 **점만** 보여 준다. 폰트에 소문자가 없어서
 * 입력값을 그대로 그리면 어차피 제대로 안 보이고, 어깨너머로도 읽힌다.
 *
 * 계정이 있어야 하는 이유는 하나다 — **다른 기기에서 이어하기.**
 * 그래서 로그인에 성공하면 서버의 세이브를 받아 그대로 이어간다.
 *
 * 회원가입은 여기서 갈라져 나간다. 타이틀에서 로그인과 나란히 놓으면
 * **처음 온 사람도 이미 계정이 있는 사람도** 둘 중 뭘 눌러야 하는지 매번 읽어야 한다.
 */
export function AuthScreen({ onBack }: AuthScreenProps) {
  const signUpAndStart = useGameStore((s) => s.signUpAndStart)
  const logInAndStart = useGameStore((s) => s.logInAndStart)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [mode, setMode] = useState<AuthMode>('LOGIN')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { sky, area, fence } = getAssets()
    ctx.drawImage(sky.AFTERNOON, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
    ctx.drawImage(area.FIELD, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
    ctx.drawImage(fence, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT)
  }, [])

  const ready = userId.trim().length >= 4 && password.length >= 4 && !busy

  /** 비밀번호는 단계를 옮길 때마다 비운다. 가입 폼에 로그인 시도가 남아 있으면 안 된다. */
  const goto = (next: AuthMode): void => {
    setMode(next)
    setPassword('')
    setError(null)
  }

  const back = (): void => {
    if (busy) return
    if (mode === 'SIGNUP') goto('LOGIN')
    else onBack()
  }

  const submit = async (): Promise<void> => {
    if (!ready) return
    setBusy(true)
    setError(null)
    const failure =
      mode === 'SIGNUP'
        ? await signUpAndStart(userId, password)
        : await logInAndStart(userId, password)
    setBusy(false)
    if (failure) setError(failure)
  }

  return (
    <div className="screen">
      <canvas ref={canvasRef} width={LOGICAL_WIDTH} height={LOGICAL_HEIGHT} className="screen-canvas" />

      <div className="auth-overlay">
        <div className="auth-card">
          <BitmapLabel text={mode === 'SIGNUP' ? 'SIGN UP' : 'LOGIN'} size={44} align="center" />

          <div className="auth-field">
            <BitmapLabel text="ID" size={18} />
            <BitmapInput
              value={userId}
              maxLength={ID_MAX}
              placeholder="4 TO 16 CHARS"
              onChange={setUserId}
            />
          </div>

          <div className="auth-field">
            <BitmapLabel text="PASSWORD" size={18} />
            {/*
              눌린 글자 수만 점으로 보여 준다. 실제 값은 아래 숨은 입력이 들고 있다.
              별표를 쓰지 않는 이유는 하나다 — 폰트 시트에 별표가 없다.
            */}
            <BitmapInput
              value={password}
              maxLength={PASSWORD_MAX}
              placeholder="4 CHARS OR MORE"
              mask={PASSWORD_MASK}
              onChange={setPassword}
            />
          </div>

          <div className="auth-note">
            <BitmapLabel
              text={mode === 'SIGNUP' ? 'YOUR ZOO SYNCS TO THE SERVER' : 'CONTINUE ON ANY DEVICE'}
              size={15}
              align="center"
            />
          </div>

          {mode === 'LOGIN' && (
            <div className="auth-switch">
              <button type="button" className="text-button" onClick={() => goto('SIGNUP')}>
                <BitmapLabel text="NO ACCOUNT?  SIGN UP" size={17} align="center" />
              </button>
            </div>
          )}

          {error && (
            <div className="auth-error">
              <BitmapLabel text={error} size={17} align="center" />
            </div>
          )}

          <div className="auth-actions">
            <IconButton icon={GUI.BACK} size={58} title="BACK" onClick={back} />
            <IconButton
              icon={GUI.CONFIRM}
              size={72}
              title={mode === 'SIGNUP' ? 'CREATE' : 'LOGIN'}
              disabled={!ready}
              onClick={() => void submit()}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
