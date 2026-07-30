# Be:live — 개발 플랜 (해커톤 제출 + 프로덕션 연장)

> 상권·취향 기반 공공임대주택 추천 서비스. **부산도시공사 × ㈜선도소프트 글로벌 데이터 해커톤(2026.07)** 출품작.
> React + Vite UX/UI 프로토타입(프론트 단독, 목데이터)에서 출발해 실서비스 수준으로 구현하는 전체 로드맵을 3-depth(큰 플랜 → 중간 플랜 → 세부 플랜)로 정리한다. 대회 제출물이 그대로 프로덕션 기반으로 연장되는 것을 전제로 한다.
>
> 관련: [`발제사_과제설명.md`](./발제사_과제설명.md)(과제 원문·채점표), [`STACK_DECISION.md`](./STACK_DECISION.md)(인프라 결정), [`HARNESS_DESIGN.md`](./HARNESS_DESIGN.md)(골격 설계).
> 상태 표기: ✅ 완료 · ◐ 부분 완료 · ⬜ 미착수.

---

## 0. 대회 맥락 & 채점 전략

### 0.1 문제 정의 (과제 원문 요약)
- **배경:** 부산 인구 지속 감소(최근 10년 약 24만 명↓)·지역 소멸 위기. 낮은 소득 대비 과도한 주거비 → 외곽 이탈, 공공임대 당첨자 **입주 포기율 약 50%**.
- **문제:** ① 공급자 중심 일방향 정보(면적·보증금 등 정량 조건만) ② 주변 상권·편의시설 인프라 정보 부재 ③ 개인 라이프스타일 기반 지능형 추천 부재.
- **해결:** 시민이 선호하는 **생활 인프라(상권·편의시설·문화공간)와 취향**을 반영한 수요자 맞춤형 공공임대 추천. 산출물은 앱/웹 서비스.
- **공간 범위:** 부산광역시 전역(주택 355단지 + 선도소프트 상권 GIS 부산 전역 편입).

### 0.2 제공 데이터 (2소스)
| 소스 | 데이터 | 형식 | 현재 상태 |
|---|---|---|---|
| **부산도시공사** | 주택정보 2종 + 보증금·임대료 4종(유형별), 참고자료 모집공고 | CSV(CP949), 공고 hwpx/pdf | **부산 전역 실데이터 반영**(355단지·15개 구). 공공데이터포털 등록 예정 |
| **㈜선도소프트** | 상가-건물 융합(상가-건물 GIS), 주요 5대 업종-인구 융합(**총인구 대비 5대 업종 밀집도**), 주요상권·용도지역 융합 | **SHP(공간데이터, 좌표 내장)** | **부산 전역 SHP 3종 반영**(상가-건물 16.1만·밀집도 격자 8.0만·용도지역 격자 2.9만) |

> 핵심: **상권 추천의 근거 데이터는 선도소프트 GIS**다. 우리가 POI를 자체 수집하는 게 아니라 제공된 상권 융합정보를 1차 소스로 쓰고, 외부 공개데이터는 GIS가 안 덮는 축(공원·교통 등)만 보강한다. 주택 CSV엔 좌표가 없어 지오코딩이 필요하지만, **GIS는 좌표가 내장**돼 지오코딩 대상이 아니다.

### 0.3 채점표 (총 100점) → 플랜 매핑
| 평가 항목 | 배점 | 이 플랜에서 대응 |
|---|---|---|
| 문제 정의 | 15 | §0.1 서사 + 발표. "입주 포기율↓·공급자→수요자 전환"을 UI·추천에 관통 |
| **발제사 데이터 활용** | 15 | BMC 주택 CSV = **P0** / 선도소프트 상권 GIS = **P3-A-2·P3-B**. 두 소스를 추천에 실제 반영 |
| 창의성·차별성 | 15 | pairwise 취향학습 + **설명가능성**(결합태그·거리 근거) = **P3-B·P5** |
| **데이터 기반 문제해결** | 20 | 수집→정규화→지리연산→추천 전 과정 = **P0 + P3**. **외부 공개데이터 활용**(지오코딩·공원·교통 = P3-A-2 보강·P3-D-2)이 배점 명시 요건 |
| 서비스 완성도(UI/UX) | 20 | 라우팅·상태·디자인시스템·반응형 = **P1**, 국내 지도 = **P6-A**. 프론트를 미루지 않고 구현 |
| 정책 활용 가능성 | 15 | **canonical 스키마 + 어댑터 교체 설계**(타 기관·전 구 확산) = **P0-A-2·HARNESS §3**, 공공데이터포털 등록 데이터와 정합 |

**전략 요지:** 최대 배점 묶음은 **데이터(활용 15 + 문제해결 20 = 35)** 와 **완성도 20**. 따라서 ① 두 제공 데이터를 실제로 관통시키는 추천 파이프라인과 ② 완성도 있는 UI를 동시에 세운다. 백엔드·추천 엔진은 원래 로드맵대로 구현하고(데이터 서사가 곧 점수), **로그인만 껍데기(가짜 세션)로 두어** 인증 실연동에 시간을 쓰지 않는다(채점 무관 항목).

---

## 1. 목표 아키텍처 & 기술 선택

### 1.1 목표 아키텍처 (To-Be)
```
[React SPA(TS)] ──HTTPS──> [API Gateway / BFF]
   │  TanStack Query          │  (NestJS, REST)
   │  Zustand(UI state)       ├─> Auth (해커톤=가짜 세션 / 이후 Kakao OAuth+JWT)
   │  React Router            ├─> 추천 엔진 (스코어링)
   │  Design System           ├─> LLM 검색 (Gemini API: NL→필터)
   └─ Naver/Kakao Map SDK     └─> 데이터 파이프라인
                                     │
        [PostgreSQL + PostGIS]  [Redis]  [Object Storage]
         주택·상권GIS·POI·사용자  캐시/세션   이미지/문서
                                     ↑
    [배치/ETL]  BMC 주택 CSV·공고  +  선도소프트 상권 GIS(SHP)  +  외부 공개데이터(공원·교통)
```
인프라 스택(자체호스팅 NestJS + PostGIS + Docker)은 [`STACK_DECISION.md`](./STACK_DECISION.md)에서 확정.

### 1.2 기술 선택 확정표

인프라 상위 결정(STACK_DECISION) 아래의 라이브러리 단위 선택. 착수 시 재논의 없이 이 표대로 진행하고, 막히면 이 표를 갱신한다.

| 영역 | 선택 | 근거 (1줄) |
|---|---|---|
| 런타임/모노레포 | Node 20 + **npm workspaces** (`frontend`, `backend`, `packages/shared-types`, `scripts/ingest`) | CI가 Node 20 기준, 도구 추가 없이 타입 공유 |
| 라우팅 | **react-router v7** (library 모드, `createBrowserRouter`) | SPA 유지, 표준 |
| 서버상태 | **TanStack Query v5** | 캐싱·재시도·로딩상태 표준화 |
| UI상태 | **Zustand v5** | 단일 Context 해체 대상 필드가 전부 경량 UI 상태 |
| 목서버 | **MSW v2** | BE 없이 실제 fetch 경로로 개발, 테스트 재사용 |
| 스타일 | **Tailwind CSS v4** (`@theme`에 `theme.ts` 토큰 이관) | 인라인 `css()`를 클래스로 점진 치환하기 가장 빠름 |
| 단위테스트 | **Vitest + React Testing Library** | Vite 네이티브 |
| E2E | **Playwright** | 크로스브라우저·CI 안정성 |
| CSV 파싱 | **csv-parse + iconv-lite**(CP949 디코딩) | 스트리밍·인용부호 처리 검증된 조합 |
| **상권 GIS(SHP) 파싱** | **shpjs**(순수 JS, 인제스천 스크립트) / PostGIS 적재는 `shp2pgsql`·`ogr2ogr` | 선도소프트 데이터는 좌표 내장 → 지오코딩 불필요, 공간조인은 PostGIS |
| 데이터 검증 | **zod** (인제스천 canonical 검증 + BE env 검증 공용) | 스키마 = 타입 단일 원천 |
| 지오코딩 | **VWorld 1차**(무료·좌표 저장 제약 없음) + Kakao 로컬 보조(실패분) — **주택 주소에만 적용** | 저장 약관 리스크 회피 |
| ORM | **Prisma** — 공간 컬럼은 `Unsupported("geometry(...,4326)")` + `$queryRaw` | CRUD·마이그레이션 DX. 공간 연산은 어차피 raw SQL(ST_DWithin) 중심 |
| BE 로깅 | **nestjs-pino** | 구조화 로그 표준 |
| 지도(P6) | **Naver Maps JS API(NCP)** | 국내 POI·주소 체계, 클러스터링 |
| LLM(P5) | **Gemini API**(무료 티어) — 구조화 출력(`responseSchema`/function calling)로 필터 JSON 강제 | 비용 0 + 파싱 실패 모드 제거 |

