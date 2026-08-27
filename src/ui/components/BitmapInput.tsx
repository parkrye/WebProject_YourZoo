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

  return (
    <div className="bitmap-input" style={{ width }} onPointerDown={() => inputRef.current?.focus()}>
      <BitmapLabel text={showPlaceholder ? placeholder : value} size={size} />
      {focused && caretOn && <span className="bitmap-caret" style={{ height: size }} />}
      <input
        ref={inputRef}
        className="bitmap-input-field"
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(BitmapFont.sanitize(e.target.value, maxLength))}
      />
    </div>
  )
}
