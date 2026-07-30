# 팀 태그 산출물 A~D — 서비스 통합 결과 보고

**작성:** 태정 · **일자:** 2026-07-24 · **대상:** 팀 전체
**관련 커밋:** A `61b6918` · B `1c69523` · C·D `5f85e62`,`405c8c4`

4개 분야(A 자격·유형 / B 주거물리 / C 입지·교통 / D 상권·생활환경) 태그 산출물을 검토해 **하나의 추천 파이프라인으로 통합**했다. 각 산출물을 통째로 넣은 게 아니라, 우리 데이터·엔진에 없는 신호만 흡수하고 중복은 버렸으며, 실데이터 확장 시 같은 체인이 자동 반영되도록 배선했다.

---

## 1. 한눈에

| 분야 | 담당 | 성격 | 통합 방식 | 우리 필드 | 커버리지 |
|---|---|---|---|---|---|
| **A. 자격·유형** | 태정(자체) | 하드컷 필터 | canonical에서 파생 | `qualifications: string[]` | 실단지 41 |
| **B. 주거물리** | 팀원 | 배지·선택적 하드 | 신규 신호만 harvest | `physicalTags: string[]` | 유형단지 3(K-apt 등재) |
| **C. 입지·교통** | 팀원 | 소프트 스코어 | tagScores 축 + 배지 | `tagScores.transit` | 수영구 39(GIS 커버) |
| **D. 상권·생활** | 팀원 | 소프트 스코어 | tagScores 축 + 세분 | `tagScores.{cafe…park,calm}` | 수영구 39(GIS 커버) |

> **두 종류의 태그:** A·B는 **문자열 태그**(포함/제외·배지), C·D는 **연속 점수축**(추천 랭킹용 tagScores). 성격이 달라 필드도 다르게 붙였다.

---

## 2. 분야별 통합 내역

### A. 자격·유형 (자체 작업)
- **소스:** 발제사 원천 CSV(유형·공급계층). 조사·수기 아니라 **파생**.
- **흡수:** 유형 태그 + 공급계층(청년·신혼부부 등) + 유형 제도규칙(소득150이하 등).
- **위치:** `scripts/ingest/qualifications.ts` · 정본 `docs/QUALIFICATION_TAGS.md`.

### B. 주거물리 (팀원)
- **소스:** K-apt·건축물대장·공고문(팀원이 `btag.py`로 태깅).
- **흡수(12종):** 난방·복도·지하주차·전기차·CCTV·부대시설 — **K-apt가 여는 신규 신호만**.
- **제외(순수 중복):** 방수·면적·세대규모·연식·승강기·층·비용 — 우리가 이미 같은 발제사 CSV에서 파생 중(같은 값 확인 완료).
- **후속:** 공고문 옵션(주택형 입도)·건물형태·건축물대장 값 보정.
- **위치:** `scripts/ingest/physical-tags.ts` · `data/enrich/physical-tags.csv` · 정본 `docs/PHYSICAL_TAGS.md`.

### C. 입지·교통 (팀원)
- **소스:** 부산교통공사 도시철도역사(외부 공개데이터).
- **흡수:** `metro_access` → `tagScores.transit`(우리가 비워둔 축). 배지 초역세권 10·역세권 23·환승 25.
- **후속:** 버스(C도 미확보)·경사·도로입지·직주근접(동적).
- **위치:** `scripts/demo/gen-location-transport-tags.mjs` · 정본 `docs/LOCATION_TRANSPORT_TAGS.md`.

### D. 상권·생활환경 (팀원)
- **소스:** 선도소프트 GIS(우리가 이미 적재) + 도시공원(외부 공개데이터).
- **흡수:** cafe·gym·cvs·culture·shop·quiet·park·calm → `tagScores`(우리 축), + 세분 POI(마트·시장·세탁·외식·야간활력)는 `tags.ts`에 CMSC 매핑 추가해 사이드카 산출.
- **핵심:** D는 **우리 추천 엔진(RECOMMENDER §2)과 같은 감쇠식+백분위**를 써서 정합이 자연스러웠음. 중복축(카페·상권 등)은 우리 축으로 매핑, 신규 park는 null이던 축을 채움.
- **위치:** `scripts/demo/gen-lifestyle-tags.mjs` · `scripts/ingest/gis/tags.ts` · 정본 `docs/LIFESTYLE_TAGS.md`.

