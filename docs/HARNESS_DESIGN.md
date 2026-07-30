# 하네스 설계도 — BMC 주택 추천 서비스

> 관련: [`PRODUCTION_PLAN.md`](./PRODUCTION_PLAN.md), [`STACK_DECISION.md`](./STACK_DECISION.md)
> 전제 스택: React+Vite / NestJS / PostgreSQL+PostGIS / Docker ([`STACK_DECISION.md`](./STACK_DECISION.md) 채택)

## 0. 이 문서에서 "하네스"란

플랜(PRODUCTION_PLAN)이 **무엇을 언제** 할지를 정한다면, 이 문서는 그것들이 **어디에 얹혀 어떻게 맞물려 돌아가는지**를 정한다. 즉 개발·데이터·실행을 지탱하는 골격 — 컨테이너 개발환경, 데이터 인제스천 파이프라인, 백엔드/프론트 스캐폴드, 테스트·CI 자동화 — 을 하나의 설계도로 묶는다.

설계 원칙 3가지:
- **한 줄 기동** — `docker compose up` 하나로 전 스택이 로컬에서 뜬다(시연 전제).
- **실데이터 교체점 고정** — 새 CSV가 들어오면 정해진 한 곳(어댑터+원천 파일)만 바꾸면 끝단까지 흐른다.
- **점진적 승격** — P0는 파일 산출물, P2 이후 같은 스키마를 DB로 승격. 스키마·타입은 처음부터 공유한다.

---

## 1. 전체 구조 (모노레포)

```
bmc-housing-recommender/
├── frontend/                 # React + Vite 웹 클라이언트 (기존)
│   └── src/
│       ├── generated/        # P0 산출물(housings.json 등) — 앱이 읽는 실데이터
│       └── api/              # API 클라이언트 레이어 (+ MSW 목서버)
├── backend/                  # NestJS API 서버 (P2에서 스캐폴딩)
│   ├── src/
│   │   ├── modules/          # auth·users·housings·pois·recommend·search·notifications
│   │   ├── config/           # env 검증·로깅
│   │   └── db/               # 마이그레이션·시드(P0 산출물 적재)
│   └── Dockerfile
├── packages/
│   └── shared-types/         # 도메인 타입(canonical 스키마) — FE·BE 공유
├── scripts/
│   └── ingest/               # P0 CSV → canonical → 산출물 변환 하네스
├── data/
│   ├── source/               # 원천 CSV(샘플/실데이터) — 교체 대상
│   └── cache/                # 지오코딩 캐시 (재실행 시 API 호출 생략)
├── docs/
└── docker-compose.yml        # web·api·db·redis 로컬 오케스트레이션
```

> 현재 실제 존재: `frontend/`, `backend/`(README만), `docs/`, GitHub Pages 워크플로. 나머지는 이 설계도가 정의하는 목표 골격이며 P0/P2에서 채운다.

---

## 2. 개발 하네스 (docker-compose)

로컬·시연을 위한 단일 진입점. 서비스 구성:

| 서비스 | 이미지/베이스 | 역할 | 도입 시점 |
|---|---|---|---|
| `db` | `postgis/postgis` | Postgres + PostGIS(지리연산·공간인덱스) | P2 |
| `redis` | `redis` | 캐시/세션 — 트래픽 검증 후 실사용 | P2-C 이후 |
| `api` | `backend/Dockerfile` | NestJS API | P2 |
| `web` | `frontend` (dev: 호스트 Vite) | 클라이언트 | 상시 |

- **헬스체크·의존순서**: `api`는 `db` healthy 이후 기동, 그레이스풀 셧다운(P2-D-3).
- **P0 단계에서는** `db`/`api` 없이 `web`만으로도 완결 — 앱이 `generated/housings.json`을 직접 읽으므로 백엔드 전 시연이 가능하다.

---

## 3. 데이터 인제스천 하네스 (P0의 심장)

실데이터 교체가 한 곳에서 흐르도록 하는 파이프라인. **어댑터 이후 단계는 유형·포맷과 무관하게 공유**한다.

```
data/source/*.csv (CP949, 유형별 스키마 상이)
   │
   ▼  [1] 어댑터  scripts/ingest/adapters/ — 원천 CSV 스키마당 1모듈, 총 6종(주택정보 2 + 가격 4)
   │      ← 실데이터 포맷이 달라도 여기'만' 교체
   ▼  [2] canonical 정규화   complexes / units / pricing (3 엔티티)
   │      · 금액 콤마 제거, 날짜 포맷 통일, 인코딩 정규화
   ▼  [3] 단지 집계   호 단위 → 단지 단위(세대수·면적/방수 분포·보증금/임대료 범위)
   ▼  [4] 지오코딩   주소 → 위경도  (data/cache/geocode.json 캐시)
   │      · 실패 주소 리포트, 재실행 멱등
   ▼  [5] 산출
        ├─ P0:  frontend/src/generated/housings.json   (housingData·homes 호환 + 상세 확장)
        └─ P2:  backend db seed (동일 canonical → 테이블 적재)
```