---

## 2. 로드맵 요약 (마일스톤 순서)

| # | 큰 플랜(Phase) | 목표 | 선행 | 상태 |
|---|---|---|---|---|
| P0 | **데이터 인제스천** | BMC 주택 CSV → 앱 데이터 변환 파이프라인. 실데이터 도착 시 파일 교체만으로 반영 | - | ✅ (부산 전역 실데이터 반영 — 355단지·15개 구, 전 단지 지오코딩·가격 완비) |
| P1 | **프론트엔드 리팩토링** | 라우팅·타입·상태·디자인시스템·테스트 기반 확보 | - | ◐ (라우팅·타입·린트·상태분리(Query+Zustand)·3-상태 UI 완료; 디자인시스템·테스트 잔여) |
| P2 | **백엔드 기반 구축** | API 서버·DB(PostGIS)·인프라 스켈레톤 | P1 병행 가능 | ◐ (스캐폴딩·DB·시드·housings·`/meta` API·compose 완료·**스택 실행검증 통과**; 잔여: 프론트 실연결(P2-E)·운영화(P2-D-2·3)) |
| P3 | **도메인 데이터 & 추천 엔진** | 상권 GIS 적재 + 고정감쇠 스코어링(발제사 데이터 활용의 핵심) | P0, P2 | ◐ (GIS **부산 전역** 적재·`tag/` 고정감쇠·pairwise 8피처 프론트 랭킹 **✅ LIVE**·355후보 8축 전역 관측·옛 퍼센타일 백엔드 제거; P3-D 잔여) |
| P4 | **사용자 도메인** | 관심·조건저장 (가짜 세션·localStorage) | P2 | ✅ |
| P5 | **AI 자연어 검색** | Gemini 기반 NL→필터 검색 | P3 | ◐ (NL→필터·확인 UI·프록시 하드닝·개인화 병합·선제 제안·**AI 파싱→pairwise 8피처 연결**·멀티턴 되묻기 완료; 비용 모니터링 잔여) |
| P6 | **국내 지도 전환** | Naver 지도 + 개수 클러스터·리스트 연동 | P3 | ◐ (Naver 전환·클러스터·리스트 연동 완료; 서버 bbox 조회 잔여) |
| P7 | **CI** | lint·typecheck·test·build 파이프라인 | P1~P6 | ⬜ |

> 권장 순서: **P0 완료 → P1 잔여·P2 실행검증 병행(현 지점) → P3/P4 → P5/P6 → P7 상시.** 해커톤 제출 범위는 §4, 당장의 실행 순서는 §6.

---

## 3. 3-Depth 상세 플랜

표기: **[큰 플랜]** → *중간 플랜* → 세부 플랜 (검증 기준 포함).

---

### P0. 데이터 인제스천 ✅ (부산 전역 실데이터 반영 — 355단지·15개 구)

> 목적: 백엔드(P2) 이전이라도 **실데이터 CSV가 도착하면 파일 교체 + 스크립트 1회 실행으로 앱에 반영**되는 구조를 만든다. 확보된 BMC 주택 샘플 CSV 6종(수영구·기장군)으로 파이프라인을 완성해 두고, 실데이터는 같은 경로로 흘려보낸다. (선도소프트 상권 GIS 적재·스코어링은 P3-A에서 부산 전역으로 완료.)
> 전체 흐름·교체점 정의는 HARNESS_DESIGN §3.

#### P0-Z. 실행 기반 골격 (선행 1커밋)
- P0-Z-1. 루트 `package.json` 신설(npm workspaces: `frontend`, `scripts/ingest` — `backend`/`packages/*`는 생길 때 추가), 루트 스크립트 `"ingest": "tsx scripts/ingest/index.ts"`. 공용 devDeps: `tsx`, `typescript`, `csv-parse`, `iconv-lite`, `zod`.
- P0-Z-2. `data/source/`·`data/cache/` 생성, 샘플 CSV 6종을 `부산도시공사 샘플데이터 및 참고자료(공고)/`에서 `data/source/`로 복사(원본 폴더는 수령 원본 보관용으로 유지). 두 폴더 모두 이미 gitignore 대상.
- P0-Z-3. `.gitignore`에 `.env`, `data/out/` 추가(지오코딩 API 키·DB 시드용 중간 산출물) → **검증:** `npm run ingest`가 (빈 구현이라도) 루트에서 실행됨, `git status`에 원천 파일 미노출.

#### P0-A. 원천 데이터 스키마 확정 (샘플 기준)
- P0-A-1. 샘플 CSV 구조 문서화(`docs/DATA_SCHEMA.md`). 원천 6종과 실측 컬럼:

  | 파일 | 성격 | 컬럼 |
  |---|---|---|
  | `매입임대 주택정보(샘플)_수영구.csv` | 호 단위 주택정보 | 임대주택유형, 주소, 사용승인일, 세대수, 호, 방수, 전용면적, 승강기설치구분, 주차대수 |
  | `행복, 통합, 재개발 주택정보(샘플)_수영구, 기장군.csv` | 호 단위 주택정보 | 임대주택유형, **임대주택명**, 주소, 준공일자, 세대수, **주택형, 동**, 호, 방수, 전용면적, 승강기설치구분, 주차대수 |
  | `매입임대 보증금_임대료(샘플)_수영구.csv` | 가격(호 단위 평균표준가) | 사업지구, 주택명, 주소, 순위, **호명**, 평균표준보증금, 평균표준임대료, 등록일 |
  | `재개발임대 보증금_임대료(샘플)_수영구.csv` | 가격(주택형×보호구분) | 사업지구, 주택형, **보호구분명**, 표준보증금, 표준임대료, 등록일 |
  | `통합공공임대 보증금_임대료(샘플)_기장군.csv` | 가격(주택형×소득구간×가구인원) | 사업지구, 주택형, **소득구간, 가구인원수**, 표준보증금, 표준임대료, 등록일 |
  | `행복주택 표준보증금 및 임대료(샘플)_기장군.csv` | 가격(주택형×공급계층) | 사업지구, 주택형, **공급계층명**, 표준보증금, 표준임대료, 등록일 |

  **표기 규칙·함정(어댑터가 전부 정규화해야 하는 것):**
  - CP949 인코딩. 금액뿐 아니라 **세대수·주차대수에도 천단위 콤마**(`"1,134"`), 전용면적에 트레일링 공백(`"42.72 "`), 방수는 zero-pad(`"02"`).
  - 날짜 포맷 혼재: 주택정보 = `YYYYMMDD`, 가격 등록일 = `MM-DD-YYYY HH:mm:ss` → ISO(`YYYY-MM-DD`)로 통일.
  - 금액 단위는 **원**(예: 평균표준보증금 `4,610,000` = 461만 원). 산출·표시 시 만원 환산은 프론트 포맷터 담당.
  - 매입임대 가격 CSV의 `주택명`은 단지명이 아니라 **동(洞) 수준 명칭**(예: "광안동") — 표시명으로 쓰지 말 것. `순위`는 대부분 `NA`.
  - **조인 키:** 매입임대 = (정규화한 `주소`, `호`≡`호명`) / 행복·통합·재개발 = 주택정보 `임대주택명` ↔ 가격 `사업지구` 문자열 매칭. 명칭 불일치(주택정보 단지명에 사업주체·지구명이 덧붙는 경우) 대비 별칭 매핑 파일 `scripts/ingest/complex-aliases.json` 운영. 행복주택 가격의 주택형(`19`)이 주택정보 주택형(`19A` 등)의 prefix일 수 있음 → prefix 매칭 규칙 정의.
