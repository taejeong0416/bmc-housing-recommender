import { Prisma, PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// data/out/gis.json(선도소프트 인제스천 산출, M1) → PostGIS 적재. 재실행 멱등(삭제 후 재삽입).
// geom은 Unsupported라 raw SQL(ST_MakePoint / ST_GeomFromText)로 채운다.
for (const p of ['backend/.env', '.env']) {
  try {
    process.loadEnvFile(p)
    break
  } catch {
    /* 다음 후보 */
  }
}

const prisma = new PrismaClient()

type LngLat = [number, number]
interface Gis {
  pois: {
    tag: string
    category: string
    name: string | null
    lng: number
    lat: number
  }[]
  densityGrids: {
    gridId: string
    pop: number
    d: {
      csv: number
      coffee: number
      kfood: number
      pharm: number
      salon: number
    }
    ring: LngLat[]
  }[]
  zoneGrids: {
    gridId: string
    zoneCode: string
    zoneType: string
    hasCommerce: boolean
    ring: LngLat[]
  }[]
}

// 링을 닫힌 WKT POLYGON으로. shpjs 링은 대개 닫혀 있으나 안전하게 첫점=끝점 보장.
function wktPolygon(ring: LngLat[]): string {
  const r =
    ring.length && ring[0].join() !== ring[ring.length - 1].join()
      ? [...ring, ring[0]]
      : ring
  return `POLYGON((${r.map(([x, y]) => `${x} ${y}`).join(',')}))`
}

// 파라미터 폭주(PG 65535) 방지 청크 삽입.
async function insertChunked(rows: Prisma.Sql[], head: Prisma.Sql, size = 800) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    await prisma.$executeRaw(Prisma.sql`${head} VALUES ${Prisma.join(chunk)}`)
  }
}

async function main() {
  const gis: Gis = JSON.parse(
    readFileSync(join(__dirname, '../../data/out/gis.json'), 'utf8'),
  )

  await prisma.$executeRawUnsafe(
    'TRUNCATE commerce_pois, industry_density, commercial_zones RESTART IDENTITY',
  )

  await insertChunked(
    gis.pois.map(
      (p) =>
        Prisma.sql`(${p.tag}, ${p.category}, ${p.name}, ${'sundo-buld'}, ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326))`,
    ),
    Prisma.sql`INSERT INTO commerce_pois (tag, category, name, source, geom)`,
  )

  await insertChunked(
    gis.densityGrids.map(
      (g) =>
        Prisma.sql`(${g.gridId}, ${g.pop}, ${g.d.csv}, ${g.d.coffee}, ${g.d.kfood}, ${g.d.pharm}, ${g.d.salon}, ST_GeomFromText(${wktPolygon(g.ring)}, 4326))`,
    ),
    Prisma.sql`INSERT INTO industry_density (grid_id, pop, d_csv, d_coffee, d_kfood, d_pharm, d_salon, geom)`,
  )

  await insertChunked(
    gis.zoneGrids.map(
      (g) =>
        Prisma.sql`(${g.gridId}, ${g.zoneCode}, ${g.zoneType}, ${g.hasCommerce}, ST_GeomFromText(${wktPolygon(g.ring)}, 4326))`,
    ),
    Prisma.sql`INSERT INTO commercial_zones (grid_id, zone_code, zone_type, has_commerce, geom)`,
  )

  // GiST 공간 인덱스(P2-B-4) — ST_DWithin/ST_Contains 성능.
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS commerce_pois_geom_gist ON commerce_pois USING GIST (geom)',
  )
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS industry_density_geom_gist ON industry_density USING GIST (geom)',
  )
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS commercial_zones_geom_gist ON commercial_zones USING GIST (geom)',
  )

  const [poi, dens, zone] = await Promise.all([
    prisma.commercePoi.count(),
    prisma.industryDensity.count(),
    prisma.commercialZone.count(),
  ])
  console.log(
    `[seed:gis] POI ${poi} · 밀집도격자 ${dens} · 용도지역격자 ${zone}`,
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('[seed:gis] 실패:', e)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
