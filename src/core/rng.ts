/** mulberry32 — 짧고 품질 충분한 시드 난수. 세이브 재현성을 위해 Math.random 대신 쓴다. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number

export const randRange = (rng: Rng, min: number, max: number): number => min + rng() * (max - min)

export const randInt = (rng: Rng, minInclusive: number, maxExclusive: number): number =>
  minInclusive + Math.floor(rng() * (maxExclusive - minInclusive))

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: 빈 배열')
  return items[Math.floor(rng() * items.length)] as T
}