- **실행**: `npm run ingest` (루트 워크스페이스, tsx) → 파일별 적재/스킵/오류 건수 리포트 출력.
- **생활환경 점수(C/D 태그)**: `tag/` 파이프라인이 **고정 거리감쇠**(`1-exp` 포화, 후보 백분위 아님)로 산출해 `generated/housings.json`에 싣는다. GIS 미커버(수영구 밖) 후보의 상권 특징은 0점이 아니라 `null`.
- **교체점 정의**: 실데이터 도착 시 바꾸는 것은 ①`data/source/`의 CSV ②(포맷이 다르면) 해당 유형 어댑터뿐. [2]~[5]와 앱은 무변경.

---

## 4. 백엔드 하네스 (P2)

- **모듈 골격(NestJS)**: `auth · users · housings · pois · recommend · search · notifications` (backend/README 예정 구성과 일치).
- **DB 접근**: canonical 3엔티티를 테이블화 → `complexes`(housings)·`housing_units`·`housing_pricing`(qualifier: 공급계층·소득구간·가구인원수·보호구분)·상권 GIS(`commerce_pois`·`industry_density`·`commercial_zones`, geometry)·`favorites`·`applications`·`user_qualifications`·`preferences`.
- **지리연산**: PostGIS `ST_DWithin`/`ST_Distance` + GiST 인덱스로 반경 내 상권·POI·뷰포트 조회.
- **계약 우선**: OpenAPI(Swagger) 자동 문서 → FE 타입 생성. `packages/shared-types`를 단일 원천으로 FE·BE·인제스천이 같은 타입을 본다.

---

## 5. 프론트 하네스

- **현재**: React 18 + Vite(JS), 라우터·TS 없음, `store.jsx` 단일 Context, `data.js` 목데이터.
- **목표 골격(P1)**:
  - 라우팅: `state.screen` → react-router URL 라우트.
  - 상태: 서버데이터 = TanStack Query / UI상태 = Zustand.
  - **API 레이어(`src/api`) + MSW 목서버** — 백엔드 없이도 P0 산출 JSON·목응답으로 실제 데이터 흐름 개발. 백엔드 완성 시 baseURL만 전환.
  - 디자인 토큰화로 인라인 `css()` 제거.
- **데이터 소스 전환 경로**: `generated/housings.json`(P0) → MSW 목(P1) → 실 API(P2). UI는 스키마 고정이라 소스만 갈아끼운다.

---

## 6. 테스트·품질 하네스

| 층위 | 도구 | 검증 대상 |
|---|---|---|
| 정적 | ESLint·Prettier·tsc(strict) | 린트·타입 (P1-B) |
| 인제스천 | 변환 유닛 테스트 | 샘플 6종 CSV 전 행이 canonical에 손실 없이 매핑 (P0-A-2) |
| 단위 | Vitest + RTL | 핵심 컴포넌트·스코어링 함수 |
| 스코어링 | 골든 테스트 | 실후보 표본의 고정 거리감쇠 점수 수기계산 재현 (`tag/test/pipeline.test.mjs`) |
| E2E | Playwright | 로그인→추천→상세 플로우 |

성공 기준은 각 단계에 걸린 **검증 기준**(PRODUCTION_PLAN의 "→ 검증:")을 그대로 테스트로 승격한다.

---

## 7. CI/CD 하네스

- **현재**: `main` 푸시 시 GitHub Actions로 `frontend/dist`를 GitHub Pages 배포.
- **확장(P7-A)**: `lint → typecheck → test → build` 파이프라인 추가, 인제스천 산출물 검증 포함. 백엔드 도입 시 컨테이너 이미지 빌드·환경별(스테이징→프로덕션) 배포·DB 마이그레이션 자동화로 확장.
- **환경 분리**: 데모(로컬 compose) / 스테이징 / 프로덕션. 시크릿은 코드 밖(Actions Secrets → 운영 Secrets Manager).

---

## 8. 끝단 데이터 흐름 (한눈에)

```
[BMC 주택 CSV]→어댑터→canonical→집계→지오코딩→ housings.json ─┐
                                                             ├→ 프론트(지도·리스트·상세)
[선도소프트 상권 GIS(SHP, 좌표내장)]→어댑터→ 상권 레이어 ─┐      │
[외부 공개데이터(공원·교통)]→ETL→ POI ────────────────┤      │
                                                     ├→ 스코어링(PostGIS) ┘
[사용자 취향·조건] ──────────────────────────────────┘   → 추천 결과 + 근거 필드
```

실데이터가 들어오는 지점은 **왼쪽 끝 소스들(BMC 주택 CSV · 선도소프트 상권 GIS · 외부 보강 POI)뿐**이고, 그 뒤 정규화·지리연산·추천·UI는 스키마로 고정돼 있어 소스 교체만으로 끝단까지 반영된다 — 이것이 이 하네스의 목적이다. 주택 CSV는 좌표가 없어 지오코딩을 거치지만, 상권 GIS는 좌표가 내장돼 어댑터에서 좌표계 변환(→EPSG:4326)만 거친다.