- P0-A-2. 통합 정규 스키마(canonical) 정의 — `packages/shared-types`의 출발점(P0에서는 `scripts/ingest/canonical.ts`로 시작, P1-B에서 패키지로 승격). 이 스키마의 유형 독립성이 **정책 활용 가능성(타 기관·전 구 확산)** 의 근거다:

  ```ts
  type HousingType = '매입임대' | '행복주택' | '통합공공임대' | '재개발임대'

  interface Complex {            // 단지
    id: string                   // slug: 주소(유형단지는 임대주택명) 정규화 해시
    type: HousingType
    name: string                 // 유형단지 = 임대주택명 / 매입임대 = "매입임대 · {도로명주소 축약}"
    address: string; district: string; dong: string
    builtDate: string | null     // 사용승인일·준공일자 → ISO
    totalUnits: number
    elevator: boolean; parking: number
    lat: number | null; lng: number | null   // 지오코딩 결과
  }
  interface Unit {               // 호
    complexId: string
    dong?: string; ho: string
    unitType?: string            // 주택형(매입임대엔 없음)
    rooms: number; areaM2: number
  }
  interface Pricing {            // 조건부 가격 — 유형별 축 차이는 qualifier로 흡수
    complexId: string
    unitType?: string; ho?: string          // 매입임대는 ho 단위
    qualifier: {
      supplyClass?: string       // 공급계층명(행복)
      incomeBand?: string        // 소득구간(통합)
      householdSize?: number     // 가구인원수(통합)
      protection?: string        // 보호구분명(재개발)
    }
    deposit: number; rent: number           // 원
    registeredAt: string
  }
  ```
  zod 스키마로 정의해 파싱 결과를 검증 → **검증:** 어댑터 유닛 테스트에서 샘플 6개 CSV 전 행이 손실 없이 매핑(입력 행수 = canonical 행수 + 사유 있는 스킵 행수).
- P0-A-3. 실데이터 수령 체크리스트(`docs/DATA_SCHEMA.md`에 포함): 샘플 대비 컬럼 일치 여부, 구(區) 커버리지, 갱신 주기·전달 방식(수동 파일 vs API), 단지 식별자 유무 — 포맷이 다르면 해당 어댑터만 교체하고 canonical 이후 단계는 그대로 재사용.

#### P0-B. 변환 파이프라인 (CSV → 앱 데이터)
- P0-B-1. 변환 스크립트 골격(`scripts/ingest/`, tsx 실행):

  ```
  scripts/ingest/
  ├── index.ts              # 엔트리: manifest 순회 → 어댑터 → canonical → 집계 → 지오코딩 → 산출 → 리포트
  ├── manifest.json         # [{ file: "data/source/….csv", adapter: "maeip-units" }, …] ← 실데이터 추가 시 여기만 수정
  ├── adapters/             # 원천 CSV 스키마당 1모듈, 총 6종 (교체점)
  │   ├── maeip-units.ts        ├── maeip-pricing.ts
  │   ├── typed-units.ts        #   행복·통합·재개발 공용 주택정보
  │   ├── haengbok-pricing.ts   ├── tonghap-pricing.ts
  │   └── redev-pricing.ts
  ├── complex-aliases.json  # 임대주택명 ↔ 사업지구 명칭 불일치 매핑
  ├── canonical.ts          # zod 스키마 + 타입 (P0-A-2)
  ├── aggregate.ts          # 호 단위 → 단지 단위 집계
  ├── geocode.ts            # VWorld + data/cache/geocode.json
  └── emit.ts               # housings.json + canonical.json 산출, 실행 리포트
  ```
  어댑터 계약: `(rows: Record<string,string>[]) => { complexes?, units?, pricing?, skipped: {row, reason}[] }`. 공통 유틸로 콤마 제거·날짜 정규화·주소 정규화 함수 분리 → **검증:** `npm run ingest` 실행 리포트(파일별 적재/스킵/오류 건수) 출력, 재실행 멱등(동일 입력 → 동일 산출물 diff 없음).
- P0-B-2. 지오코딩(`geocode.ts`): BMC 주택 원천에 좌표가 없으므로 주소 → 위경도(선도소프트 GIS는 좌표 내장이라 대상 아님). VWorld 주소 API(`.env`의 `VWORLD_API_KEY`, 일 쿼터 유의·순차 호출) → 실패분 Kakao 로컬 API 보조(`KAKAO_REST_KEY`, 좌표는 저장 제약 없음). 결과는 `data/cache/geocode.json`(`{ 정규화주소: {lat, lng, provider} | null }`)에 캐시해 재실행 시 API 호출 생략 → **검증:** 전 단지 좌표 확보, 실패 주소 목록 리포트(실패는 좌표 null로 산출하되 지도에서 제외 처리).
- P0-B-3. 산출물 2종(`emit.ts`):
  - `frontend/src/generated/housings.json` — 앱이 읽는 실데이터. **비커밋**(발제사 데이터 파생물, README §데이터 공개 정책) — 공개 저장소 클론은 `frontend/src/demo/`의 합성 픽스처로 대체된다. 단지 단위 확장 스키마:
    ```ts
    interface GeneratedHousing {
      id: string; name: string; type: HousingType
      address: string; district: string; dong: string
      lat: number | null; lng: number | null
      builtDate: string | null; totalUnits: number
      elevator: boolean; parking: number
      area: { min: number; max: number }        // m²
      rooms: { min: number; max: number }
      deposit: { min: number; max: number }     // 원
      rent: { min: number; max: number }        // 원/월
      pricingRows: { unitType?: string; qualifier: string; deposit: number; rent: number }[]  // 상세 '비용' 탭용
      score: number | null                      // 레거시 — 적합도는 preference-features.json(원자 8피처) 사용
      tagScores: Record<string, number | null>  // 레거시 옛 8키 placeholder
      highlight: string | null                  // 레거시
      scoreSource: 'placeholder' | 'engine'     // 레거시 게이팅(최종 방식엔 없음)
    }
    ```
  - `data/out/canonical.json` — 비커밋. complexes/units/pricing 원본 그대로, P2-B-3 DB 시드 입력.
  `data.ts`가 목데이터 대신 이 JSON을 import해 기존 `Housing`/`HomeMarker` 형태로 변환(만원 포맷팅 포함) — 화면 컴포넌트 무수정 → **검증:** 지도·리스트·상세 화면이 부산 전역 실데이터(355단지)로 렌더.
- P0-B-4. 생활취향 적합도는 `housings.json`이 아니라 `tag/` 파이프라인이 **`frontend/src/generated/preference-features.json`**(원자 8피처, 고정 거리감쇠, GIS 미커버는 `null`)으로 산출 → 프론트 `rankByLearnedPreference`가 소비. `housings.json`은 단지 기본·비용 필드만 담당(위 `score`/`tagScores` 등은 레거시).

#### P0-C. 공고 참고자료 연결
- P0-C-1. 모집공고(hwpx/pdf, `[참고자료]모집공고/`)에서 유형별 자격요건·공급대상·일정을 수동 추출해 `data/notices/*.json`(커밋 대상)으로 정리 — `{ complexId | type, supplyClass, eligibility, schedule, status, sourceFile }`. `emit.ts`가 단지에 병합해 카드 `tag`(모집중/접수예정 등) 실데이터화. BMC 공고 게시판이 갱신 소스, 자동 수집은 P3-A에서 처리.

**P0 커밋 유닛(권장):** ① 골격(P0-Z) ② DATA_SCHEMA.md(P0-A-1·3) ③ 어댑터+canonical+테스트 ④ 집계·지오코딩·emit+`data.ts` 연결 ⑤ 공고 연결.

---

### P1. 프론트엔드 리팩토링 ◐

> 완성도(20점) 직결. 지금 초안은 브리핑·와이어프레임 설계의 참고 기준이 되므로 미루지 않고 구현한다. 이후 확정 와이어프레임이 오면 이 리팩토링된 구조(라우팅·컴포넌트·토큰) 위에 화면 디자인만 갈아끼운다.

