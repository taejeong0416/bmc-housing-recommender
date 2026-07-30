import type { GeneratedHousing } from '../types'

// 추천 상위 개수 — 홈 탭 스와이프와 지도 강조 핀이 같은 집합을 공유한다(단일 원천).
export const TOP_PICK_COUNT = 10

// 취향순: 생활환경 점수가 매겨진 후보(engine)를 미커버(placeholder) 위로, 그 안에서 점수 내림차순.
const coveredRank = (h: GeneratedHousing) =>
  h.scoreSource === 'engine' ? 1 : 0

// 추천점수 상위 N개 — 지도 빠른필터·정렬과 무관하게 항상 점수 기준으로 뽑는다(홈·강조 공용).
export function topPicks(
  items: GeneratedHousing[],
  n: number = TOP_PICK_COUNT,
): GeneratedHousing[] {
  return [...items]
    .sort(
      (a, b) =>
        coveredRank(b) - coveredRank(a) || (b.score ?? 0) - (a.score ?? 0),
    )
    .slice(0, n)
}
