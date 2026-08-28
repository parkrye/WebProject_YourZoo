import { useEffect, useRef, useState } from 'react'
import { BitmapFont } from '@/render/BitmapText'
import { BitmapLabel } from './BitmapLabel'

interface BitmapInputProps {
  value: string
  onChange: (value: string) => void
  maxLength: number
  placeholder?: string
  size?: number
  width?: number
  /**
   * 값 대신 이 글자를 반복해 보여 준다. 비밀번호에 쓴다.
   *
   * 폰트에 소문자가 없어 입력값을 그대로 그려도 제대로 안 보이는데다,
   * 어깨너머로도 읽힌다. 글자 수만 보여 주는 편이 낫다.
   */
  mask?: string
}

const CARET_BLINK_MS = 530

/**
 * 스프라이트 폰트로 보이는 입력 필드.
 *
 * 실제 `<input>` 은 투명하게 겹쳐 두고(키보드·IME·접근성 유지) 화면에는 비트맵 글자를 그린다.
 * 폰트가 A-Z / 0-9 밖에 없으므로 입력 즉시 대문자로 정규화하고 지원 외 문자는 버린다.
 */
export function BitmapInput({
  value,
  onChange,
  maxLength,
  placeholder = '',
  size = 30,
  width = 320,
  mask,
}: BitmapInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [caretOn, setCaretOn] = useState(true)

  useEffect(() => {
    if (!focused) return
    setCaretOn(true)
    const timer = window.setInterval(() => setCaretOn((v) => !v), CARET_BLINK_MS)
    return () => window.clearInterval(timer)
  }, [focused, value])

  const showPlaceholder = value.length === 0 && !focused
  const shown = mask ? mask.repeat(value.length) : value

  return (
    <div className="bitmap-input" style={{ width }} onPointerDown={() => inputRef.current?.focus()}>
      <BitmapLabel text={showPlaceholder ? placeholder : shown} size={size} />
      {focused && caretOn && <span className="bitmap-caret" style={{ height: size }} />}
      <input
        ref={inputRef}
        className="bitmap-input-field"
        type={mask ? 'password' : 'text'}
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) =>
          // 가려서 보여 주는 값은 폰트 제약을 받을 이유가 없다.
          // 예전에는 비밀번호까지 대문자 A-Z 0-9 로 깎여, 친 것과 저장된 것이 달랐다.
          onChange(mask ? e.target.value.slice(0, maxLength) : BitmapFont.sanitize(e.target.value, maxLength))
        }
      />
    </div>
  )
}