#### P1-A. 라우팅 & 앱 구조 전환 ✅ (react-router 도입·핀별 상세 라우팅)
- P1-A-1. `react-router` 도입, `state.screen`/`go()` → URL 라우트로 대체. 라우트 표:

  | URL | 화면 | 비고 |
  |---|---|---|
  | `/` | → `/map` 리다이렉트 | |
  | `/login` | LoginScreen | 공개 |
  | `/preference` → `/setup` | 온보딩 2단계 | |
  | `/map` | MapScreen | |
  | `/housings/:id` | DetailScreen | 현재 고정 목데이터 → `:id`로 `generated` 조회 |
  | `/ai` | AiScreen | |
  | `/mypage` | MypageScreen | P4에서 가드 |

  `screen`·`detailTab`은 스토어에서 제거(라우트·URL 파라미터·로컬 state로 이동). `/mobile`은 P1-D-3에서 제거.
  **GitHub Pages 제약:** SPA fallback이 없으므로 `basename: import.meta.env.BASE_URL` 설정 + 빌드 후 `dist/404.html`에 `index.html` 복사(배포 워크플로에 스텝 추가) → **검증:** 배포 환경에서 브라우저 뒤로가기·새로고침·딥링크 정상 동작.
- P1-A-2. 레이아웃 분리: 루트 레이아웃 라우트(공통 Footer + `<Outlet/>`), 인증 필요 라우트에 `<RequireAuth>` 가드 컴포넌트 스캐폴딩(P4의 가짜 세션 기준으로 통과/차단).
- ~~P1-A-3. 개발용 화면 전환기~~ ✅ 제거 — 실제 사용자 흐름(각 화면의 헤더·버튼)으로 이동하므로 개발용 `TopSwitcher`·`navList` 삭제. 화면 점프가 필요하면 URL 직접 입력.

#### P1-B. 타입스크립트 & 코드 품질 기반 ✅
- ~~P1-B-1. Vite TS 템플릿 전환, `tsconfig` strict~~ ✅ 완료.
- ~~P1-B-2. 도메인 타입 정의(`types.ts`) + canonical 타입 `packages/shared-types` 승격~~ ✅ 완료 — canonical 스키마·`GeneratedHousing`·집계 규칙의 단일 원천은 `@bmc/shared-types`, `frontend`·`backend`·`scripts/ingest`가 워크스페이스 참조로 공유.
- ~~P1-B-3. ESLint(flat config, `typescript-eslint` + `eslint-plugin-react-hooks`) + Prettier + `lint-staged` + Husky pre-commit(`lint`+`typecheck`)~~ ✅ 완료 — `frontend/eslint.config.js`, 루트 `.prettierrc`·`lint-staged`·`.husky/pre-commit`. `npm run lint`(0 error, store.tsx fast-refresh 경고 1건은 P1-C-1에서 해소)·`npm run typecheck` 클린. CI(P7-A-1)에서 재실행.

#### P1-C. 상태관리 재설계 ✅ (서버상태 vs UI상태 분리)
- ~~P1-C-1. 단일 Context 해체~~ ✅ 완료. 실제 이관 결과:

  | 목적지 | 필드 |
  |---|---|
  | TanStack Query (`useHousings`/`useHousing`) | 주택 목록·상세 — `/api` 경유 |
  | Zustand `useStore`(`store.ts`) | 취향 pairwise 선호모델·찜 학습 + 필터·UI 상태(regions·depositMax·rentMax·rentType·buildYear·area·houseTypes·favorites·aiChips 등). `selectedTags`/`tagWeights`는 지도 칩 표시용 레거시 투영 |
  | 라우터 | screen(삭제), detailTab(로컬) |
  | 컴포넌트 로컬 useState | remember, showPw (LoginScreen) |

  > 서버상태 분리(Query)가 본질이고, 클라이언트 상태는 **단일 Zustand 스토어**로 뒀다. MapScreen이 필터·UI 필드를 함께 쓰므로 filter/UI 2-스토어 분리는 결합을 줄이지 못하고 마찰만 늘려 채택하지 않음(기존 Context와 동일 `{state, patch}` 계약 유지 → 화면 무변경, Provider·fast-refresh 경고 제거).
- ~~P1-C-2. API 클라이언트 레이어 신설(`frontend/src/api/`) + MSW 핸들러가 `generated/housings.json` 서빙~~ ✅ 완료 — `VITE_API_BASE_URL`만 전환하면 실 BE로 연결(HARNESS §5).
- ~~P1-C-3. 로딩/에러/빈상태 UI 패턴 표준화~~ ✅ 완료 — `components/ui/States.tsx`(Loading/Empty/Error), MapScreen·DetailScreen이 Query `isLoading`/`isError`로 3-상태 렌더.

#### P1-D. 디자인 시스템 & 스타일 리팩토링 ✅ (axe 자동검증만 잔여)
- ~~P1-D-1. Tailwind CSS v4 도입(`@tailwindcss/vite`), 디자인 토큰을 `@theme` CSS 변수로 이관~~ ✅ 완료 — `vite.config.ts` 플러그인, `index.css`에 `@import 'tailwindcss'` + `@theme`(teal/soft/sub/ink/line·font-sans). 전역 리셋은 `@layer base`(유틸리티가 리셋을 이기도록).
- ~~P1-D-2. 공통 컴포넌트 추출(`src/components/ui/`) + 전 화면 Tailwind 치환~~ ✅ 완료 — Button(primary/outline)·Card·Chip·TagButton·Segmented·Toggle·Select(+기존 States). BottomSheet는 사용처가 없어 제외. 전 화면(로그인·취향·조건·지도·상세·AI·마이페이지)과 셸(App·TopSwitcher·Footer) 치환, `lib.ts css()`·`theme.ts` 삭제. 픽셀 동일 원칙: 폰트 크기는 arbitrary 값(`text-[13.5px]`)으로 line-height 변화 차단.
- ~~P1-D-3. 반응형·모바일 통합~~ ✅ 완료 — `MobileScreen`·`/mobile` 라우트·모바일 목데이터 제거, Setup 3열 그리드는 `md:` 브레이크포인트로 좁은 화면 1열 대응(지도는 기존 flex-wrap). 360px~1440px 세부 확인은 시연 리허설에서.
- P1-D-4. ◐ 접근성 1차 반영 — 아이콘 전용 버튼 aria-label, `:focus-visible` teal 아웃라인(키보드 전용), `main`/`footer` 시맨틱 태그, Toggle `aria-pressed`. **잔여:** axe 자동 검사로 위반 0 확인(대비 포함).

#### P1-E. 테스트 & 문서화 기반 ⬜
- P1-E-1. ◐ Vitest 로직 테스트 확보 — 인제스천 어댑터(`adapters.test.ts`)·프론트 포맷터(`manwon`/`rangeLabel`)·DTO 변환(`toCard`/`toMarker`)·스토어 patch(`store.test.ts`) 커버(33 테스트). **RTL 컴포넌트 렌더 테스트는 P1-D 컴포넌트 안정화 후 추가.**
- P1-E-2. Playwright E2E 뼈대: 로그인 → 취향 선택 → 지도 → 상세 플로우 1본(MSW 데이터 기준).
- P1-E-3. Storybook 선택 도입(후순위 — 공통 컴포넌트가 안정된 뒤) → **검증:** CI에서 test·build 그린.

---

### P2. 백엔드 기반 구축 ◐ (스캐폴딩·DB·housings API·compose 구현·**스택 실행검증 통과** — auth/users 등 잔여 모듈·`/meta`·Migrate 이력화 대기)

#### P2-A. 프로젝트 스캐폴딩 & 규약
- P2-A-1. `backend/`에 NestJS 스캐폴딩(strict), 모듈 구조: `auth, users, housings, pois, recommend, search, notifications` + `config`, `db`. 워크스페이스 등록.
- P2-A-2. 환경설정: `@nestjs/config` + zod로 env 검증(`DATABASE_URL`, `JWT_SECRET`, `KAKAO_*`, `GEMINI_API_KEY(P5)`), `.env.example` 커밋. 로깅 `nestjs-pino`(요청 ID 포함).
- P2-A-3. OpenAPI(Swagger) `/docs` 자동 문서 + FE 타입 생성: `openapi-typescript`로 `frontend/src/api/schema.d.ts` 생성 스크립트(`npm run gen:api-types`) → **검증:** `/docs` 노출, 생성 타입으로 FE 컴파일 통과.

