// 데모용 합성 목데이터 생성기 — 필터/지도 시뮬을 보기 쉽게 부산 전역 매물을 부풀린다.
// 임시 데이터다. 실데이터는 `npm run ingest`(P0)가 housings.json을 덮어쓰며 대체한다.
// 재실행 가능: 기존 실 샘플(비-demo id)은 보존하고 `demo-*`만 새로 생성해 교체한다.
// 실행: node scripts/demo/gen-demo-housings.mjs  (또는 npm run gen:demo)
// 합성 픽스처(공개 저장소 기본 데이터) 생성은 buildDemoHousings를 재사용한다.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../frontend/src/generated/housings.json',
)
const COUNT = 280

// 부산 자치구·군 중심 좌표(대략) + 동 풀.
const DISTRICTS = [
  { d: '수영구', lat: 35.1455, lng: 129.113, dongs: ['광안동', '민락동', '남천동', '망미동'] },
  { d: '해운대구', lat: 35.1631, lng: 129.1637, dongs: ['우동', '좌동', '중동', '재송동', '반여동'] },
  { d: '연제구', lat: 35.1762, lng: 129.0797, dongs: ['연산동', '거제동'] },
  { d: '부산진구', lat: 35.1626, lng: 129.0531, dongs: ['부전동', '전포동', '양정동', '당감동', '개금동'] },
  { d: '동래구', lat: 35.2049, lng: 129.0838, dongs: ['온천동', '사직동', '안락동', '명륜동'] },
  { d: '남구', lat: 35.1365, lng: 129.0842, dongs: ['대연동', '용호동', '문현동', '감만동'] },
  { d: '금정구', lat: 35.2429, lng: 129.0921, dongs: ['장전동', '부곡동', '구서동', '금사동'] },
  { d: '사하구', lat: 35.1046, lng: 128.9747, dongs: ['하단동', '괴정동', '당리동', '신평동'] },
  { d: '북구', lat: 35.1974, lng: 128.9902, dongs: ['화명동', '덕천동', '만덕동', '구포동'] },
  { d: '사상구', lat: 35.1524, lng: 128.991, dongs: ['주례동', '감전동', '모라동', '덕포동'] },
  { d: '기장군', lat: 35.2445, lng: 129.2222, dongs: ['정관읍', '일광읍', '기장읍', '장안읍'] },
  { d: '동구', lat: 35.1293, lng: 129.0453, dongs: ['초량동', '수정동', '범일동'] },
]
// 매입임대를 흔하게, 나머지 유형을 고루(HousingType 4종만 유효).
const TYPES = ['매입임대', '매입임대', '매입임대', '행복주택', '통합공공임대', '재개발임대', '행복주택', '통합공공임대']
const BRAND = ['그린빌', '뜨란채', '행복채', '푸르지오', '한신', '아너스', '센트럴', '더샵', 'e편한세상', '아이파크', '스위첸', '하늘채']
const TAG_IDS = ['cafe', 'gym', 'cvs', 'culture', 'quiet', 'shop', 'transit', 'park']

// 시드 고정 RNG(mulberry32) — 재실행 시 동일 산출물(깨끗한 diff).
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 합성 매물 배열. 같은 count면 항상 같은 결과(시드 고정). */
export function buildDemoHousings(count = COUNT) {
  const rnd = mulberry32(20260710)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
  const jitter = (v, amt) => +(v + (rnd() - 0.5) * 2 * amt).toFixed(6)

  const demo = []
  for (let i = 0; i < count; i++) {
    const g = pick(DISTRICTS)
    const dong = pick(g.dongs)
    const roomsMin = int(1, 3)
    const roomsMax = Math.min(4, roomsMin + int(0, 1))
    const areaMin = int(16, 45)
    const areaMax = areaMin + int(6, 40)
    const depMin = int(100, 3200) * 10000 // 100만~3,200만원
    const depMax = depMin + int(0, 1500) * 10000
    const rentMin = int(4, 42) * 10000 // 4만~42만원
    const rentMax = rentMin + int(0, 15) * 10000
    const units = int(24, 760)
    demo.push({
      id: `demo-${String(i + 1).padStart(3, '0')}`,
      name: `${dong.replace(/[동읍면]$/, '')} ${pick(BRAND)}`,
      type: pick(TYPES),
      address: `부산 ${g.d} ${dong}`,
      district: g.d,
      dong,
      lat: jitter(g.lat, 0.012),
      lng: jitter(g.lng, 0.012),
      builtDate: `${int(2004, 2024)}-0${int(1, 9)}-15`,
      totalUnits: units,
      elevator: rnd() > 0.25,
      parking: Math.round(units * (0.4 + rnd() * 0.6)),
      area: { min: areaMin, max: areaMax },
      rooms: { min: roomsMin, max: roomsMax },
      deposit: { min: depMin, max: depMax },
      rent: { min: rentMin, max: rentMax },
      pricingRows: [
        { unitType: `전용 ${areaMin}A`, qualifier: '표준', deposit: depMin, rent: rentMin },
        { unitType: `전용 ${areaMax}B`, qualifier: '표준', deposit: depMax, rent: rentMax },
      ],
      score: int(70, 96),
      tagScores: Object.fromEntries(TAG_IDS.map((t) => [t, null])),
      highlight: null,
      scoreSource: 'placeholder',
    })
  }
  return demo
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const demo = buildDemoHousings()
  const existing = JSON.parse(readFileSync(FILE, 'utf-8'))
  const real = existing.filter((h) => !String(h.id).startsWith('demo-'))
  const merged = [...real, ...demo]
  writeFileSync(FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
  console.log(`real ${real.length} + demo ${demo.length} = ${merged.length} → ${FILE}`)
}
