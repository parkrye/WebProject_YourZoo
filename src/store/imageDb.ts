import { createStore, del, get, set } from 'idb-keyval'

/**
 * 플레이어가 그린 동물 그림 저장소.
 *
 * localStorage 는 5MB 상한이라 PNG 를 20~30장만 넣어도 터진다.
 * 그림은 Blob 으로 IndexedDB 에, 나머지 세이브 데이터는 localStorage 에 둔다.
 * @see docs/02-architecture.md §3.4
 */
const store = createStore('yourzoo', 'images')

export async function putImage(id: string, blob: Blob): Promise<void> {
  await set(id, blob, store)
}

export async function getImage(id: string): Promise<Blob | undefined> {
  return get<Blob>(id, store)
}

export async function deleteImage(id: string): Promise<void> {
  await del(id, store)
}

/** 저장된 그림을 캔버스에 바로 그릴 수 있는 형태로 읽는다. 없으면 null. */
export async function loadImageBitmap(id: string): Promise<ImageBitmap | null> {
  const blob = await getImage(id)
  if (!blob) return null
  return createImageBitmap(blob)
}
