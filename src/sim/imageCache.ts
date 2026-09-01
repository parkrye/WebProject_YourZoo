import { loadImageBitmap } from '@/store/imageDb'
import { remoteImageUrl } from '@/net/zooApi'
import type { Animal } from '@/domain/animal'

/**
 * 정지 자세를 합치는 데 필요한 최소한.
 *
 * 동물 한 마리를 통째로 받지 않는다 — 등록된 종에도 같은 파츠 표가 있고,
 * 상점 목록에서 그것을 그리자고 개체를 하나 지어내는 건 앞뒤가 바뀐 일이다.
 */
type RigSource = Pick<Animal, 'rig' | 'imageId' | 'templateId'>
import { rigOf } from '@/domain/rig'
import { findSheet, SHEET_KEY_PREFIX } from '@/domain/shop'
import { templateOf } from '@/domain/templates'
import { composeRig } from '@/render/animal/composeRig'

/**
 * 동물 그림 비트맵 캐시.
 *
 * 그림은 IndexedDB 에 Blob 으로 있고 렌더에는 `ImageBitmap` 이 필요하다.
 * 매 프레임 디코드할 수 없으니 id 별로 한 번만 만들어 들고 있는다.
 */
const bitmaps = new Map<string, ImageBitmap>()
const pending = new Map<string, Promise<ImageBitmap | null>>()

export function getBitmap(id: string): ImageBitmap | null {
  return bitmaps.get(id) ?? null
}

/** 동물을 방출했을 때 호출한다. 메모리에 남겨둘 이유가 없다. */
export function forgetBitmap(id: string): void {
  for (const key of [id, stillKey(id)]) {
    bitmaps.get(key)?.close()
    bitmaps.delete(key)
  }
}

/** 합성한 정지 자세가 앉는 자리. 파츠 그림들과 같은 캐시를 쓰되 id 는 겹치지 않는다. */
const stillKey = (imageId: string): string => `${imageId}#still`

/**
 * 목록에 띄울 동물 그림 한 장.
 *
 * 리그 동물은 대표 그림 한 장으로 끝나지 않는다 — 파츠를 정지 자세로 합쳐야
 * 비로소 그 동물이 된다. 합친 결과는 같은 캐시에 두어 한 번만 굽는다.
 * 옛 세이브의 대표 그림은 몸통 조각이므로 **여기서 늘 다시 합친다.**
 */
export async function ensureStillBitmap(animal: RigSource): Promise<ImageBitmap | null> {
  const rig = animal.rig
  if (!rig) return ensureBitmap(animal.imageId)

  const key = stillKey(animal.imageId)
  const cached = bitmaps.get(key)
  if (cached) return cached
  const inFlight = pending.get(key)
  if (inFlight) return inFlight

  const task = composeStill(animal, rig)
    .then((bitmap) => {
      if (bitmap) bitmaps.set(key, bitmap)
      return bitmap
    })
    .catch(() => null)
    .finally(() => pending.delete(key))

  pending.set(key, task)
  return task
}

/** 이미 구워 둔 정지 자세. 없으면 null — 첫 프레임의 깜빡임을 줄이는 데만 쓴다. */
export function getStillBitmap(animal: RigSource): ImageBitmap | null {
  if (!animal.rig) return getBitmap(animal.imageId)
  return bitmaps.get(stillKey(animal.imageId)) ?? null
}

/** 파츠를 모두 읽어 한 장으로 굽는다. 하나도 못 읽으면 대표 그림으로 물러난다. */
async function composeStill(animal: RigSource, rig: Record<string, string>): Promise<ImageBitmap | null> {
  const parts = new Map<string, ImageBitmap>()
  for (const [partId, imageId] of Object.entries(rig)) {
    const part = getBitmap(imageId) ?? (await ensureBitmap(imageId))
    if (part) parts.set(partId, part)
  }
  if (parts.size === 0) return ensureBitmap(animal.imageId)

  const blob = await composeRig(rigOf(templateOf(animal.templateId).archetype), parts)
  if (!blob) return ensureBitmap(animal.imageId)
  return createImageBitmap(blob)
}

/** 이미 Blob 을 손에 들고 있을 때(방금 그린 직후) 디코드를 앞당긴다. */
export async function registerFromBlob(id: string, blob: Blob): Promise<void> {
  try {
    bitmaps.set(id, await createImageBitmap(blob))
  } catch {
    // 디코드 실패는 렌더 생략으로 이어질 뿐이라 조용히 넘긴다.
  }
}

/** 캐시에 없으면 IndexedDB 에서 읽어 채운다. 같은 id 의 중복 요청은 합쳐진다. */
export async function ensureBitmap(id: string): Promise<ImageBitmap | null> {
  const cached = bitmaps.get(id)
  if (cached) return cached

  const inFlight = pending.get(id)
  if (inFlight) return inFlight

  // 상점 동물의 시트는 IndexedDB 가 아니라 번들에 있다. 키 접두사로 갈라 읽는다.
  // 뒤의 체인은 **두 경로에 모두** 걸려야 한다 — 예전에는 삼항의 오른쪽에만 붙어
  // 카탈로그 시트가 캐시에 들어가지 않았고, `pending` 도 영영 비워지지 않았다.
  const load = id.startsWith(SHEET_KEY_PREFIX) ? loadCatalogSheet(id) : loadImageBitmap(id)
  const task = load
    .then((bitmap) => {
      if (bitmap) bitmaps.set(id, bitmap)
      return bitmap
    })
    .catch(() => null)
    .finally(() => pending.delete(id))

  pending.set(id, task)
  return task
}

/** 번들에 들어 있는 상점 동물 시트를 읽는다. */
async function loadCatalogSheet(id: string): Promise<ImageBitmap | null> {
  const asset = findSheet(id.slice(SHEET_KEY_PREFIX.length))
  if (!asset) return null
  try {
    const res = await fetch(asset.src)
    if (!res.ok) return null
    return await createImageBitmap(await res.blob())
  } catch {
    return null
  }
}

/**
 * 남의 동물원 그림을 서버에서 받아 같은 캐시에 넣는다.
 *
 * 구경하는 동물의 그림은 내 IndexedDB 에 없다. 그렇다고 `ensureBitmap` 이
 * 실패할 때마다 서버를 찔러 보게 하면, 방금 판 동물의 그림을 찾다가도 네트워크를 탄다.
 * **구경에 들어갈 때 명시적으로** 미리 받아 둔다.
 */
export async function preloadRemote(userId: string, ids: readonly string[]): Promise<void> {
  await Promise.all(
    ids.map(async (id) => {
      if (bitmaps.has(id)) return
      // 상점 동물 시트는 번들에 있다. 남의 동물원 것이어도 서버를 찌를 이유가 없다.
      if (id.startsWith(SHEET_KEY_PREFIX)) {
        await ensureBitmap(id)
        return
      }
      try {
        const res = await fetch(remoteImageUrl(userId, id))
        if (!res.ok) return
        bitmaps.set(id, await createImageBitmap(await res.blob()))
      } catch {
        // 못 받은 그림은 그 동물만 안 보인다. 구경 자체를 막을 이유는 없다.
      }
    }),
  )
}
