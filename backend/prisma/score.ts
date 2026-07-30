import { Prisma, PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 태그별 접근성 점수 사전계산 → complex_tag_scores (M2, RECOMMENDER §2).
 * 공간 파트(거리감쇠 누적합 + δ depth-of-choice)는 PostGIS, 퍼센타일·quiet 역가중은 JS.
 * 실행: npm run db:score  (선도소프트 적재 후)
 */
for (const p of ['backend/.env', '.env']) {
  try {
    process.loadEnvFile(p)
    break
  } catch {
    /* 다음 후보 */
  }
}

const prisma = new PrismaClient()

interface Cfg {
  delta: number
  coverageRadiusM: number
  tags: Record<string, { radiusM: number; d0: number }>
}
const cfg: Cfg = JSON.parse(
  readFileSync(join(__dirname, '../src/recommend/scoring.config.json'), 'utf8'),
)

interface Raw {
  complexId: string
  poiCount: number
  nearestM: number | null
  raw: number
}

// 태그별: 반경 내 POI를 거리감쇠×δ(선택깊이)로 누적. RECOMMENDER §2.2.
async function tagRaw(
  tag: string,
  radiusM: number,
  d0: number,
): Promise<Raw[]> {
  return prisma.$queryRaw<Raw[]>(Prisma.sql`
    WITH d AS (
      SELECT c.id AS complex_id,
             ST_Distance(c.geom::geography, p.geom::geography) AS dist,
             ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY ST_Distance(c.geom::geography, p.geom::geography)) AS k
      FROM complexes c
      JOIN commerce_pois p ON p.tag = ${tag}
        AND ST_DWithin(c.geom::geography, p.geom::geography, ${radiusM})
      WHERE c.geom IS NOT NULL
    )
    SELECT complex_id AS "complexId",
           count(*)::int AS "poiCount",
           min(dist)::float8 AS "nearestM",
           sum(power(${cfg.delta}::float8, (k-1)::int) * (1.0/(1.0 + dist/${d0}::float8)))::float8 AS raw
    FROM d GROUP BY complex_id`)
}

// 커버리지: POI 반경 내에 드는 단지만 상권 스코어링 대상(미커버 구 = 점수 null). §2.4.
async function coveredIds(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ complexId: string }[]>(Prisma.sql`
    SELECT DISTINCT c.id AS "complexId" FROM complexes c
    JOIN commerce_pois p ON ST_DWithin(c.geom::geography, p.geom::geography, ${cfg.coverageRadiusM})
    WHERE c.geom IS NOT NULL`)
  return new Set(rows.map((r) => r.complexId))
}

// 퍼센타일(midrank, 0~100). 0-편중 보정: raw=0 → 0, 양수만 rank. §2.3.
function percentiles(raws: number[]): (v: number) => number {
  const pos = raws.filter((v) => v > 0).sort((a, b) => a - b)
  const n = pos.length
  return (v: number) => {
    if (v <= 0 || n === 0) return 0
    let less = 0
    let eq = 0
    for (const x of pos) {
      if (x < v) less++
      else if (x === v) eq++
    }
    return ((less + 0.5 * eq) / n) * 100
  }
}

async function main() {
  const covered = await coveredIds()
  const rows: Prisma.ComplexTagScoreCreateManyInput[] = []

  for (const [tag, { radiusM, d0 }] of Object.entries(cfg.tags)) {
    const raw = await tagRaw(tag, radiusM, d0)
    const byId = new Map(raw.map((r) => [r.complexId, r]))
    // 모집단 = 커버 단지 전체(POI 없으면 raw 0). 퍼센타일은 양수만.
    const pct = percentiles([...covered].map((id) => byId.get(id)?.raw ?? 0))
    const isQuiet = tag === 'nightlife'

    for (const id of covered) {
      const r = byId.get(id)
      const rawVal = r?.raw ?? 0
      const p = pct(rawVal)
      rows.push({
        complexId: id,
        tag: isQuiet ? 'quiet' : tag, // nightlife → quiet(역가중)
        poiCount: r?.poiCount ?? 0,
        nearestM: r?.nearestM ?? null,
        raw: rawVal,
        percentile: isQuiet ? 100 - p : p, // 유흥 적을수록 조용함↑
      })
    }
  }

  await prisma.complexTagScore.deleteMany()
  await prisma.complexTagScore.createMany({ data: rows })

  const byTag = new Map<string, number>()
  for (const r of rows) byTag.set(r.tag, (byTag.get(r.tag) ?? 0) + 1)
  console.log(`[score] 커버 단지 ${covered.size} · 점수행 ${rows.length}`)
  console.log(
    '[score] 태그별 행:',
    [...byTag.entries()].map(([t, n]) => `${t} ${n}`).join(' · '),
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('[score] 실패:', e)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
