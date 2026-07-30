import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import iconv from 'iconv-lite'
import { parse } from 'csv-parse/sync'
import type { HousingType } from './canonical'

/** 헤더 단위 접미 제거: `전용면적(제곱미터)`→`전용면적`, `표준보증금(원)`→`표준보증금`, `가구인원수(명)`→`가구인원수`. */
export function stripUnitSuffix(h: string): string {
  return h.replace(/\([^)]*\)\s*$/, '').trim()
}

/**
 * 원천 CSV를 컬럼 객체 배열로 로드. 실데이터는 파일별 인코딩이 섞여(UTF-8-sig / CP949)
 * BOM 유무로 자동 판별하고, 헤더의 단위 접미(`(제곱미터)`·`(원)`·`(명)`)를 벗겨 컬럼명을 통일한다.
 */
export function readCsv(path: string): Record<string, string>[] {
  const buf = readFileSync(path)
  const hasUtf8Bom =
    buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
  const text = hasUtf8Bom ? buf.toString('utf8') : iconv.decode(buf, 'cp949')
  return parse(text, {
    bom: true,
    columns: (header: string[]) => header.map(stripUnitSuffix),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  })
}

/** 천단위 콤마·트레일링 공백 제거 후 숫자화. 빈 셀 포함 실패 시 NaN(Number('')===0 함정 차단). */
export function num(s: string | undefined): number {
  if (s == null) return NaN
  const t = s.replace(/,/g, '').trim()
  if (t === '') return NaN
  return Number(t)
}
/** 정수화(zero-pad·콤마 허용). 실패 시 0. */
export function toInt(s: string | undefined): number {
  const n = num(s)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

/** `YYYYMMDD` → ISO `YYYY-MM-DD`. */
export function isoFromYmd(s: string | undefined): string | null {
  const t = (s ?? '').trim()
  if (!/^\d{8}$/.test(t)) return null
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`
}
/** `MM-DD-YYYY HH:mm:ss` → ISO `YYYY-MM-DD`. */
export function isoFromMdy(s: string | undefined): string | null {
  const m = (s ?? '').trim().match(/^(\d{2})-(\d{2})-(\d{4})/)
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null
}

/** 주소 끝 `(동명[,단지명])` 접미 제거 + 공백 정규화 → 조인·지오코딩용 순수 주소. */
export function stripAddrSuffix(addr: string): string {
  return (addr ?? '')
    .replace(/\([^)]*\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}
/** 주소 접미에서 동명·단지명 추출(없으면 빈 문자열). */
export function parseAddrSuffix(addr: string): {
  dong: string
  building: string
} {
  const m = (addr ?? '').match(/\(([^)]*)\)\s*$/)
  if (!m) return { dong: '', building: '' }
  const parts = m[1].split(',').map((s) => s.trim())
  return { dong: parts[0] ?? '', building: parts[1] ?? '' }
}
/** 주소에서 자치구·군 추출. */
export function districtOf(addr: string): string {
  const m = (addr ?? '').match(/([가-힣]+[구군])(?:\s|$)/)
  return m ? m[1] : ''
}
/** 주소에서 법정동·읍·면 추출. */
export function legalDongOf(addr: string): string {
  const m = stripAddrSuffix(addr).match(/([가-힣]+[동읍면])(?:\s|$)/)
  return m ? m[1] : ''
}

const PREFIX: Record<HousingType, string> = {
  매입임대: 'mi',
  행복주택: 'hb',
  통합공공임대: 'th',
  재개발임대: 'rd',
}
/** 결정적 단지 ID. 매입임대=정규화 주소, 유형단지=임대주택명. 유형 접두로 교차 충돌 방지. */
export function complexId(type: HousingType, key: string): string {
  const norm = key.replace(/\s+/g, ' ').trim()
  const hash = createHash('sha1')
    .update(`${type}|${norm}`)
    .digest('hex')
    .slice(0, 8)
  return `${PREFIX[type]}-${hash}`
}

/** 임대주택유형(원천 문자열) → canonical HousingType. */
export const TYPE_MAP: Record<string, HousingType> = {
  매입임대: '매입임대',
  행복주택: '행복주택',
  통합공공임대주택: '통합공공임대',
  재개발임대주택: '재개발임대',
}

let aliasCache: Record<string, string> | null = null
/** 사업지구 명칭 → 임대주택명(complex-aliases.json). 불일치 시 별칭 매핑, 없으면 원값. */
export function resolveAlias(name: string): string {
  if (!aliasCache) {
    try {
      aliasCache = JSON.parse(
        readFileSync('scripts/ingest/complex-aliases.json', 'utf8'),
      )
    } catch {
      aliasCache = {}
    }
  }
  return aliasCache![name] ?? name
}