---

## 3. 데이터 소스 총정리

| 소스 | 분야 | 제공/외부 | 리포 반영 |
|---|---|---|---|
| 발제사 주택정보·보증금임대료 CSV | A·B | 발제사 | ✅ canonical |
| 선도소프트 상가·인구·상권 GIS | D | 발제사 | ✅ `ingest:gis` |
| K-apt 공동주택 기본정보 | B | 외부(k-apt.go.kr) | ◐ B 산출 CSV로 흡수(raw 어댑터는 후속) |
| 건축물대장(세움터) | B | 외부 | ⬜ 후속(주차·연식 보정) |
| 입주자모집 공고문 | B | 발제사 | ⬜ 후속(옵션, 주택형 입도) |
| 부산교통공사 도시철도역사 | C | 외부(data.go.kr) | ✅ 로컬 원천 + 산출 |
| 전국도시공원 표준데이터(부산) | D | 외부(data.go.kr) | ✅ 로컬 원천 + 산출 |

> 외부 원천 CSV는 발제사 데이터와 동일하게 **로컬 보관**(gitignore). 커밋되는 건 산출물(`housings.json`·사이드카 JSON).

---

## 4. 지금 되는 것 / 남은 것

**됨:** A~D 전부 재현 가능한 파이프라인으로 편입. `housings.json`에 A(qualifications)·B(physicalTags) 태그와 C·D의 tagScores(수영구 39)가 실값으로 들어감. 부산 전체 데이터가 오면 같은 체인이 자동 반영.

**남은 것 (별도 결정·데이터 필요):**
- **랭킹 활성화** — 로컬 데모가 tagScores로 실제 Σw·P 순위를 매기려면 `applyPrefs`에 가중랭킹 추가(현재 하드필터 전용, 팀이 백엔드로 보류).
- **화면 표시** — 카드·상세에 배지(초역세권 등)·tagScores 노출 배선(+`scoreSource` 게이트).
- **백엔드 엔진** — `score.ts`가 transit·park 계산하려면 외부 CSV를 PostGIS 적재(DB 기동 필요).
- **B 후속** — 공고문 옵션·건축물대장 보정·raw K-apt 어댑터.
- **버스** — C는 도시철도만, 버스정류소 미확보.

---

## 5. 재현 방법 (전체 체인)

```bash
npm run ingest                       # 발제사 CSV → 실단지 41 + A·B 태그
npm run gen:demo                     # 데모 매물 280 병합
npm run ingest:gis                   # 선도소프트 GIS 적재(D POI 포함)
npm run gen:location-transport-tags  # C 산출(사이드카)
npm run gen:lifestyle-tags           # D 산출(사이드카)
npm run gen:tag-scores               # C·D → housings.tagScores 병합
```

> ⚠ `ingest`는 첫 단계라 단독 실행 시 이후 병합분(데모·C·D)이 날아간다. housings.json을 건드리면 **전체 체인**을 순서대로 돌리고 `git diff --stat`으로 대량 삭제가 없는지 확인.

**산출물 위치**
- 앱 데이터: `frontend/src/generated/housings.json`(A·B 태그 + C·D tagScores)
- 사이드카: `frontend/src/generated/{location-transport,lifestyle}-tags.json`(배지·근거·세분태그)
- 정본 문서: `docs/{QUALIFICATION_TAGS,PHYSICAL_TAGS,LOCATION_TRANSPORT_TAGS,LIFESTYLE_TAGS}.md`

---

**한 줄 정리:** A~D 네 팀 산출물을 하나의 추천 파이프라인으로 통합. 중복은 버리고(같은 데이터), 우리가 비운 축(transit·park)과 신규 신호(K-apt 설비·세분 상권)를 채웠으며, 실데이터 확장에 자동 대응하도록 배선했다.
