import type { Adapter } from '../canonical'
import { maeipUnits } from './maeip-units'
import { typedUnits } from './typed-units'
import { maeipPricing } from './maeip-pricing'
import { haengbokPricing } from './haengbok-pricing'
import { tonghapPricing } from './tonghap-pricing'
import { redevPricing } from './redev-pricing'

/** manifest의 adapter 키 → 어댑터 함수. */
export const adapters: Record<string, Adapter> = {
  'maeip-units': maeipUnits,
  'typed-units': typedUnits,
  'maeip-pricing': maeipPricing,
  'haengbok-pricing': haengbokPricing,
  'tonghap-pricing': tonghapPricing,
  'redev-pricing': redevPricing,
}