#### P2-B. 데이터베이스 설계
- ~~P2-B-1. PostgreSQL 16 + **PostGIS**(`postgis/postgis:16-3.4`), Prisma 도입(geometry는 `Unsupported` + raw SQL)~~ ✅ 완료 — `backend/prisma/schema.prisma`(complexes/units/pricing).
- P2-B-2. 스키마 설계 — P0 canonical + 선도소프트 상권 GIS를 테이블화:

  | 테이블 | 핵심 컬럼 | 비고 |
  |---|---|---|
  | `complexes` | id, type, name, address, district, built_date, total_units, elevator, parking, **geom geometry(Point,4326)** | = P0 `Complex` |
  | `housing_units` | complex_id FK, dong, ho, unit_type, rooms, area_m2 | = `Unit` |
  | `housing_pricing` | complex_id FK, unit_type, ho, supply_class, income_band, household_size, protection, deposit, rent, registered_at | qualifier 평탄화 |
  | `notices` | complex_id FK, supply_class, eligibility(jsonb), schedule(jsonb), status | P0-C 승격 |
  | `commerce_pois` | category, name, **geom geometry(Point,4326)**, source | 선도소프트 상가-건물 + 외부 보조 POI(공원·교통) |
  | `industry_density` | 업종, **geom geometry(Polygon,4326)**(격자/집계구), density | 선도소프트 인구-업종(총인구 대비 5대 업종 밀집도) |
  | `commercial_zones` | zone_type, **geom geometry(Polygon,4326)** | 선도소프트 상권·용도지역 |
  | `complex_tag_scores` | complex_id, tag, poi_count, nearest_m, raw | **레거시**(옛 퍼센타일 백엔드) — 실경로는 `tag/`+`preference-features.json` |
  | `users` / `preferences` / `favorites` / `applications` / `user_qualifications` | | P4 |

  > 상권 3테이블 컬럼은 SHP 실측으로 확정(DATA_SCHEMA §6). 현 스코어링은 `tag/` 파이프라인이 파일 기반으로 담당하고, 백엔드 DB 적재(GIS 테이블 시드)는 P3-A 운영화에서.
- P2-B-3. 마이그레이션·시드: 시드 스크립트(`backend/prisma/seed.ts`)가 `data/out/canonical.json`(P0-B-3)을 멱등 적재 ✅(`npm run db:seed`). 스키마 반영은 현재 `prisma db push`(`npm run db:push`) — 정식 Prisma Migrate 이력화는 스키마 확정(상권 GIS 테이블) 후 도입 ⬜. **검증:** 시드 건수 = P0 실행 리포트 건수(스택 기동 후).
- P2-B-4. 공간 인덱스(GiST, 마이그레이션에 raw SQL) 및 조회 성능 기준(목록 API p95 < 300ms 로컬 기준) 설정.

#### P2-C. 코어 API
- ~~P2-C-1. `GET /housings`(필터·정렬·페이지) · `GET /housings/:id` — 응답 스키마는 `GeneratedHousing`(P0-B-3)과 동일 → FE는 소스만 교체~~ ✅ 완료 — `/api` 프리픽스, `backend/src/housings/`.
- ~~P2-C-2. `GET /meta/filters` — 옵션 메타(현 하드코딩 대체, DB distinct)~~ ✅ 완료 — `{ types, districts }`(DB distinct). 프론트: 공급유형 셀렉트를 `types`로, SetupScreen 지역 "추가"(기존 죽은 버튼)를 `districts` 셀렉트(최대 3)로 배선. 준공연도·면적은 의미 버킷이라 상수 유지. MSW 핸들러·테스트 동형.
- P2-C-3. 캐시 전략 — 초기엔 DB 인덱스·쿼리 최적화로 대응, Redis는 트래픽 검증 후 도입 판단(compose에는 정의만) → **검증:** 부하 시 p95 응답목표 충족.

#### P2-D. 인프라 기초
- ~~P2-D-1. `docker-compose.yml`(루트): `db`(postgis, 볼륨+`pg_isready` healthcheck) / `redis`(profile `cache`, 기본 미기동) / `api`(backend Dockerfile, `depends_on: service_healthy`)~~ ✅ 완료·**실행검증 통과** — 호스트 DB 55432 매핑, `compose up db`(healthy) → `db:push` → `db:seed`(단지41·호2527·가격676·geom41) → `start:dev` → `GET /api/health` 200, `/api/housings` 41건·`/:id` pricingRows 324·`?district` 필터 정상.
- P2-D-2. 스테이징/프로덕션 환경 분리(env 파일·compose override), 마이그레이션 자동화(api 기동 전 `migrate deploy`).
- P2-D-3. 헬스체크(`/health` — DB ping 포함)·그레이스풀 셧다운(`enableShutdownHooks`).

#### P2-E. 프론트–백엔드 실연결 (end-to-end)

> "프론트만 만든 프로토타입"이 아니라 "서버·DB가 실제로 도는 출시 가능한 서비스"라는 인상은 데이터가 브라우저→API→DB를 실제로 왕복하는 데서 나온다. 이미 구축한 백엔드(P2-C)를 프론트가 실제로 소비하도록 배선하는 단계. 데이터 소스 전환 경로(HARNESS §5)의 종착점(P0 JSON → MSW 목 → **실 API**).

- P2-E-1. 프론트 데이터 소스를 MSW 목 → 실 API로 전환: `VITE_API_BASE_URL`을 실 백엔드로 지정, `api/client.ts`의 경로 프리픽스 규칙 정리, 백엔드 `enableCors`(로컬·Pages·스테이징 오리진). MSW는 테스트·오프라인 폴백으로만 잔존. → **검증:** `docker compose up`(db+api) → 시드 후 프론트가 지도·리스트·상세를 **실 API로** 렌더(브라우저→서버→DB 왕복), 목록 건수 = 시드 건수.
- P2-E-2. 데모 안전망: 실 API를 주력 경로로 삼되, 정적 Pages 빌드(MSW)를 폴백으로 유지 — 라이브 시연 중 DB·네트워크 이슈에도 서비스가 죽지 않게 이원화.

---

### P3. 도메인 데이터 & 추천 엔진 ◐ (GIS **부산 전역** 적재·고정감쇠 스코어링·pairwise 8피처 프론트 배선 ✅ **LIVE**·355후보 8축 전역 관측, 옛 퍼센타일 백엔드·API 클라이언트·죽은 온보딩 계산함수 제거 — `housings.json` tagScores 레거시 필드·P3-D 상세 잔여)

> **채점 핵심 구간.** 발제사 데이터 활용(15)·데이터 기반 문제해결(20)·창의성(15)이 여기서 결정된다. 선도소프트 상권 GIS를 추천의 근거로 실제 반영하고, 그 근거를 사용자에게 설명한다.

