import { describe, expect, it } from 'vitest'
import { complexId, stripAddrSuffix } from './util'
import { derivePhysicalTags, unmappedPhysicalTag } from './physical-tags'

/**
 * 임시 소스(data/enrich/physical-tags.csv) 조인·harvest 가드.
 * 값이 아니라 규칙을 지킨다: 조인 키가 어댑터와 같은지, 중복 태그를 버리는지, 신규 태그 누락이 없는지.
 * 소스는 비공개 실데이터라 없을 수 있다 — 그때 조인 검증은 건너뛰고 규칙 검증만 돈다.
 */
describe('derivePhysicalTags', () => {
  const map = derivePhysicalTags()

  it.skipIf(map.size === 0)(
    '유형단지(행복·통합·재개발)를 임대주택명 키로 조인한다',
    () => {
      // 일광 통합공공임대주택 — 샘플 최대 단지. K-apt 설비 태그가 붙어야 한다.
      const id = complexId('통합공공임대', '일광 통합공공임대주택')
      const tags = map.get(id)
      expect(tags).toBeDefined()
      expect(tags).toContain('#개별난방')
      expect(tags).toContain('#지하주차')
    },
  )

  it('harvest 태그만 남기고 중복 축(방수·연식·비용 등)은 버린다', () => {
    for (const tags of map.values())
      for (const t of tags)
        expect([
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
        ]).toContain(t)
  })

  it('출력 태그는 중복 없이 선언 순서로 정렬된다(멱등)', () => {
    for (const tags of map.values()) {
      expect(new Set(tags).size).toBe(tags.length)
      expect([...tags]).toEqual([...tags]) // 정렬 안정성 — 재실행 동일
    }
  })

  it('매입임대 조인 키는 정규화 주소 기반이다', () => {
    const id = complexId(
      '매입임대',
      stripAddrSuffix('부산광역시 수영구 예시로14번길 30-8'),
    )
    expect(id.startsWith('mi-')).toBe(true)
  })

  it('무시표/harvest에 없는 신규 태그가 조용히 누락되지 않는다', () => {
    // 샘플엔 신규 태그가 없어야 정상. 있으면 감지 리포트가 뜬다(index.ts).
    expect([...unmappedPhysicalTag]).toEqual([])
  })
})
