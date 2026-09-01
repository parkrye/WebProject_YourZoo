import { clamp } from '@/core/math'
import { pick, type Rng } from '@/core/rng'

/**
 * 손님이 남기는 한마디.
 *
 * 롤러코스터 타이쿤이 손님 머리 위에 띄우던 그 말이다. 수치로는 못 하는 일을 한다 —
 * 명성 34 는 잘하고 있다는 뜻인지 알 수 없지만, "AA IS SO AMAZING" 이 다섯 줄
 * 쌓이고 "BB LOOKS BORED" 가 한 줄이면 무엇을 더 하면 되는지가 읽힌다.
 *
 * 화면에서는 **아이콘만** 띄운다. 손님 머리 위는 좁고, 글자를 넣으면 스무 명이
 * 동시에 떠들 때 우리 안이 보이지 않는다. 문장은 평가 목록에서 읽는다.
 */
export interface Review {
  readonly id: string
  readonly animalId: string
  /** 그때의 이름. 나중에 이름을 바꿔도 남긴 말은 그대로 둔다. */
  readonly animalName: string
  readonly text: string
  /** `1` 칭찬, `-1` 불평. 0 은 없다 — 어느 쪽도 아닌 말은 남길 이유가 없다. */
  readonly sentiment: 1 | -1
  readonly day: number
}

/** 이 매력도쯤 되면 칭찬이 거의 확실해진다. */
const APPEAL_FOR_PRAISE = 30

/** 칭찬 확률의 바닥과 천장. 어느 쪽도 100% 가 되지 않아야 사람이 하는 말로 읽힌다. */
const PRAISE_CHANCE = { min: 0.08, max: 0.94 } as const
const PRAISE_BASE = 0.3
const PRAISE_FROM_APPEAL = 0.55
const PRAISE_LOST_TO_CROWDING = 0.25

/**
 * 문장은 이름 하나만 갈아 끼운다.
 *
 * 폰트가 영문 대문자와 몇 가지 기호뿐이라(`FONT_CHARS`) 쓸 수 있는 글자가 좁다.
 * 없는 글자를 넣으면 그 자리가 조용히 빈칸이 되므로 여기 있는 문장이 곧 규격이다.
 */
const PRAISE: readonly string[] = [
  '% IS SO AMAZING!',
  'I LOVE %!',
  '% MADE MY DAY',
  'LOOK AT %!',
  'I CAME JUST FOR %',
  '% IS WORTH THE TICKET',
  'CAN WE TAKE % HOME?',
]

const COMPLAINT: readonly string[] = [
  '% LOOKS BORED',
  '% NEEDS MORE ROOM',
  '% IS HIDING AGAIN',
  'I EXPECTED MORE FROM %',
  '% JUST SLEEPS ALL DAY',
  'IS % EVEN AWAKE?',
]

export interface ReviewInput {
  animalId: string
  animalName: string
  appeal: number
  /** 그 우리가 얼마나 붐비는가. 0 이 텅 빈 상태, 1 이 정원. */
  crowding: number
  day: number
}

/**
 * 한마디를 만든다.
 *
 * 매력도가 높을수록 칭찬이 잦고, 붐빌수록 불평이 는다. 다만 어느 쪽도 확정이
 * 아니다 — 명작 앞에서도 심드렁한 사람은 있고, 그게 있어야 한 줄이 사람의 말로 읽힌다.
 */
export function makeReview(input: ReviewInput, rng: Rng): Review {
  const chance = clamp(
    PRAISE_BASE +
      (input.appeal / APPEAL_FOR_PRAISE) * PRAISE_FROM_APPEAL -
      input.crowding * PRAISE_LOST_TO_CROWDING,
    PRAISE_CHANCE.min,
    PRAISE_CHANCE.max,
  )

  const sentiment: 1 | -1 = rng() < chance ? 1 : -1
  const template = pick(rng, sentiment === 1 ? PRAISE : COMPLAINT)

  return {
    id: `r_${input.day}_${Math.floor(rng() * 1e9).toString(36)}`,
    animalId: input.animalId,
    animalName: input.animalName,
    text: template.replaceAll('%', input.animalName),
    sentiment,
    day: input.day,
  }
}

/**
 * 칭찬과 불평의 균형. -1 이면 전부 불평, 1 이면 전부 칭찬.
 * 한마디도 없으면 0 이다 — **모른다는 것과 나쁘다는 것은 다르다.**
 */
export function reviewBalance(reviews: readonly Review[]): number {
  if (reviews.length === 0) return 0
  const sum = reviews.reduce((n, r) => n + r.sentiment, 0)
  return sum / reviews.length
}

export function countBySentiment(reviews: readonly Review[]): { good: number; bad: number } {
  let good = 0
  let bad = 0
  for (const review of reviews) {
    if (review.sentiment === 1) good++
    else bad++
  }
  return { good, bad }
}

/** 이 동물이 받은 평가만. 동물 카드에서 자기 몫을 되짚는 데 쓴다. */
export function reviewsOf(reviews: readonly Review[], animalId: string): Review[] {
  return reviews.filter((r) => r.animalId === animalId)
}
