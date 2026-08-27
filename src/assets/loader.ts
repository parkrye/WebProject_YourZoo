export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`))
    img.src = src
  })
}

export type ProgressFn = (loaded: number, total: number) => void

export async function loadImages(
  srcs: readonly string[],
  onProgress?: ProgressFn,
): Promise<Map<string, HTMLImageElement>> {
  const result = new Map<string, HTMLImageElement>()
  const unique = [...new Set(srcs)]
  let loaded = 0

  await Promise.all(
    unique.map(async (src) => {
      const img = await loadImage(src)
      result.set(src, img)
      loaded++
      onProgress?.(loaded, unique.length)
    }),
  )

  return result
}