#### P3-A. 데이터 파이프라인(ETL)
- P3-A-1. P0 변환 파이프라인을 배치 ETL로 승격: 산출 대상을 JSON 파일 → DB(P2-B)로 전환(어댑터·canonical 재사용, emit만 DB 적재로 교체), BMC 정기 CSV 수령·공고 게시판 수집을 정기 배치화.
- P3-A-2. ✅ (부산 전역) **상권 데이터 적재 — 선도소프트 GIS(SHP)가 1차 소스**, 외부 공개데이터는 GIS 미커버 축만 보강:

  | 최종 피처 | 소스 | 비고 |
  |---|---|---|
  | cafe_choice·restaurant_choice·fitness_access·supermarket_access·culture_access | **상가-건물 GIS**(선도소프트, 부산 전역 16.1만건) | 업종분류 **KSIC** → 원자 피처(GIS 상업시설만이라 culture=서점 한정·재래시장 부재) |
  | quiet_residential | 유흥 `CMSC` 역가중 + 격자 `P_Val` CDF + 용도지역 `UNAME` | 복합 대리지표(실측 소음 아님) |
  | (상권 강도·밀집도) | **5대 업종-인구 밀집도 격자**(선도소프트, 100m·79,935칸·전역) | quiet 인구CDF + 생활피처 커버 게이트 |
  | (상권 형성 여부·용도지역) | **상권·용도지역 격자**(선도소프트, 29,441칸·부분 커버) | quiet의 zone항(주거/상업)·서사 근거 |
  | rail_access | 도시철도 158역(동해선·경전철·환승 포함, 공공데이터) | GIS 미포함 축 — **외부 공개데이터 활용(20점 요건)** |
  | park_walk | 전국도시공원 표준데이터 652(공공데이터) | 동일 |
  | (설명·결합) bus_stop_proximity·cvs_access·market_complex_access·laundry_access·retail_access·nightlife_access | 버스정류소 8,522·상가-건물 `CMSC` | 산출하되 **추천 독립 가중 아님** |
  | (설명·파생) university_walk_access·university_life_mix·university_commercial_area(대학가 생활권) | 대학·전문대학 표준데이터 25캠퍼스(공공데이터)+상가-건물 GIS | 캠퍼스 접근성×학생생활형 상권, 설명 전용·**추천 독립 가중 아님**(107 근접·73 대학가) |

  > 레이어별 컬럼·좌표계(파일별 EPSG:5181/5186)·DBF 인코딩·**최종 피처↔업종코드** 상세 매핑은 **[DATA_SCHEMA.md §6](./DATA_SCHEMA.md)**, 역할·공식은 **[태그가이드](../tag/최종_태그_체계_및_산출가이드.md) §5·§6**.

  산출 파이프라인: `tag/src/`(a~d + compound, `node tag/src/run-all.mjs`)가 고정 거리감쇠로 태그 산출 → `tag/output/` → `gen:preference-features`가 원자 8피처를 `frontend/src/generated/preference-features.json`(**부산 전역 355후보, 8축 전역 관측**)으로 이관, 프론트 `rankByLearnedPreference`가 소비. 생활 POI 피처는 전역 POI(16.1만)+density 격자(전역 커버)로 355 전부 산출, zone 격자(부분 커버)는 quiet의 zone항에만 사용. **잔여:** `housings.json`.tagScores(옛 8키·placeholder)·백엔드 `score.ts`는 레거시 정리 대상.
- P3-A-3. ✅ 좌표계 통일(shpjs가 5186→4326 재투영, bbox 가드로 검증)·재실행 멱등(TRUNCATE 후 재삽입). 배치 스케줄러(cron/큐)는 운영화 잔여.
- P3-A-4. 운영 어드민: 공고 검수·수동 보정·게시 승인·CS 대응 콘솔 → **검증:** 원천 데이터 오류를 코드 배포 없이 수정 가능.

#### P3-B. 추천 로직 — 정본: [최종기획안](./공공임대_취향추천_최종기획안.md) §7~8 · [태그가이드](../tag/최종_태그_체계_및_산출가이드.md) §5~7 (공식·피처·응답 계약의 단일 원천)

> 상세(pairwise 갱신식·고정감쇠 공식·결합태그·응답 계약)는 최종 문서. 여기는 구현 대응만.

- P3-B-1. ✅ 2단계 — **하드 필터**(A 자격·B 주거물리: 예산·지역·유형·준공·면적·방수) → **소프트 랭킹**(C/D 취향 적합도). buildingTypes는 원천 축 부재로 v1 미배정.
- P3-B-2. ✅ 개인 선호벡터 = **원자 8피처**(`rail_access, cafe_choice, fitness_access, supermarket_access, restaurant_choice, culture_access, quiet_residential, park_walk`) — `packages/shared-types` `PREFERENCE_FEATURES` 단일 원천. metro/donghae/bgl/transfer/bus·cvs/market/laundry/retail/nightlife은 설명·결합 구성요소(독립 가중 아님).
- P3-B-3. ✅ 피처 점수 — **고정 거리감쇠** `a=Σ 0.85^i/(1+d_i/기준거리)`, `점수=1-exp(-a/포화)`(후보 백분위 아님·후보군 불변, `tag/src/lib.mjs`). GIS 미커버·결측은 `null`(0점 아님).
- P3-B-4. ✅ 취향 적합도 = 관측 피처만 `Σ|w|·fit/Σ|w|`(결측 분자·분모 동시 제외). 온보딩 pairwise가 학습한 `w` 사용.
- P3-B-5. ✅ 설명가능성 — 기여 상위 피처의 거리·개수 근거 + **결합태그 10종**(설명 전용·추천점수 기여 0). **차별성(15점) 핵심.**
- P3-B-6. ✅ 엣지 — 콜드스타트(약한 warm-start prior)·미커버 null·0건 완화 제안(지역→준공→예산)·낮은 커버리지 후보 분리 표시. 검증: `tag/test/pipeline.test.mjs` 6/6.

#### P3-C. 추천 스코어링 구현 ◐ (LIVE 경로 ✅·부산 전역 GIS 반영·옛 퍼센타일 백엔드 제거 — 골든테스트 잔여)
- P3-C-1. ✅ **LIVE 경로**: `tag/` 파이프라인(고정감쇠) → `preference-features.json`(원자 8, 355후보) → 프론트 `pairwise.ts rankByLearnedPreference` → `useRecommendations` → Map·홈. 점수·정렬은 **후보 풀과 무관한 절대 적합도**(기획안 §8.3 `Σ|wⱼ|·fitⱼ/Σ|wⱼ|`, 결측 축은 분자·분모에서 제외) — 동일 시설구성이면 풀이 바뀌어도 같은 점수(§8.2 후보 내 백분위 금지). 화면 라벨은 "생활취향 적합도".
- P3-C-2. ◐ 밀집도 격자(`industry_density`) 적재 완료 — 서사·근거용. 히트맵은 미채택(P6-A-3).
- P3-C-3. ◐ **레거시 정리** — ✅ 백엔드 `recommend` 모듈(옛 퍼센타일)·프론트 API 클라이언트(`api/recommendations`)·엔진 프리뷰 경로·죽은 온보딩 계산함수(`computeWeights`군) 제거 → 프론트는 로컬 랭킹 단일 경로. **잔여:** `housings.json`.tagScores(옛 8키·미소비) 필드, `PreferenceScreen`(마이페이지 취향 재설정에서 도달 — pairwise 온보딩 재진입으로 대체 필요), prisma `score.ts`/`complex_tag_scores`.
- P3-C-4. 랭킹 지표(찜 전환) 로깅·가중치 튜닝은 지표 축적 후.

#### P3-D. 상세·인프라 데이터
- P3-D-1. 상세화면 실데이터화 — `detailRows` 대체: 기본·비용 탭은 P0 산출, 주변인프라 탭은 `tag/output`의 피처·최근접 POI 이름·거리, 교통 탭은 P3-D-2.
- P3-D-2. 교통 접근성(지하철/버스/소요시간) 데이터 소스 연동 → **검증:** 상세 API 응답이 UI 스키마와 일치.

---

### P4. 사용자 도메인 (가짜 세션 기반) ✅ (프론트 로컬 — localStorage 영속)

> **로그인은 껍데기(가짜 세션)** — 채점 무관이므로 실 OAuth에 시간을 안 쓴다. 관심목록·조건저장을 그 세션 위에서 정상 구현해 서비스 흐름 완결성(완성도 20점)을 채운다. **구현 노선: 프론트 로컬**(Zustand `persist`→localStorage). 서버 영속(preferences/favorites 테이블·동기화)은 규모 대비 데모 이득이 없어 채택 안 함(§4 "대회 후"). 실 OAuth·본인인증·청약·알림도 대회 후.

#### P4-A. 가짜 세션 & 가드
- ~~P4-A-1. **가짜 세션**~~ ✅ — 로그인·소셜 버튼이 `loggedIn` 플래그 세팅 후 이동, 비회원 둘러보기는 미설정. localStorage 영속.
- ~~P4-A-2. 라우트 가드~~ ✅ — `<RequireAuth>`가 `loggedIn`을 읽어 비로그인 시 `/login` 리다이렉트. 지도·상세는 공개, `/mypage`는 세션 필요.

