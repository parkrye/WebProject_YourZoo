import { loadImageBitmap } from '@/store/imageDb'
import { remoteImageUrl } from '@/net/zooApi'
import { findSheet, SHEET_KEY_PREFIX } from '@/domain/shop'

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
  bitmaps.get(id)?.close()
  bitmaps.delete(id)
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
  const task = id.startsWith(SHEET_KEY_PREFIX) ? loadCatalogSheet(id) : loadImageBitmap(id)
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
export async function preloadRemote(ids: readonly string[]): Promise<void> {
  await Promise.all(
    ids.map(async (id) => {
      if (bitmaps.has(id)) return
      // 상점 동물 시트는 번들에 있다. 남의 동물원 것이어도 서버를 찌를 이유가 없다.
      if (id.startsWith(SHEET_KEY_PREFIX)) {
        await ensureBitmap(id)
        return
      }
      try {
        const res = await fetch(remoteImageUrl(id))
        if (!res.ok) return
        bitmaps.set(id, await createImageBitmap(await res.blob()))
      } catch {
        // 못 받은 그림은 그 동물만 안 보인다. 구경 자체를 막을 이유는 없다.
      }
    }),
  )
}
