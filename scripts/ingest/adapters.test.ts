import { describe, expect, it } from 'vitest'
import { adapters } from './adapters'
import { Complex, Pricing, Unit } from './canonical'
import { readCsv } from './util'

const SRC = 'data/source'

const UNIT_CASES = [
  { file: '매입임대 주택정보(샘플)_수영구.csv', adapter: 'maeip-units' },
  {
    file: '행복, 통합, 재개발 주택정보(샘플)_수영구, 기장군.csv',
    adapter: 'typed-units',
  },
] as const

const PRICING_CASES = [
  { file: '매입임대 보증금_임대료(샘플)_수영구.csv', adapter: 'maeip-pricing' },
  {
    file: '재개발임대 보증금_임대료(샘플)_수영구.csv',
    adapter: 'redev-pricing',
  },
  {
    file: '통합공공임대 보증금_임대료(샘플)_기장군.csv',
    adapter: 'tonghap-pricing',
  },
  {
    file: '행복주택 표준보증금 및 임대료(샘플)_기장군.csv',
    adapter: 'haengbok-pricing',
  },
] as const

describe('전 행 손실 없이 매핑 (입력 = 산출 + 스킵)', () => {
  for (const { file, adapter } of UNIT_CASES) {
    it(`${adapter}: 입력 = 호 + 스킵`, () => {
      const rows = readCsv(`${SRC}/${file}`)
      const res = adapters[adapter](rows)
      expect((res.units?.length ?? 0) + res.skipped.length).toBe(rows.length)
      expect(rows.length).toBeGreaterThan(0)
    })
  }
  for (const { file, adapter } of PRICING_CASES) {
    it(`${adapter}: 입력 = 가격 + 스킵`, () => {
      const rows = readCsv(`${SRC}/${file}`)
      const res = adapters[adapter](rows)
      expect((res.pricing?.length ?? 0) + res.skipped.length).toBe(rows.length)
      expect(rows.length).toBeGreaterThan(0)
    })
  }
})

describe('canonical zod 검증 통과', () => {
  for (const { file, adapter } of [...UNIT_CASES, ...PRICING_CASES]) {
    it(`${adapter}: 전 산출물 스키마 유효`, () => {
      const res = adapters[adapter](readCsv(`${SRC}/${file}`))
      for (const c of res.complexes ?? [])
        expect(Complex.safeParse(c).success).toBe(true)
      for (const u of res.units ?? [])
        expect(Unit.safeParse(u).success).toBe(true)
      for (const p of res.pricing ?? [])
        expect(Pricing.safeParse(p).success).toBe(true)
    })
  }
})

describe('정규화 함정 처리', () => {
  it('매입임대: 전용면적 트레일링 공백·사용승인일 YYYYMMDD→ISO', () => {
    const res = adapters['maeip-units'](
      readCsv(`${SRC}/매입임대 주택정보(샘플)_수영구.csv`),
    )
    const u0 = res.units![0]
    expect(u0.areaM2).toBeCloseTo(42.72, 2)
    expect(u0.rooms).toBe(2) // "02" zero-pad
    const c0 = res.complexes!.find((c) => c.id === u0.complexId)!
    expect(c0.builtDate).toBe('1990-07-25')
    expect(c0.address).not.toMatch(/[()]/) // 괄호 접미 제거됨
  })

  it('typed: 세대수·주차대수 천단위 콤마 제거', () => {
    const res = adapters['typed-units'](
      readCsv(`${SRC}/행복, 통합, 재개발 주택정보(샘플)_수영구, 기장군.csv`),
    )
    const tonghap = res.complexes!.find((c) => c.type === '통합공공임대')!
    expect(tonghap.totalUnits).toBe(1134)
    expect(tonghap.parking).toBe(1248)
    expect(tonghap.district).toBe('기장군')
  })

  it('매입임대 가격: 등록일 MM-DD-YYYY→ISO, 금액 원 단위 보존', () => {
    const res = adapters['maeip-pricing'](
      readCsv(`${SRC}/매입임대 보증금_임대료(샘플)_수영구.csv`),
    )
    const p0 = res.pricing![0]
    expect(p0.registeredAt).toBe('2023-10-27')
    expect(p0.deposit).toBe(4610000)
    expect(p0.rent).toBe(39000)
  })

  it('통합 가격: qualifier(소득구간·가구인원수) 흡수', () => {
    const res = adapters['tonghap-pricing'](
      readCsv(`${SRC}/통합공공임대 보증금_임대료(샘플)_기장군.csv`),
    )
    const p0 = res.pricing![0]
    expect(p0.qualifier.incomeBand).toBe('01')
    expect(typeof p0.qualifier.householdSize).toBe('number')
  })
})

describe('불량 행 방어', () => {
  it('빈 금액 셀은 0원이 아니라 스킵 (num("")=NaN)', () => {
    const rows = [
      {
        사업지구: 'X단지',
        주택형: '19',
        공급계층명: '청년',
        표준보증금: '',
        표준임대료: '100,000',
        등록일: '01-01-2026 00:00:00',
      },
      {
        사업지구: 'X단지',
        주택형: '19',
        공급계층명: '청년',
        표준보증금: '  ',
        표준임대료: '100,000',
        등록일: '01-01-2026 00:00:00',
      },
      {
        사업지구: 'X단지',
        주택형: '19',
        공급계층명: '청년',
        표준보증금: '1,000,000',
        표준임대료: '100,000',
        등록일: '01-01-2026 00:00:00',
      },
    ]
    const res = adapters['haengbok-pricing'](rows)
    expect(res.pricing!.length).toBe(1)
    expect(res.skipped.length).toBe(2)
    expect(res.skipped.every((s) => s.reason === '금액 파싱 실패')).toBe(true)
  })
})

describe('가격 → 단지 조인 (complexId 일치)', () => {
  it('매입임대: 가격 주소가 주택정보 단지에 매칭', () => {
    const cids = new Set(
      adapters['maeip-units'](
        readCsv(`${SRC}/매입임대 주택정보(샘플)_수영구.csv`),
      ).complexes!.map((c) => c.id),
    )
    const pricing = adapters['maeip-pricing'](
      readCsv(`${SRC}/매입임대 보증금_임대료(샘플)_수영구.csv`),
    ).pricing!
    const matched = pricing.filter((p) => cids.has(p.complexId)).length
    // 원본 문자열로는 4/36이지만 접미 제거·정규화 후 대부분 매칭
    expect(matched / pricing.length).toBeGreaterThan(0.9)
  })

  it('행복주택: 사업지구가 임대주택명 단지에 매칭', () => {
    const cids = new Set(
      adapters['typed-units'](
        readCsv(`${SRC}/행복, 통합, 재개발 주택정보(샘플)_수영구, 기장군.csv`),
      ).complexes!.map((c) => c.id),
    )
    const pricing = adapters['haengbok-pricing'](
      readCsv(`${SRC}/행복주택 표준보증금 및 임대료(샘플)_기장군.csv`),
    ).pricing!
    expect(pricing.every((p) => cids.has(p.complexId))).toBe(true)
  })
})
