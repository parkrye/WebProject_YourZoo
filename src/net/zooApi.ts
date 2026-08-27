import type { BiomeId } from '@/assets/manifest'
import type { Animal } from '@/domain/animal'

/**
 * 서버에 올라가는 동물원 한 채.
 *
 * 소지금과 창고는 담지 않는다 — 구경하는 사람이 알 이유가 없고,
 * 남의 지갑이 보이면 자랑하려고 숫자를 부풀리는 쪽으로 놀이가 기운다.
 * 배치된 동물만 올린다.
 */
export interface ZooDoc {
  readonly userId: string
  readonly zooName: string
  readonly reputation: number
  readonly day: number
  readonly unlocked: readonly BiomeId[]
  readonly animals: readonly Animal[]
  readonly updatedAt: number
}

/** 검색 결과 한 줄. 동물 배열 없이 목록에 필요한 것만 온다. */
export interface ZooSummary {
  readonly userId: string
  readonly zooName: string
  readonly reputation: number
  readonly day: number
  readonly animalCount: number
  readonly updatedAt: number
}

/** 업로드 본문. 그림은 data URL 로 함께 보내고 서버가 파일로 떼어 낸다. */
interface PublishBody extends Omit<ZooDoc, 'updatedAt'> {
  images: Record<string, string>
}

const API = '/api'

export async function searchZoos(query: string, exclude: string): Promise<ZooSummary[]> {
  const url = `${API}/zoos?q=${encodeURIComponent(query)}&exclude=${encodeURIComponent(exclude)}`
  const res = await fetch(url)
  if (!res.ok) return []
  const body = (await res.json()) as { zoos?: ZooSummary[] }
  return body.zoos ?? []
}

/** 본인을 뺀 아무 동물원. 저장된 게 자기 것뿐이면 null. */
export async function randomZoo(exclude: string): Promise<ZooDoc | null> {
  const res = await fetch(`${API}/zoos/random?exclude=${encodeURIComponent(exclude)}`)
  if (!res.ok) return null
  return (await res.json()) as ZooDoc
}

export async function fetchZoo(userId: string): Promise<ZooDoc | null> {
  const res = await fetch(`${API}/zoos/${encodeURIComponent(userId)}`)
  if (!res.ok) return null
  return (await res.json()) as ZooDoc
}

export async function publishZoo(doc: Omit<ZooDoc, 'updatedAt'>, images: Record<string, string>): Promise<boolean> {
  const body: PublishBody = { ...doc, images }
  try {
    const res = await fetch(`${API}/zoos/${encodeURIComponent(doc.userId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok
  } catch {
    // 서버가 없어도(정적 호스팅 등) 게임은 그대로 돌아가야 한다.
    return false
  }
}

/** 남의 동물원 그림이 있는 자리. IndexedDB 가 아니라 서버에서 읽는다. */
export function remoteImageUrl(imageId: string): string {
  return `${API}/images/${encodeURIComponent(imageId)}`
}
