import type { Animal } from './animal'

/**
 * 같은 종인가를 가르는 키.
 *
 * 종을 따로 적어 두지 않는다 — **그림이 곧 종이다.** 같은 그림을 쓰는 동물은
 * 같게 생겼고, 같게 생긴 것들이 무리를 짓는 것이 눈에 보이는 규칙이다.
 *
 * 세 경우가 모두 이 한 줄로 갈린다.
 *   상점 동물   `sheet:LION` 처럼 카탈로그를 가리켜 같은 종끼리 저절로 묶인다
 *   그린 동물   그림 키가 개체마다 달라 혼자가 된다
 *   등록한 종   사 온 개체가 원본과 **같은 그림 키**를 물려받아 함께 묶인다
 */
export function speciesKeyOf(animal: Pick<Animal, 'imageId'>): string {
  return animal.imageId
}
