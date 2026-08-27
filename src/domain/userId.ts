/**
 * 헷갈리는 글자를 뺀 알파벳.
 *
 * 0/O, 1/I/L 은 이 게임의 비트맵 폰트에서 특히 구분이 어렵다.
 * 유저가 아이디를 **눈으로 읽어 남에게 불러 줘야** 하므로 아예 후보에서 뺀다.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const ID_LENGTH = 6

/** 아이디 앞에 붙는 글자. 동물원 이름과 섞여도 아이디임이 보인다. */
const PREFIX = 'Z'

/**
 * 동물원 주인 식별자를 만든다. 예: `ZK4MPQD`
 *
 * 폰트에 대문자와 숫자밖에 없어 소문자는 쓰지 않는다.
 * 충돌은 신경 쓰지 않는다 — 31^6 ≈ 8.9억이고, 재미로 돌리는 서버다.
 */
export function createUserId(): string {
  let id = PREFIX
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return id
}

/** 저장된 값이 아이디 꼴인가. 손상된 세이브를 걸러낼 때 쓴다. */
export function isUserId(value: unknown): value is string {
  return typeof value === 'string' && value.length === PREFIX.length + ID_LENGTH
}
