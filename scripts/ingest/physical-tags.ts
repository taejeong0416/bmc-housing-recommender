import { existsSync, readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { complexId, stripAddrSuffix, TYPE_MAP } from './util'

/**
 * B. 주거물리 태그 부착 — 배지·선택적 하드필터용(대분류 B).
 *
 * 팀 B분야(주거물리) 태깅 산출물을 우리 canonical 단지에 조인해 신규 신호만 흡수한다.
 * 원칙: 우리 canonical 필드로 이미 있는 축(방수·면적·연식·승강기·주차·비용·세대규모)은
 * 버리고, K-apt 등 우리가 아직 인제스트하지 않는 소스가 여는 태그만 harvest한다.
 * 세부 근거·조인 규칙은 docs/PHYSICAL_TAGS.md.
 *
 * 조인: B 산출 CSV는 세대(호) 단위. 유형·키를 우리 어댑터와 동일하게 재구성해 complexId로 묶는다.
 *   - 유형단지(행복·통합·재개발) = complexId(type, 임대주택명)
 *   - 매입임대 = complexId('매입임대', 정규화주소)
 * harvest 태그는 K-apt 단지 속성이라 한 단지의 세대에 균일 → 단지별 합집합이 곧 단지 태그.
 */

// 임시 소스: B 태깅 산출 CSV(UTF-8) 스냅샷. raw K-apt·공고문 도착 시 어댑터로 대체(같은 필드 채움).
const SOURCE = 'data/enrich/physical-tags.csv'

// harvest 대상 — 신규 소스(K-apt)가 여는 단지 속성만. 선언 순서가 곧 출력 순서(멱등).
const HARVEST = [
  '#개별난방',
  '#지역난방',
  '#중앙난방',
  '#계단식',
  '#복도식',
  '#지하주차',
  '#전기차충전',
  '#CCTV많음',
  '#어린이놀이터',
  '#노인정',
  '#작은도서관',
  '#운동시설',
] as const
const HARVEST_ORDER = new Map(HARVEST.map((t, i) => [t as string, i]))

// 의도적으로 흡수하지 않는 태그 — 여기 있으면 신규 감지 경고를 내지 않는다.
//   (1) 우리 canonical 필드로 이미 있는 순수 중복
//   (2) 다른 입도(주택형·세대)라 단지 배지로 미루는 항목 → docs/PHYSICAL_TAGS.md의 후속
const IGNORED = new Set<string>([
  // (1) 순수 중복 — 방수·면적·세대규모·연식·승강기·층·주차·비용
  '#원룸',
  '#투룸',
  '#쓰리룸이상',
  '#컴팩트',
  '#여유면적',
  '#대단지',
  '#소규모단지',
  '#신축5년이내',
  '#준신축',
  '#구축',
  '#엘리베이터',
  '#엘베없음',
  '#고층',
  '#저층',
  '#1층',
  '#주차여유',
  '#주차부족',
  '#보증금100만',
  '#보증금500이하',
  '#보증금1천이하',
  '#보증금3천이하',
  '#월세10만이하',
  '#월세15만이하',
  '#월세20만이하',
  // (2) 후속(입도·소스 확대) — 건물형태·공고문 옵션·발코니
  '#오피스텔',
  '#아파트',
  '#다세대·빌라',
  '#주상복합',
  '#풀옵션',
  '#부분옵션',
  '#옵션없음',
  '#에어컨제공',
  '#가스쿡탑제공',
  '#세탁기제공',
  '#냉장고제공',
  '#발코니있음',
])

// 실데이터 대비: harvest·무시표 어디에도 없는 신규 태그를 수집(공고문 확대 시 등장 가능).
// 조용히 드롭되지 않도록 인제스트 종료 시 리포트(index.ts). A 태그의 unmappedSupplyClass와 동일 패턴.
export const unmappedPhysicalTag = new Set<string>()
export function resetUnmappedPhysicalTag(): void {
  unmappedPhysicalTag.clear()
}

/** B CSV 한 행 → 우리 complexId(어댑터와 동일 키 규칙). 알 수 없는 유형이면 null. */
function rowComplexId(row: Record<string, string>): string | null {
  const type = TYPE_MAP[(row['임대주택유형'] ?? '').trim()]
  if (!type) return null
  const key =
    type === '매입임대'
      ? stripAddrSuffix(row['주소'] ?? '')
      : (row['임대주택명'] ?? '').trim()
  if (!key) return null
  return complexId(type, key)
}

/**
 * 임시 소스(B CSV)에서 단지별 주거물리 태그 맵을 만든다. 소스 부재 시 빈 맵(부분 데이터로도 동작).
 * harvest 아닌 태그 중 무시표에도 없는 건 unmappedPhysicalTag로 수집한다.
 */
export function derivePhysicalTags(): Map<string, string[]> {
  const byComplex = new Map<string, Set<string>>()
  if (!existsSync(SOURCE)) return new Map()

  const rows = parse(readFileSync(SOURCE), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Record<string, string>[]

  for (const row of rows) {
    const id = rowComplexId(row)
    for (const tag of (row['태그'] ?? '').split(/\s+/)) {
      if (!tag) continue
      if (!HARVEST_ORDER.has(tag)) {
        if (!IGNORED.has(tag)) unmappedPhysicalTag.add(tag) // 신규 감지
        continue
      }
      if (!id) continue
      let set = byComplex.get(id)
      if (!set) byComplex.set(id, (set = new Set()))
      set.add(tag)
    }
  }

  const out = new Map<string, string[]>()
  for (const [id, set] of byComplex) {
    out.set(
      id,
      [...set].sort((a, b) => HARVEST_ORDER.get(a)! - HARVEST_ORDER.get(b)!),
    )
  }
  return out
}
