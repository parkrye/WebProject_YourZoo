import { loadImageBitmap } from '@/store/imageDb'

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

  const task = loadImageBitmap(id)
    .then((bitmap) => {
      if (bitmap) bitmaps.set(id, bitmap)
      return bitmap
    })
    .catch(() => null)
    .finally(() => pending.delete(id))

  pending.set(id, task)
  return task
}
