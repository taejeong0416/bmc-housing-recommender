import listingTagsRaw from '../generated/listing-tags.json'

// 설명 전용 배지(대학가 생활권)와 선택형 의료축 점수를 후보 id로 조회한다.
// tag/ 파이프라인 산출(listing-tags.json)이 단일 원천 — 추천 8축 학습과는 분리.
export interface UniversityBadge {
  campusName: string | null
  meters: number | null
}

interface ListingTag {
  universityCommercialArea: UniversityBadge | null
  medicalDaily: number | null
}

const listings = (
  listingTagsRaw as unknown as { listings: Record<string, ListingTag> }
).listings

/** 대학가 생활권 배지(설명 전용). 미부여면 null. */
export function universityBadge(id: string): UniversityBadge | null {
  return listings[id]?.universityCommercialArea ?? null
}

/** 일상 의료 접근 점수(0~1). 선택형 의료축 랭킹 보정에만 사용. 없으면 null. */
export function medicalDailyScore(id: string): number | null {
  return listings[id]?.medicalDaily ?? null
}
