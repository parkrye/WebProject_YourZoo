/**
 * 서버와 말하는 한 가지 방식.
 *
 * 서버의 모든 응답은 같은 봉투를 쓴다 — 성공 `{ ok: true, ... }`,
 * 실패 `{ ok: false, code, message }`. 그걸 여기서 한 번만 풀어
 * 호출하는 쪽은 결과와 실패 문구만 보게 한다.
 *
 * 실패를 예외로 던지지 않는다. 서버가 아예 없어도(정적 호스팅) 비회원으로는
 * 놀 수 있어야 하고, 그러려면 호출하는 쪽이 실패를 **값으로** 다루는 편이 낫다.
 */
export const API = '/api/v1'

export interface Ok<T> {
  readonly ok: true
  readonly data: T
}

export interface Fail {
  readonly ok: false
  /** 기계가 보는 값. 화면에 띄우지 않는다. */
  readonly code: string
  /** 화면에 그대로 띄울 문구. 영문 대문자다 — 폰트 제약. */
  readonly message: string
}

export type Result<T> = Ok<T> | Fail

const UNREACHABLE: Fail = { ok: false, code: 'UNREACHABLE', message: 'SERVER NOT REACHABLE' }

export async function apiGet<T>(path: string, token?: string): Promise<Result<T>> {
  return request<T>(path, { method: 'GET' }, token)
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT',
  body: unknown,
  token?: string,
): Promise<Result<T>> {
  return request<T>(
    path,
    {
      method,
      // 서버가 JSON 타입을 요구한다. 폼 전송으로 위장한 교차 출처 요청을 걸러 내기 위해서다.
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token,
  )
}

async function request<T>(path: string, init: RequestInit, token?: string): Promise<Result<T>> {
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
        ...(token ? { 'x-zoo-token': token } : {}),
      },
      // 이 서버는 쿠키를 쓰지 않는다. 토큰은 헤더로만 간다.
      credentials: 'omit',
      cache: 'no-store',
    })

    const body = (await res.json()) as Record<string, unknown>
    if (res.ok && body.ok === true) return { ok: true, data: body as T }

    return {
      ok: false,
      code: typeof body.code === 'string' ? body.code : 'SERVER_ERROR',
      message: typeof body.message === 'string' ? body.message : 'SERVER ERROR',
    }
  } catch {
    return UNREACHABLE
  }
}

/** 그림은 봉투 없이 바이너리로 온다. 주소만 만들어 준다. */
export function imageUrl(imageId: string): string {
  return `${API}/images/${encodeURIComponent(imageId)}`
}
