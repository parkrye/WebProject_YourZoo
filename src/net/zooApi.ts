import type { BiomeId } from '@/assets/manifest'
import type { Animal } from '@/domain/animal'
import type { OwnedProp } from '@/domain/prop'
import { apiGet, apiSend, imageUrl } from './http'

/**
 * 서버에 올라가는 동물원 한 채.
 *
 * 소지금과 창고는 담지 않는다 — 구경하는 사람이 알 이유가 없고,
 * 남의 지갑이 보이면 자랑하려고 숫자를 부풀리는 쪽으로 놀이가 기운다.
 * 배치된 동물과 프롭만 올린다.
 */
export interface ZooDoc {
  readonly userId: string
  readonly zooName: string
  readonly reputation: number
  readonly day: number
  readonly unlocked: readonly BiomeId[]
  readonly animals: readonly Animal[]
  readonly props: readonly OwnedProp[]
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

export async function searchZoos(query: string, exclude: string): Promise<ZooSummary[]> {
  const path = `/zoos?q=${encodeURIComponent(query)}&exclude=${encodeURIComponent(exclude)}`
  const result = await apiGet<{ zoos: ZooSummary[] }>(path)
  return result.ok ? result.data.zoos : []
}

/** 본인을 뺀 아무 동물원. 저장된 게 자기 것뿐이면 null. */
export async function randomZoo(exclude: string): Promise<ZooDoc | null> {
  const result = await apiGet<{ zoo: ZooDoc }>(`/zoos/random?exclude=${encodeURIComponent(exclude)}`)
  return result.ok ? result.data.zoo : null
}

export async function fetchZoo(userId: string): Promise<ZooDoc | null> {
  const result = await apiGet<{ zoo: ZooDoc }>(`/zoos/${encodeURIComponent(userId)}`)
  return result.ok ? result.data.zoo : null
}

export async function publishZoo(
  doc: Omit<ZooDoc, 'updatedAt'>,
  images: Record<string, string>,
  /** 계정이 있으면 토큰을 함께 보낸다. 서버는 이걸로 주인만 덮어쓰게 한다. */
  token?: string,
): Promise<boolean> {
  const result = await apiSend(
    `/zoos/${encodeURIComponent(doc.userId)}`,
    'PUT',
    { ...doc, images },
    token,
  )
  return result.ok
}

/** 남의 동물원 그림이 있는 자리. IndexedDB 가 아니라 서버에서 읽는다. */
export function remoteImageUrl(imageId: string): string {
  return imageUrl(imageId)
}
