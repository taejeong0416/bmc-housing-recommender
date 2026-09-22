# Be:live — 취향 기반 공공임대주택 추천

**바로 써보기 → https://bmc-housing.pages.dev**

> 부산도시공사(BMC) × ㈜선도소프트 글로벌 데이터 해커톤(2026.07) 출품작.
> 면적·보증금 같은 정량 조건만 나열하던 기존 공고와 달리, **생활 인프라(상권·편의시설·교통·공원)와 개인 취향을 반영해 공공임대주택을 추천**하는 지도 기반 웹 서비스.

부산 전역 **355개 단지**(15개 구·군)를 선도소프트 상권 GIS와 공간 결합해서, 자주 가는 카페·헬스장·역이 가까운 임대주택을 찾아 준다.

## 빠른 시작

```bash
npm install     # 워크스페이스 설치 + 합성 데모 데이터 자동 배치
npm run dev     # Vite 개발 서버 (프론트 단독)
```

발제사 실데이터 없이도 **합성 데모 데이터**로 전 화면이 동작한다([데이터 공개 정책](#데이터-공개-정책)).
지도를 보려면 `frontend/.env.local`에 `VITE_NAVER_MAP_CLIENT_ID`가 필요하다(`frontend/.env.example` 참고).

| 명령 | 용도 |
|---|---|
| `npm run dev` / `build` / `test` | 개발 서버 · 빌드 · Vitest |
| `npm run lint` / `typecheck` | ESLint · tsc |
| `npm run seed:demo` | 합성 데모 데이터를 `generated/`에 재배치 |
| `npm run ingest` / `ingest:gis` | 원천 CSV·GIS → 앱 데이터 (실데이터 보유 시) |

## 주요 기능

- **취향 학습(pairwise)** — 가중치를 직접 조절하는 대신, 가상 매물 A/B 비교를 반복해 8개 생활 취향축의 가중치를 추정한다. 첫 진입에서는 간단한 성향 질문으로 프리필한다.
- **지도 기반 탐색** — 부산 지도(Naver Maps) 위에 단지를 개수 클러스터로 표시하고 화면에 보이는 매물을 리스트와 연동한다.
- **설명 가능한 추천** — 추정된 취향으로 단지를 스코어링하고 `"가까운 역 서면역 직선 320m"`, `"주변 시설 12곳"`처럼 **점수 기여도가 가장 큰 축을 실제 거리·개수 근거와 함께** 제시한다.
- **AI 자연어 검색** — `"보증금 3천만원 미만이면서 5년 이내 신축"` 같은 문장을 Claude(Sonnet 5)로 구조화 필터로 변환해 지도에 적용한다. 관심목록·취향을 반영한 개인화 제안과 멀티턴 되묻기를 지원한다.
- **관심목록·조건 저장** — 계정 없이 브라우저 로컬에 찜과 필터 조건을 보관한다. 수집·보관하는 개인정보가 없다.

## 만든 배경

- 부산은 최근 10년간 약 24만 명이 감소하며 지역 소멸 위기에 놓여 있고 소득 대비 과도한 주거비로 시민이 외곽으로 이탈하고 있다.
- 정작 **공공임대 당첨자의 입주 포기율은 약 50%**. 원인은 공급자 중심의 일방향 정보다. 실제 거주 시 체감하는 주변 상권·편의시설 정보가 빠져 있고 라이프스타일 기반 추천이 없다.
- 이 서비스는 공급자 중심의 정보를 **수요자 관점**으로 바꿔서 입주 포기율을 낮추는 것을 목표로 한다.

## 사용 데이터

추천 근거는 두 발제사가 제공한 데이터에서 나온다.

| 소스 | 데이터 | 처리 |
|---|---|---|
| **부산도시공사(BMC)** | 주택정보 2종 + 유형별 보증금·임대료 4종 (CSV) | CP949 디코딩 · 좌표 없음 → 지오코딩(VWorld 1차, Kakao 보조)으로 위경도 부여 |
| **㈜선도소프트** | 상가-건물 융합, 5대 업종-인구 밀집도, 상권·용도지역 융합 (SHP) | 좌표 내장 → PostGIS 공간연산(`ST_DWithin`)으로 단지 주변 상권 점수화. **추천 근거의 1차 소스** |
| **외부 공개데이터** | 공원·도시철도·의료·대학 등 | GIS가 덮지 않는 축을 `tag/` 파이프라인에서 보강 |

> 실데이터 교체점은 **`data/source/`의 CSV + 유형별 어댑터 한 곳**뿐이다. 파일 교체 + 스크립트 1회 실행으로 반영되고 그 뒤 단계·UI는 무변경이다.

## 데이터 공개 정책

이 저장소는 공개돼 있고 **발제사 제공 데이터와 그 파생물은 커밋하지 않는다.** 대회 제공 데이터가 재배포되지 않게 하기 위해서다.

| 비커밋 경로 | 내용 |
|---|---|
| `data/source/`, `발제사 제공자료/` | 원천 CSV·SHP |
| `frontend/src/generated/{housings,preference-features,listing-tags}.json` | 인제스천·태그 파이프라인 산출 실데이터 |
| `tag/output/`, `data/enrich/physical-tags.csv` | 태그 파이프라인 중간 산출물 |
| `tag/data/contracts/notice_rules.json` | 모집공고 자격 규칙(스키마 예시는 `notice_rules.example.json`) |
| `docs/발제사_과제설명.md` | 발제 과제 원문 |

대신 **합성 데모 데이터**(`frontend/src/demo/`)를 커밋해 클론 직후 실데이터 없이도 앱이 그대로 동작한다. `npm install`이 이를 `frontend/src/generated/`로 복사한다(기존 파일은 덮어쓰지 않음). 수동 실행은 `npm run seed:demo`, 픽스처 재생성은 `npm run gen:demo-fixtures`.

문서에 나오는 예시 단지명·도로명주소는 가상값이다. `npm test`는 실데이터가 없는 환경에서 그에 의존하는 조인 검증만 건너뛰고 나머지 규칙 검증은 그대로 돈다.

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트 | React + Vite + TypeScript, react-router v7, TanStack Query, Zustand, Tailwind CSS v4 |
| 지도 | Naver Maps JS API (NCP) |
| AI | Claude API (`claude-sonnet-5`) — 자연어 → 구조화 필터. 실패 시 Gemini API(`gemini-flash-latest`) 폴백 |
| 백엔드(개발·검증용) | NestJS, Prisma, PostgreSQL + PostGIS, Docker Compose |
| 배포 | Cloudflare Pages 정적 배포 + Pages Function 1개 |
| 파이프라인 | csv-parse + iconv-lite(CP949), shpjs, zod, Node 스크립트 |

## 폴더 구조

```
├── frontend/                # React + Vite 웹 클라이언트 (배포 런타임)
│   └── src/
│       ├── onboarding/      # pairwise 취향학습 · 프리필 · 가상 시나리오
│       ├── screens/         # 랜딩·홈·지도·상세·관심목록·AI검색
│       ├── demo/            # 합성 데모 데이터 (커밋 — 실데이터 없이 돌리는 기본값)
│       └── generated/       # 파이프라인 산출 실데이터 (비커밋)
├── functions/api/search/    # Cloudflare Pages Function — NL 검색 프록시(API 키 은닉)
├── backend/                 # NestJS API 서버 (Prisma + PostGIS) — 개발·검증용
├── tag/                     # 태그·피처 산출 파이프라인 (자격·물리·교통·생활 + 결합태그)
├── packages/shared-types/   # canonical 스키마·도메인 타입 단일 원천 (@bmc/shared-types)
├── scripts/
│   ├── ingest/              # 원천 CSV·GIS → 앱 데이터 변환
│   └── demo/                # 합성 데모 데이터 생성기
├── data/                    # source(원천) · cache(지오코딩) · out(DB 시드 입력) — 모두 비커밋
├── docs/                    # 플랜·결정·설계 문서
└── docker-compose.yml       # 로컬 풀스택 (db · api · redis)
```

## 데이터 인제스천

원천 CSV를 `data/source/`에 두고 실행한다. 지오코딩 키는 루트 `.env`(`.env.example` 참고)에 둔다.

```bash
npm run ingest       # 주택 CSV → 지오코딩 → 앱 데이터
npm run ingest:gis   # 선도소프트 상권 GIS(SHP) → 상권 데이터
```

산출물 `frontend/src/generated/housings.json`이 앱이 읽는 실데이터이고 `data/out/canonical.json`은 DB 시드 입력이다. 둘 다 비커밋이라 실행한 로컬에만 생긴다.

## 배포와 로컬 실행

**배포(운영)** — https://bmc-housing.pages.dev · Cloudflare Pages 정적 배포.

앱이 서버 없이 완결된다. 단지 데이터가 번들에 실리고 MSW가 브라우저 안에서 `/api/housings`를 응답하며 취향 적합도 랭킹도 브라우저에서 계산한다. 런타임에 서버가 필요한 곳은 **AI 자연어 검색 하나뿐이고 이유는 연산이 아니라 API 키 은닉**이다. `functions/api/search/nl.ts`(Pages Function)가 그 역할을 한다.

```bash
npm run deploy       # 빌드 + wrangler pages deploy
```

배포 전 준비:

- `frontend/public/_redirects`에 `/* /index.html 200` — SPA 딥링크 처리.
- `frontend/.env.production` — `VITE_AI_PROXY=1`, `VITE_NAVER_MAP_CLIENT_ID`. **`VITE_API_BASE_URL`은 설정하지 않는다**(설정하면 MSW가 꺼져 목록이 빈다). AI 키는 프론트 환경변수에 두지 않는다.
- 런타임 시크릿 — `npx wrangler pages secret put ANTHROPIC_API_KEY`. 폴백을 쓰려면 `GEMINI_API_KEY`도 넣는다. 모델을 바꿀 때만 `ANTHROPIC_MODEL`·`GEMINI_MODEL`을 설정한다.
- **NCP 콘솔에 배포 도메인 등록** — 누락하면 지도가 뜨지 않는다.
- Claude Console(Settings → Limits)에서 월 사용 한도를 설정한다. `pages.dev` 도메인에는 Cloudflare Rate limiting 규칙을 걸 수 없어서 AI 비용 상한은 이 한도가 담당하고, 한도를 넘으면 Gemini 폴백으로 동작한다. 폴백 여부는 `npx wrangler pages deployment tail --project-name=bmc-housing` 로그의 `[nl-search]` 줄로 확인한다.

배포 후 확인: `/map` 새로고침 무오류 · 지도 마커 표시 · 목록 355건 · AI 검색 조건 칩 생성 · 번들에 `sk-ant`·`AIza` 문자열 부재(키 미노출).

**풀스택 로컬(개발·검증)** — 백엔드·PostGIS 경로를 확인할 때만 쓴다.

```bash
docker compose up -d db    # PostGIS (호스트 55432 → 컨테이너 5432)
docker compose up api      # NestJS API (http://localhost:3000)
```

프론트에서 실백엔드를 쓰려면 `VITE_API_BASE_URL`을 설정한다. 비워 두면 MSW 목서버가 `generated/housings.json`을 서빙한다. 자연어 검색은 `backend/.env`에 `ANTHROPIC_API_KEY`와 `GEMINI_API_KEY`가 모두 없으면 503으로 설정을 안내한다.

## 문서

구현 범위·완료/잔여 현황은 [`docs/PRODUCTION_PLAN.md`](docs/PRODUCTION_PLAN.md) §3 구현 현황 표가 단일 원천이다.

| 문서 | 내용 |
|---|---|
| [`PRODUCTION_PLAN.md`](docs/PRODUCTION_PLAN.md) | **구현 현황 P0~P7** · 문제 정의 · 아키텍처 · 기술 선택 |
| [`공공임대_취향추천_최종기획안.md`](docs/공공임대_취향추천_최종기획안.md) | 추천 로직 정본 — 공식·피처·응답 계약 |
| [`tag/최종_태그_체계_및_산출가이드.md`](tag/최종_태그_체계_및_산출가이드.md) | 태그 체계·산출 규칙 |
| [`DATA_SCHEMA.md`](docs/DATA_SCHEMA.md) | 원천 CSV·GIS 스키마와 정규화 규칙 |
| [`데이터_전처리_품질보고서.md`](docs/데이터_전처리_품질보고서.md) · [`최종_데이터_분석_및_태그_확정.md`](docs/최종_데이터_분석_및_태그_확정.md) | 전처리 결과·품질 / 데이터 분석과 태그 확정 근거 |
| [`DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | 브랜드 톤·카피 원칙 · 토큰·컴포넌트·상태 규격 |

대회 맥락·평가 기준을 담은 `docs/발제사_과제설명.md`는 발제 과제 원문이라 저장소에 포함하지 않는다.