#### P4-B. 사용자 데이터 도메인
- ~~P4-B-1. 취향/조건 저장·복원~~ ✅ — 필터/취향 상태를 `persist`로 localStorage에 저장·복원(새로고침 유지).
- ~~P4-B-2. 관심목록~~ ✅ — 지도에서 하트 토글 → localStorage 영속, 마이페이지 "관심 목록"이 실제 favorites 반영(빈 상태 안내 포함).
- P4-B-3. 자격정보(현 `myQual`)는 정적 표시 유지 — 편집·영속은 필요 시 확장.

---

### P5. AI 자연어 검색 ◐ (NL→필터·프록시 하드닝·추천 체이닝·개인화·선제 제안·멀티턴 되묻기 완료 — 비용 모니터링 잔여)

> 발제 서비스 예시("보증금 2천만원 이하 원룸", "역세권 10분 이내")를 실제로 처리 — 차별성 가점 요소.

#### P5-A. NL → 구조화 필터 변환
- P5-A-1. ✅ Gemini **구조화 출력(`responseSchema`)** 으로 필터 스키마(예산·지역·유형·준공·면적·방구조 + 태그 가중치 + `unresolved`)를 강제. 두 경로: 프론트 `api/ai.ts`(`VITE_GEMINI_API_KEY` 있으면 Pages 데모용 직접 호출) / 백엔드 `search` 모듈(`POST /api/search/nl`, 키 서버 env `GEMINI_API_KEY`, 미설정 시 503) — 키 없는 프론트는 프록시 경유. 응답 타입 `ParsedFilter`는 `@bmc/shared-types` 단일 원천, 프롬프트·스키마는 두 경로가 동형 사본. 모호·미지원 표현은 `unresolved`로 받아 AiScreen이 되물음 노트로 표시.
- P5-A-2. ✅ 파싱 결과를 **제거 가능한 조건 칩 + "이 조건으로 N곳" 확인 UI**로 반환(AiScreen). 확인 시 취향/조건 상태를 채워 지도 필터에 적용(`lib/filter.ts applyPrefs` — 슬라이더 흐름과 동일 경로).
- P5-A-3. ✅ `POST /api/search/nl` — 문장 → 필터 파싱 프록시(모델 원본 JSON 반환, 정규화는 프론트 `normalize`/`augment`가 담당). 추천 연계: 확정 시 AI 파싱 태그를 pairwise `preferenceModel`에 실어 `store→map→useRecommendations` 로컬 랭킹으로 검색, AiScreen "N곳" 프리뷰는 로컬 하드필터 카운트.

#### P5-B. 안전·비용·품질
- P5-B-1. ✅ 입력 검증(빈 문장·300자 상한)·구조화 출력 강제·IP당 슬라이딩 윈도우 레이트리밋(60초 20회)·모델 출력 zod 재검증(필드별 방어, 프록시 직접 호출도 안전 shape)까지 BE `search`에 구현.
- P5-B-2. ◐ 실패·타임아웃 폴백(프론트 `augment` 안전망)·동일 문장 캐싱(정규화 키, 10분 TTL·200건 상한)·레이트리밋 구현. **잔여:** 비용 모니터링 → **검증:** 악성/모호 입력에도 안전 응답.

#### P5-C. 대화형·개인화 검색 ✅ (개인화 파싱·병합·선제 제안·멀티턴 되묻기 완료)

> 설정 조건·관심목록을 반영해 AI가 개인화 파싱·제안·역질문(예: "찜하신 3곳이 다 수영구 신축이네요, 기장군도 볼까요?"). 추천엔진(P3) 없이 지금 개발 가능하며, 아래 디커플링 계약을 지키면 엔진은 나중에 **값만 흘려넣는 교체**로 붙는다(P5-C-3).

- P5-C-1. ✅ 문맥 인지 파싱: 현재 조건(`useStore` 필터)을 프롬프트에 첨부(`buildContextText`)하고, 파싱 결과를 현재 조건 위에 **병합**(`mergeInto(parsedFromPrefs(current), p)` — 덮어쓰기 대신 문장에 없는 축은 기존 조건 유지). 관심목록은 `favProfile`로 **압축 요약**("관심 3곳 · 주로 수영구 · 신축 위주")해 컨텍스트에 첨부. 필터 필드는 이번 문장에서만 채우고 태그는 문장 기준(기본 태그 혼입 방지).
- P5-C-2. ✅ 관심목록 경향 기반 **선제 제안**(빈 상태에 "찜하신 곳처럼 · 수영구 신축 찾아보기" 원클릭 검색) 구현.
- P5-C-3. ✅ **추천엔진 디커플링 계약**(엔진이 나중에 클린하게 붙는 조건):
  1. AI는 취향을 **스토어에 쓰기만** (pairwise 선호모델·필터 필드) — 자체 상태를 만들지 않는다. AI 파싱 태그(원자 8피처)는 `preferenceModelFromTags`로 `preferenceModel`에 흘러 LIVE 랭킹에 반영된다.
  2. 결과는 **이음새 하나(`useRecommendations(prefs)`)로만** 수신 — 현재 `tag/` 고정감쇠 φ + pairwise `w`(`rankByLearnedPreference`) 로컬 계산, 실 API 붙일 땐 훅 내부만 교체.
  3. **랭킹은 AI가 하지 않는다** — 순위는 엔진/`applyPrefs` 담당, AI는 취향 입력 + 결과 내레이션만(직접 정렬 금지 = 엔진 부착 시 깨지는 유일 지점).
  4. 구체 근거 문구는 해당 후보의 피처가 관측(GIS 커버)됐을 때만 노출 — 미커버(`null`)면 일반 문구로 폴백.
  → **검증:** 추천엔진 교체(P3-C) 시 P5-C 코드 무수정으로 근거 문구까지 활성.
- P5-C-4. ✅ **멀티턴 대화형 되묻기(그릴링)** — AiScreen을 일회성에서 대화 루프로 전환. 취향이 막연할 때(사용자 "잘 모르겠어요"류) AI가 짧은 질문 하나 + 탭 가능한 보기(각 보기=8피처 태그·가중치)를 `followup`으로 내고, 답을 `parsed.tags`에 **누적**(취향 단일 소스)해 다음 턴 컨텍스트('파악된 취향')로 재질문을 막는다. 모델이 첫 턴에 되묻기를 빠뜨리면 취향 4묶음 기반 **결정적 시작 질문**으로 보완. 상한: 태그 4개/3회. `followup`은 `ParsedFilter`(shared-types 단일 원천)에 추가돼 프론트·백엔드 동형. lite 모델은 출력 폭주·구조화 누락으로 부적합 → 기본 모델 `gemini-flash-latest`.

---

### P6. 지도 · 인프라 통합 ◐ (Naver 전환·개수 클러스터·리스트 연동 완료 — 서버 bbox 조회 잔여)

#### P6-A. 국내 지도 전환
- P6-A-1. ✅ Leaflet/OSM → **Naver Maps JS API(NCP)** 전환 완료 — `useNaverMap`이 `useLeafletMap`과 동일 훅 계약(컨테이너 ref + 마커 데이터 in)이라 화면 무수정 교체, Leaflet 의존 전면 제거. `VITE_NAVER_MAP_CLIENT_ID` env, NCP 콘솔 서비스 도메인 등록(신규 `ncpKeyId`/구 `ncpClientId` 폴백 로드).
- P6-A-2. ◐ 마커·클러스터링·뷰포트 연동 — 픽셀 격자 개수 클러스터(줌 반응)·마커 클릭 선택·리스트=화면 내 매물(클라이언트 bbox 필터)까지 완료. 서버 bbox 조회(`GET /housings?bbox=…`, idle 디바운스)는 잔여.
- P6-A-3. ✅ 상권 밀집도 표현 방식 확정 — 히트맵(`score/100` placeholder)을 걷어내고 **마커 개수 클러스터**로 대체. 이산 매물 수를 직관적으로 보여주는 방식이 데이터 성격에 부합해 히트맵 레이어·토글은 제거. (실 상권 밀집도 시각화가 필요해지면 P3-C-2 격자 적재 후 별도 검토.)

---

### P7. CI ⬜

