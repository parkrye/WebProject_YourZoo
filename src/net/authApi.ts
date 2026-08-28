import type { SaveV2 } from '@/store/save'
import { apiGet, apiSend } from './http'

/**
 * 로그인한 계정.
 *
 * `token` 은 세이브를 올릴 때만 쓴다 — 서버는 이걸로 "이 아이디의 주인인가"만 본다.
 * 비회원은 계정이 없으므로 이 값도 없다.
 */
export interface Account {
  readonly userId: string
  readonly token: string
}

export interface AuthResult {
  readonly account: Account | null
  /** 실패했을 때 화면에 그대로 띄울 문구. 영문 대문자다 — 폰트 제약. */
  readonly error: string | null
  /** 로그인 시, 서버에 이어할 세이브가 있는가. */
  readonly hasSave: boolean
}

interface AuthBody {
  userId: string
  token: string
  hasSave?: boolean
}

export async function signUp(userId: string, password: string): Promise<AuthResult> {
  return toAuthResult(await apiSend<AuthBody>('/auth/signup', 'POST', { userId, password }))
}

export async function logIn(userId: string, password: string): Promise<AuthResult> {
  return toAuthResult(await apiSend<AuthBody>('/auth/login', 'POST', { userId, password }))
}

function toAuthResult(result: Awaited<ReturnType<typeof apiSend<AuthBody>>>): AuthResult {
  if (!result.ok) return { account: null, error: result.message, hasSave: false }

  const { userId, token, hasSave } = result.data
  if (!userId || !token) return { account: null, error: 'SERVER ERROR', hasSave: false }
  return { account: { userId, token }, error: null, hasSave: hasSave === true }
}

/** 계정의 클라우드 세이브. 없으면 null. */
export async function fetchCloudSave(account: Account): Promise<SaveV2 | null> {
  const result = await apiGet<{ save: SaveV2 }>(
    `/saves/${encodeURIComponent(account.userId)}`,
    account.token,
  )
  return result.ok ? result.data.save : null
}

/** 세이브를 올린다. 그림은 함께 실어 보내고 서버가 파일로 떼어 낸다. */
export async function pushCloudSave(
  account: Account,
  save: SaveV2,
  images: Record<string, string>,
): Promise<boolean> {
  const result = await apiSend(
    `/saves/${encodeURIComponent(account.userId)}`,
    'PUT',
    { ...save, images },
    account.token,
  )
  return result.ok
}
