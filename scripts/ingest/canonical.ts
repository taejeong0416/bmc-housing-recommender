// canonical 스키마·어댑터 계약의 단일 원천은 @bmc/shared-types (P1-B-2 승격).
// 어댑터들의 기존 import 경로(../canonical)를 유지하기 위한 재수출.
export { Complex, HousingType, Pricing, Unit } from '@bmc/shared-types'
export type { Adapter, AdapterResult } from '@bmc/shared-types'
