// 상가-건물 GIS 업종분류(CMSC) → 생활환경 태그 매핑. 코드값 기준(DBF 텍스트 인코딩 비의존).
// 근거·코드 실측: DATA_SCHEMA §6.3. 한 POI가 복수 태그에 대응 가능(예: 서점 → shop + culture).
// 'nightlife'는 quiet 역가중용 내부 태그(RECOMMENDER §2.3) — 앱 태그 아님.

export interface CmscCodes {
  lCd: string // 대분류 (D=소매 Q=음식 F=생활 R=학문 L=부동산 N=관광여가 O=숙박 P=스포츠)
  mCd: string // 중분류 (Q12 등)
  sCd: string // 소분류 (D03A01 등)
  sName?: string
}

// 2024 데이터는 소상공인시장진흥공단 신분류(G2/I2/R1/S2)를 쓴다.
// 구분류 코드는 과거연도 재현을 위해 함께 유지한다.
const CULTURE_M = new Set(['N03', 'D13', 'R05', 'R10', 'R101'])
const CULTURE_S = new Set(['G21301']) // 서점
const NIGHTLIFE_M = new Set(['N02', 'Q09', 'N01', 'I211'])
const NIGHTLIFE_S = new Set(['R10406', 'R10407', 'R10310']) // PC방·노래방·당구장
const SUPERMARKET_S = new Set(['D03A02', 'D03B10', 'G20404'])
const MARKET_COMPLEX_S = new Set(['D03B04']) // 신분류에는 시장·종합상가 직접 코드가 없음
const LAUNDRY_S = new Set(['F02A01', 'S20901', 'S20902'])
const FITNESS_S = new Set([
  'R10306',
  'R10307',
  'R10308',
  'R10309',
  'R10311',
  'R10312',
  'R10313',
  'R10314',
  'R10316',
])

/** POI가 대응하는 태그 목록(0~n개). 'nightlife' 포함 가능. */
export function tagsFor({ lCd, mCd, sCd, sName = '' }: CmscCodes): string[] {
  const tags: string[] = []
  if (mCd === 'Q12' || mCd === 'I212') tags.push('cafe')
  if (sCd === 'D03A01' || sCd === 'G20405') tags.push('cvs')
  if (SUPERMARKET_S.has(sCd)) tags.push('supermarket')
  if (MARKET_COMPLEX_S.has(sCd)) tags.push('market_complex')
  if (LAUNDRY_S.has(sCd)) tags.push('laundry')
  if (
    (lCd === 'Q' || lCd === 'I2') &&
    !['Q12', 'I212'].includes(mCd) &&
    !NIGHTLIFE_M.has(mCd)
  )
    tags.push('restaurant') // 카페·유흥을 제외한 음식점
  if (lCd === 'P' || FITNESS_S.has(sCd)) tags.push('gym')
  if (lCd === 'D' || lCd === 'G2') tags.push('shop')
  if (CULTURE_M.has(mCd) || CULTURE_S.has(sCd)) tags.push('culture')
  if (NIGHTLIFE_M.has(mCd) || NIGHTLIFE_S.has(sCd)) tags.push('nightlife')
  if (sCd === 'G21501' || sName.includes('약국')) tags.push('pharmacy')
  return tags
}

// 상권·용도지역 UCODE → 한글 라벨(CP949 DBF 텍스트 대신 코드로 안전 매핑, DATA_SCHEMA §6.2).
export const ZONE_LABEL: Record<string, string> = {
  UQA01X: '미지정',
  UQA121: '제1종일반주거지역',
  UQA122: '제2종일반주거지역',
  UQA123: '제3종일반주거지역',
  UQA130: '준주거지역',
  UQA210: '중심상업지역',
  UQA220: '일반상업지역',
  UQA230: '근린상업지역',
  UQA240: '유통상업지역',
  UQA310: '전용공업지역',
  UQA320: '일반공업지역',
  UQA330: '준공업지역',
  UQA410: '보전녹지지역',
  UQA420: '생산녹지지역',
  UQA430: '자연녹지지역',
}
