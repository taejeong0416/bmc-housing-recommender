# BMC 주택 추천 서비스

> **상권·취향 기반 공공임대주택 추천 서비스**
> 부산도시공사(BMC) × ㈜선도소프트 글로벌 데이터 해커톤(2026.07) 출품작.

내가 자주 가는 카페·헬스장·편의점이 가까운 임대주택은 어디일까 — 면적·보증금 같은 정량 조건만 나열하는 기존 공고 방식을 넘어, **시민이 선호하는 생활 인프라(상권·편의시설·문화공간)와 취향을 반영해 공공임대주택을 추천**하는 지도 기반 웹 서비스입니다.

## 왜 만드는가

- 부산은 최근 10년간 약 24만 명이 감소하며 지역 소멸 위기에 놓여 있고, 낮은 소득 대비 과도한 주거비로 시민이 외곽으로 이탈하고 있습니다.
- 정작 **공공임대 당첨자의 입주 포기율은 약 50%**. 원인은 공급자 중심의 일방향 정보 — 시민이 실제로 살 때 체감하는 주변 상권·편의시설 정보가 빠져 있고, 개인 라이프스타일 기반 추천이 없습니다.
- 이 서비스는 **"공급자 → 수요자" 관점 전환**으로 그 간극을 메워 입주 포기율을 낮추는 것을 목표로 합니다.

## 무엇을 하는가

- **취향 온보딩** — 카페·편의점·헬스장·문화공간·공원·교통·조용함 등 생활 인프라 취향과 가중치를 입력받습니다.
- **지도 기반 탐색** — 부산 지도(Naver Maps) 위에 임대주택을 개수 클러스터로 표시하고, 화면에 보이는 매물을 리스트와 연동합니다.
- **취향 가중 추천 + 설명가능성** — 입력한 취향에 맞춰 단지를 스코어링하고, `"카페·편의점 밀집 상위 4%"`처럼 **추천 근거를 사람이 읽을 수 있는 문장으로 제시**합니다.
- **AI 자연어 검색** — `"보증금 3천만원 미만이면서 5년 이내 신축"`, `"역세권 10분 이내"` 같은 문장을 구조화 필터로 변환해(Gemini) 지도에 적용합니다. 관심목록·설정 조건을 반영한 개인화 제안도 지원합니다.
- **관심목록·조건저장** — 마음에 드는 단지를 찜하고 취향·필터 조건을 저장·복원합니다.

## 데이터가 핵심

두 발제사 데이터를 추천 파이프라인에 실제로 관통시키는 것이 이 서비스의 본질입니다.

- **부산도시공사(BMC) — 주택 데이터(CSV)**: 행복·통합·재개발·매입임대 주택정보와 유형별 보증금·임대료. CP949 인코딩·좌표 없음 → 지오코딩으로 위경도를 붙여 지도에 올립니다.
- **㈜선도소프트 — 상권 GIS(SHP)**: 상가-건물 융합정보, 5대 업종-인구 밀집도, 상권·용도지역 융합정보. 좌표가 내장돼 PostGIS 공간연산(`ST_DWithin`)으로 각 단지 주변 상권을 점수화하는 **추천 근거 1차 소스**입니다.
- **외부 공개데이터**: GIS가 덮지 않는 축(공원·교통 등)은 공공데이터포털 데이터로 보강합니다.

> 실데이터 교체점은 **`data/source/`의 CSV + 유형별 어댑터 한 곳**뿐입니다. 실데이터가 도착하면 파일 교체 + 스크립트 1회 실행으로 반영되고, 그 뒤 단계·UI는 무변경입니다.

## 데이터 공개 정책

이 저장소는 공개돼 있고, **발제사 제공 데이터와 그 파생물은 올리지 않습니다.** 대회 제공 데이터(BMC 주택 CSV, 선도소프트 상권 GIS)가 재배포되지 않도록 하기 위한 것입니다.

비커밋 대상(`.gitignore`):

| 경로 | 내용 |
|---|---|
| `data/source/`, `발제사 제공자료/` | 원천 CSV·SHP |
| `frontend/src/generated/{housings,preference-features,listing-tags}.json` | 인제스천·태그 파이프라인이 만드는 실데이터 |
| `tag/output/`, `data/enrich/physical-tags.csv` | 태그 파이프라인 산출물 |
| `tag/data/contracts/notice_rules.json` | 모집공고에서 정리한 자격 규칙(스키마 예시는 `notice_rules.example.json`) |
| `docs/발제사_과제설명.md` | 발제 과제 원문 |

