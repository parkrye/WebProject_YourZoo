import type { SpeciesDoc } from '@/domain/species'
import { apiGet, apiSend } from './http'

/**
 * 남들이 내놓은 종 목록.
 *
 * 공개된 것만 온다 — 비공개 종은 서버의 목록 캐시에 아예 들어가지 않는다.
 * 내 종은 서버에 물어보지 않는다. 그건 내 세이브에 이미 있다.
 */
export async function fetchPublicSpecies(exclude: string): Promise<SpeciesDoc[]> {
  const result = await apiGet<{ species: SpeciesDoc[] }>(
    `/species?exclude=${encodeURIComponent(exclude)}`,
  )
  return result.ok ? result.data.species : []
}

/**
 * 내 종 목록을 통째로 올린다.
 *
 * 한 종만 올리지 않는다 — 비공개로 되돌린 종은 목록에서 **빠져야** 하는데,
 * 하나씩 올리면 빠진 것을 서버가 알 길이 없다. 목록 전체가 곧 지금의 사실이다.
 */
export async function publishSpecies(
  userId: string,
  species: readonly SpeciesDoc[],
  images: Record<string, string>,
  token?: string,
): Promise<boolean> {
  const result = await apiSend(
    `/species/${encodeURIComponent(userId)}`,
    'PUT',
    { species, images },
    token,
  )
  return result.ok
}
