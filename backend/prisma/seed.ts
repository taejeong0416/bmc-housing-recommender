import { PrismaClient } from '@prisma/client'
import type {
  Complex as SharedComplex,
  Pricing as SharedPricing,
  Unit as SharedUnit,
} from '@bmc/shared-types'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// DATABASE_URL 로드 — 루트/백엔드 어느 cwd에서 실행해도 동작.
for (const p of ['backend/.env', '.env']) {
  try {
    process.loadEnvFile(p)
    break
  } catch {
    /* 다음 후보 */
  }
}

// data/out/canonical.json(인제스천 산출, P0-B-3) → DB 적재. 재실행 멱등(전체 삭제 후 재삽입).
const prisma = new PrismaClient()

interface Canonical {
  complexes: SharedComplex[]
  units: SharedUnit[]
  pricing: SharedPricing[]
}

async function main() {
  const data: Canonical = JSON.parse(
    readFileSync(join(__dirname, '../../data/out/canonical.json'), 'utf8'),
  )

  await prisma.housingPricing.deleteMany()
  await prisma.housingUnit.deleteMany()
  await prisma.complex.deleteMany()

  await prisma.complex.createMany({
    data: data.complexes.map((c) => ({
      id: c.id,
      type: c.type,
      name: c.name,
      address: c.address,
      district: c.district,
      dong: c.dong,
      builtDate: c.builtDate ? new Date(c.builtDate) : null,
      totalUnits: c.totalUnits,
      elevator: c.elevator,
      parking: c.parking,
      lat: c.lat,
      lng: c.lng,
    })),
  })

  await prisma.housingUnit.createMany({
    data: data.units.map((u) => ({
      complexId: u.complexId,
      dong: u.dong ?? null,
      ho: u.ho,
      unitType: u.unitType ?? null,
      rooms: u.rooms,
      areaM2: u.areaM2,
    })),
  })

  await prisma.housingPricing.createMany({
    data: data.pricing.map((p) => ({
      complexId: p.complexId,
      unitType: p.unitType ?? null,
      ho: p.ho ?? null,
      supplyClass: p.qualifier?.supplyClass ?? null,
      incomeBand: p.qualifier?.incomeBand ?? null,
      householdSize: p.qualifier?.householdSize ?? null,
      protection: p.qualifier?.protection ?? null,
      deposit: p.deposit,
      rent: p.rent,
      registeredAt: p.registeredAt ? new Date(p.registeredAt) : null,
    })),
  })

  // 공간 컬럼(geom)은 Unsupported → raw SQL로 채움. GiST 공간 인덱스도 생성(P2-B-4).
  const geom = await prisma.$executeRawUnsafe(
    `UPDATE complexes SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE lat IS NOT NULL AND lng IS NOT NULL`,
  )
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS complexes_geom_gist ON complexes USING GIST (geom)`,
  )

  const [c, u, pr] = await Promise.all([
    prisma.complex.count(),
    prisma.housingUnit.count(),
    prisma.housingPricing.count(),
  ])
  console.log(`[seed] 단지 ${c} · 호 ${u} · 가격 ${pr} · geom ${geom}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('[seed] 실패:', e)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
