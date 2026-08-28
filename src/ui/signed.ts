/**
 * 부호를 붙인 금액.
 *
 * 예전엔 부호를 떼고 **색으로만** 들고 났다를 구분했다. 폰트에 빼기표가 없어서였는데,
 * 색만으로는 흑자와 적자가 같아 보이는 사람이 있다. 이제 기호가 있으니 붙여 적는다.
 *
 * `tone` 은 값이 이미 양수로 저장된 항목에 쓴다 — 유지비는 40 으로 들고 `-40` 으로 적는다.
 */
export function signed(value: number, tone?: 'plus' | 'minus'): string {
  const amount = Math.abs(value)
  // 0 에는 부호를 붙이지 않는다. `-0` 은 읽는 사람을 잠깐 멈추게 한다.
  if (amount === 0) return '0'
  if (tone === 'minus') return `-${amount}`
  if (tone === 'plus') return `+${amount}`
  return `${value < 0 ? '-' : '+'}${amount}`
}