- P7-A-1. GitHub Actions `ci.yml`(PR·push): `lint → typecheck → test → build` + 인제스천 검증(어댑터 테스트). 배포 워크플로는 두지 않는다 — 공개 저장소 빌드는 합성 데모 데이터를 읽으므로, 실데이터 시연은 로컬·비공개 경로로 한다(README §데이터 공개 정책).

> 배포 자동화·DB 마이그레이션/DR·보안 컴플라이언스·관측성/성능은 §4 "대회 후".

---

## 4. 해커톤 제출 범위

**포함(제출물 완결 기준):** P0(주택 CSV 인제스천) + P1(라우팅·상태·디자인시스템·반응형·린트) + P2(API·PostGIS·인프라) + P3(상권 GIS 적재 + 추천 설계·구현 + 설명가능성) + P4-A 가짜 세션·P4-B(관심·조건저장) + P5(AI 자연어 검색) + P6-A(국내 지도·개수 클러스터) + P7-A-1(CI).
**대회 후(프로덕션 연장):** 실 Kakao OAuth·JWT/세션·본인인증(PASS), 청약 신청 실연동, 모집공고 알림(웹푸시/알림톡), 지오 검색 UX(주소·현위치·반경), 컨테이너 배포·환경 분리·DB 마이그레이션 자동화·백업/DR, 보안·컴플라이언스(시크릿·CORS·CSRF·개인정보처리방침), 관측성·성능(로깅/트레이싱·대시보드·Lighthouse).

> 데이터 의존: P3의 상권 스코어링 **실값**은 선도소프트 GIS로 산출된다(부산 전역 편입 완료). 공원·교통 등 GIS 미포함 축은 외부 공개데이터로 보강한다.

---

## 5. 리스크 & 선결 과제

- **선도소프트 상권 GIS — 부산 전역 반영:** SHP 3종(상가-건물 16.1만건 · 5대업종-인구 밀집도 79,935격자 · 상권·용도지역 29,441격자) 편입 → **부산 전역 355단지 8축 상권 스코어링**. zone 격자는 부분 커버(영도·해운대 일부 미포함)라 생활 POI 피처는 전역 POI+density로 산출하고, zone은 quiet의 zone항에만 사용. 공원·교통은 외부 공개데이터로 보강. **잔여 리스크:** culture는 GIS에 서점만 있어 빈약 → 공공 문화시설 외부데이터 보강 검토.
- **SHP 처리·좌표계(수령 실측 확정):** 상가-건물은 DBF `LO/LA`(WGS84) 내장, 격자는 `.prj`(EPSG:5186/5179)로 shpjs가 4326 재투영(bbox 가드로 검증). 업종 매핑은 `CMSC_L/M/S_CD`(부산 전역은 **KSIC** 코드값) 기준 원자 8피처 대응(P3-A-2). 변환 정확도·매핑 정합이 스코어링 품질을 좌우.
- **BMC 데이터 확보:** 샘플로 포맷은 검증됨(수영구·기장군). 남은 확인 — 실데이터 전 구(區) 커버리지, 갱신 주기·전달 방식(수동 vs API), 스키마 일치(P0-A-3 체크리스트). 최종은 공공데이터포털 등록 예정.
- **단지 조인 키 취약:** 유형단지는 `임대주택명`↔`사업지구` 문자열 매칭 의존 — 명칭 흔들리면 별칭 매핑 수작업 증가. BMC에 단지 식별자 제공 가능 여부 문의가 최선.
- **주택 좌표 부재:** BMC 원천에 위경도 없음 → 주소 지오코딩 필수. 쿼터·정확도(지번/도로명 혼재)가 지도·추천의 전제. 캐시(P0-B-2)로 재실행 비용 제거.
- **외부 POI 저장 약관:** 카카오/네이버 로컬 API는 결과 DB 저장 제한 — 공원·교통 등 보강 POI는 저장 가능한 공공데이터포털 소스로 확보(P3-A-2).
- **지도 API 비용/쿼터:** NCP Maps 무료 쿼터·과금 확인.
- **GitHub Pages와 SPA 라우팅:** fallback 부재 — P1-A-1의 404 우회 + basename 없이는 새로고침·딥링크 깨짐.
- **공공서비스 규제:** 전자정부 접근성 지침(KWCAG)은 제출 범위에서 P1-D-4로 1차 대응. 개인정보·보안 컴플라이언스 실연동은 §4 "대회 후".
- **추천 설명가능성:** "상위 N%" 근거를 실데이터로 재현 가능해야 신뢰(P3-B-4).
- **LLM 비용/지연:** 검색 캐싱·폴백 없이는 운영비·UX 리스크(P5-B).

### 5.1 사용자(개발 외) 선결 항목 — 발급·협의
| 시점 | 항목 | 경로 |
|---|---|---|
| 지금 | VWorld 지오코딩 API 키(무료) → `.env` `VWORLD_API_KEY` | vworld.kr |
| ✅ 확보 | 선도소프트 상권 GIS 부산 전역(SHP 3종) — 편입 완료 | 발제사 제공(수령 완료) |
| 지금 | Kakao Developers 앱 REST 키(지오코딩 보조) | developers.kakao.com |
| ✅ 확보 | 공공데이터포털 공원(도시공원)·교통(도시철도) — C·D가 확보·산출, 데모 tagScores 반영 | data.go.kr |
| P3 전 | BMC 협의: 실데이터 커버리지·갱신·단지 식별자 | 발제사 문의처 |
| P5 | Gemini API 키(무료 티어) | aistudio.google.com/apikey |
| P6 | NCP 계정 + Maps 클라이언트 ID·도메인 등록 | ncloud.com |

---

## 6. 즉시 실행 순서 (다음 착수)

커밋은 각 유닛이 settled될 때 1회(CLAUDE.md 규칙).

완료: P0 인제스천 · P1-A~D(라우터·타입·shared-types·린트·Query+Zustand·Tailwind 디자인시스템·반응형) · P2-B~D(Prisma·housings/`meta` API·compose 실행검증) · P4 사용자 도메인(찜 β학습 포함) · **P5-A NL→구조화 필터·확인 UI·백엔드 프록시** · 주택 실데이터 355단지(부산 전역) · **P6-A-1 Naver 지도 전환** · **취향 온보딩 pairwise 재설계**(아래) · **P3 LIVE 경로**(`tag/` 고정감쇠 → `preference-features.json` 원자 8피처 → 프론트 `rankByLearnedPreference` → MapScreen; `tag/test` 6/6·vitest 71 pass·tsc 클린).

**취향 온보딩 — pairwise 가상매물 비교**([최종기획안](./공공임대_취향추천_최종기획안.md) §6~7): Login → Setup(하드필터) → **Swipe**(가상 생활권 A/B, 로지스틱 `w←(1-ηλ)w+η(y-p)diff` 갱신·이전질문 재계산) → Prefill(취향 진단·직접 보정). 찜 β≤0.25 정교화(`refine.ts`)까지 ✅. 문항수는 핵심 5(+선택 2)로 기획안(§6.3)과 정합.

다음 착수:
1. **레거시 잔여 정리** — `housings.json` tagScores(옛 8키·미소비) 필드 제거, `PreferenceScreen`(마이페이지 취향 재설정)을 pairwise 온보딩 재진입으로 대체, prisma `score.ts`/`complex_tag_scores` 정리. (백엔드 recommend·API 클라이언트·죽은 계산함수는 제거 완료.)
2. **P2-E 프론트–백엔드 실연결(e2e)** — `VITE_API_BASE_URL`로 housings/meta/search를 실 API 연결·`docker compose up`으로 db→api→화면 왕복 검증(현재 프론트 로컬 계산).
3. **부산 전역 GIS 편입 ✅** — KSIC 재매핑(`tags.ts`)·zone 게이팅 완화(density 기준)로 355 전역 8축 관측. 상권 정밀화(culture 외부데이터 등)는 필요 시.
4. **P1-E 잔여**(RTL·Playwright·axe) · **P6-A** 서버 bbox 조회.
5. 골든 테스트(고정감쇠 수기 재현).

병행 트랙: P0-C 공고 수동 정리(데이터 작업). 부산 전역 커버리지·문항 검증은 태그가이드 §12·기획안 §16. 키·데이터 선결 항목은 §5.1.