대신 **합성 데모 데이터**(`frontend/src/demo/`)를 커밋해 두어, 클론 직후 실데이터 없이도 앱이 그대로 동작합니다. `npm install`이 이를 `frontend/src/generated/`로 복사합니다(이미 파일이 있으면 덮어쓰지 않습니다). 수동 실행은 `npm run seed:demo`, 픽스처 재생성은 `npm run gen:demo-fixtures`입니다.

문서에 나오는 예시 단지명·도로명주소는 가상값입니다. `npm test`는 실데이터가 없는 환경에서 그것에 의존하는 조인 검증만 건너뛰고 나머지 규칙 검증은 그대로 돕니다.

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트 | React + Vite + TypeScript, react-router, TanStack Query, Zustand, Tailwind CSS v4 |
| 지도 | Naver Maps JS API (NCP) |
| 백엔드 | NestJS, Prisma, PostgreSQL + PostGIS |
| AI | Gemini API (자연어 → 구조화 필터) |
| 인프라 | Docker Compose, npm workspaces 모노레포 |

인프라 스택 결정 근거는 [`docs/STACK_DECISION.md`](docs/STACK_DECISION.md)를 참고하세요.

## 구조

```
├── frontend/              # React + Vite 웹 클라이언트 (Naver 지도, Gemini NL 검색)
│   └── src/demo/          # 합성 데모 데이터 (커밋 대상 — 실데이터 없이 앱을 돌리는 기본값)
├── backend/               # NestJS API 서버 (Prisma + PostgreSQL/PostGIS)
├── packages/
│   └── shared-types/      # canonical 스키마·도메인 타입 단일 원천 (@bmc/shared-types)
├── scripts/
│   ├── ingest/            # 원천 CSV·GIS → 앱 데이터 변환 파이프라인
│   └── demo/              # 데모 데이터 생성기
├── data/
│   ├── source/            # 원천 CSV (CP949, 비커밋)
│   ├── cache/             # 지오코딩 캐시
│   └── out/               # 중간 산출물 (DB 시드 입력, 비커밋)
├── docs/                  # 플랜·결정·설계 문서
│   ├── PRODUCTION_PLAN.md   # 프로덕션 전환 로드맵 (P0~P7, 상태 마커 — 진행 단계의 단일 원천)
│   ├── STACK_DECISION.md    # 인프라 스택 결정 기록 (self-host 채택)
│   ├── HARNESS_DESIGN.md    # 프로젝트 하네스(골격) 설계도
│   ├── RECOMMENDER_DESIGN.md # 추천 로직 정본 (공식·파라미터·API 계약)
│   ├── DATA_SCHEMA.md       # 원천 CSV·GIS 스키마와 정규화 규칙
│   └── DESIGN_CONTEXT.md    # 디자인 방향·브랜드 톤·디자인시스템 기준
└── docker-compose.yml     # 로컬·시연 단일 진입점 (db·api·redis)
```

## 개발

### 프론트엔드 단독

```bash
npm install          # 루트에서 워크스페이스 전체 설치 (합성 데모 데이터도 함께 배치됩니다)
npm run dev          # frontend Vite 개발 서버
```

발제사 데이터가 없어도 합성 데모 데이터로 전체 화면이 동작합니다 — [데이터 공개 정책](#데이터-공개-정책) 참고.

### 풀스택 로컬 실행 (Docker)

```bash
docker compose up -d db      # PostGIS 기동 (호스트 55432 → 컨테이너 5432)
docker compose up api        # NestJS API (http://localhost:3000)
```

자연어 검색(`/api/search/nl`)은 `GEMINI_API_KEY` 환경변수가 필요합니다(미설정 시 503으로 설정 안내). 지도는 `VITE_NAVER_MAP_CLIENT_ID`가 필요합니다. `.env.example` 참고.

## 데이터 인제스천

원천 CSV는 `data/source/`(CP949, 좌표 없음)에 두고, 유형별 어댑터만 교체하면 이후 단계는 무변경입니다.

```bash
npm run ingest       # data/source CSV → 지오코딩 → 앱 데이터 산출
npm run ingest:gis   # 선도소프트 상권 GIS(SHP) → 상권 데이터 산출
```

산출물 `frontend/src/generated/housings.json`이 앱이 읽는 실데이터이며, `data/out/canonical.json`은 DB 시드 입력입니다. 둘 다 비커밋이라 실행한 로컬에만 생깁니다.

## 배포

호스팅 배포 설정은 두지 않습니다. 로컬 실행(위 개발 항목)과 `docker compose`가 실행 경로입니다.

## 문서

진행 단계·완료/잔여 현황은 [`docs/PRODUCTION_PLAN.md`](docs/PRODUCTION_PLAN.md)의 로드맵 표(P0~P7)가 단일 원천입니다. 대회 맥락·평가 기준을 담은 `docs/발제사_과제설명.md`는 발제 과제 원문이라 저장소에 포함하지 않습니다.
