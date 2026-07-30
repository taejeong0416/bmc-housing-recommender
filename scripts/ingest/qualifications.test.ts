import { beforeEach, describe, expect, it } from 'vitest'
import type { Complex, HousingType, Pricing } from '@bmc/shared-types'
import {
  deriveQualifications,
  resetUnmappedSupplyClass,
  unmappedSupplyClass,
} from './qualifications'

const complex = (type: HousingType): Complex => ({
  id: 'x',
  type,
  name: 'n',
  address: 'a',
  district: 'd',
  dong: 'dd',
  builtDate: null,
  totalUnits: 0,
  elevator: false,
  parking: 0,
  lat: null,
  lng: null,
})

const price = (supplyClass?: string): Pricing => ({
  complexId: 'x',
  qualifier: { supplyClass },
  deposit: 0,
  rent: 0,
  registeredAt: '',
})

describe('deriveQualifications — A 자격·유형 태그', () => {
  it('유형이 첫 태그로 그대로 들어간다', () => {
    expect(deriveQualifications(complex('재개발임대'), [])).toEqual([
      '재개발임대',
    ])
  })

  it('유형 제도규칙 태그를 붙인다', () => {
    expect(deriveQualifications(complex('통합공공임대'), [])).toEqual([
      '통합공공임대',
      '소득150이하',
      '장기거주30년',
    ])
    expect(deriveQualifications(complex('매입임대'), [])).toContain(
      '청약통장불필요',
    )
  })

  it('콤마로 결합된 공급계층을 토큰별로 매핑한다', () => {
    const q = deriveQualifications(complex('행복주택'), [
      price('신혼부부, 한부모가족'),
    ])
    expect(q).toContain('신혼부부')
    expect(q).toContain('한부모')
  })

  it('미등록 공급계층 토큰은 무시한다', () => {
    expect(
      deriveQualifications(complex('행복주택'), [
        price('센텀2지구 임시거주자'),
      ]),
    ).toEqual(['행복주택'])
  })

  it('여러 행에 걸친 계층 태그를 중복 없이 합친다', () => {
    const q = deriveQualifications(complex('행복주택'), [
      price('청년'),
      price('청년'),
      price('고령자'),
    ])
    expect(q).toEqual(['행복주택', '청년계층', '고령자'])
  })
})

describe('실데이터 대비 — 미매핑 공급계층 감지', () => {
  beforeEach(resetUnmappedSupplyClass)

  it('허용표에 없는 신규 계층은 태그화하지 않고 수집한다', () => {
    const q = deriveQualifications(complex('행복주택'), [price('예비신혼부부')])
    expect(q).toEqual(['행복주택']) // 태그로 안 붙음
    expect(unmappedSupplyClass.has('예비신혼부부')).toBe(true) // 신규로 감지
  })

  it('의도적 무시 계층은 신규로 잡지 않는다', () => {
    deriveQualifications(complex('행복주택'), [price('센텀2지구 임시거주자')])
    expect(unmappedSupplyClass.size).toBe(0)
  })

  it('reset이 수집기를 비운다', () => {
    deriveQualifications(complex('행복주택'), [price('신규계층X')])
    expect(unmappedSupplyClass.size).toBe(1)
    resetUnmappedSupplyClass()
    expect(unmappedSupplyClass.size).toBe(0)
  })
})
