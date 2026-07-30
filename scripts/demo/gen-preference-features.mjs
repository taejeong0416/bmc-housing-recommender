import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// 취향학습 벡터 = tag/ 파이프라인의 C(입지·교통) + D(생활환경) 원자 특징(고정 거리감쇠, 후보집합 무관).
// 기획안 Final 1.3 §2·§4.1: 개인 선호모델은 C/D 8개 원자 특징만 학습한다. A/B·결합태그는 제외.
const C = resolve('tag/output/c-transport-tags.json')
const D = resolve('tag/output/d-lifestyle-tags.json')
const MANIFEST = resolve('tag/data/external/manifest.json')
const OUTPUT = resolve('frontend/src/generated/preference-features.json')

// preference vector 8축: rail(C) + 카페·운동·마트·외식·문화·조용함·공원(D).
const D_FEATURES = [
  'cafe_choice',
  'fitness_access',
  'supermarket_access',
  'restaurant_choice',
  'culture_access',
  'quiet_residential',
  'park_walk',
]

const [c, d, manifest] = await Promise.all([
  readFile(C, 'utf8').then(JSON.parse),
  readFile(D, 'utf8').then(JSON.parse),
  readFile(MANIFEST, 'utf8')
    .then(JSON.parse)
    .catch(() => ({})),
])

const ev = (source) =>
  source
    ? {
        count: source.countWithinRadius ?? 0,
        nearestMeters: source.nearestMeters ?? null,
        nearestName: source.nearestName ?? null,
      }
    : { count: 0, nearestMeters: null, nearestName: null }

const features = {}
let skipped = 0
for (const [id, dHouse] of Object.entries(d.features)) {
  const cHouse = c.features[id]
  const rail = cHouse?.scores?.rail_access
  // 학습 벡터는 8축이 모두 관측된 후보만(§9.5 결측을 0으로 대체 금지). 미커버는 랭킹에서 하단 처리.
  const observed =
    typeof rail === 'number' &&
    D_FEATURES.every((f) => typeof dHouse.scores?.[f] === 'number')
  if (!observed) {
    skipped++
    continue
  }

  const values = { rail_access: rail }
  const evidence = { rail_access: ev(cHouse.evidence?.rail) }
  for (const f of D_FEATURES) {
    values[f] = dHouse.scores[f]
    evidence[f] = ev(dHouse.evidence?.[f])
  }
  features[id] = { values, evidence }
}

const output = {
  meta: {
    source: 'tag/ 파이프라인 — 선도소프트 GIS(C·D) + 부산 공개 철도·공원 외부데이터',
    externalManifestVersion: manifest.version ?? null,
    generatedFrom: [c.metadata?.category, d.metadata?.category].filter(Boolean),
    candidates: Object.keys(features).length,
    normalization: '고정 거리감쇠 score = 1 − exp(−Σ 0.85^i/(1+d/d₀) / 포화계수) — 후보 집합과 무관, 부산 전체 확장에 안정',
  },
  features,
}

await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)
console.log(
  `[preference] tag C·D → 8피처 ${Object.keys(features).length}개 후보(미관측 ${skipped} 제외) → ${OUTPUT}`,
)
