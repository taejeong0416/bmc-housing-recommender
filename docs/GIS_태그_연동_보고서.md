# 팀원 tag 파이프라인·geocode 좌표 연동 보고서

> 팀원 최신 tag 파이프라인(feat/abtest)을 main에 편입하고, geocode 로컬 좌표 체인을 이어
> main 자체 인제스천에서 취향 태그가 완전 재현되도록 한 기록.
> 대상: 부산 355단지·15개 구 · 커밋: `d0f0895`(tag) · `5a5d77a`(geocode/좌표)
> 검증: ingest 39/39 · tag pipeline 10/10 · 프론트 tsc 통과

## 요약

| 지표 | 값 |
|---|---|
| 좌표 확보 | **355 / 355** (미확보 0) |
| 좌표 품질등급 | 정확주소 59 · 동일도로 근사 246 · 분기도로 기준점 50 |
| GIS 커버리지 | 355 / 355 (dGisCovered 355) |
| C/D 커버리지 단계 | C/D 기본 355 → 인구격자·용도지역 완전 208 → 정밀 개인화 179 |
| 취향추천 완전근거 후보 | 179 (208 중 저신뢰 road_anchor 제외) |
| 주소 포인트(선도소프트 건물) | 67,938건 |
| 지오코딩 방식 | 주소 반출 없는 **로컬 결합** (외부 API 미사용) |

---

## 1. 편입 대상 — 두 층

팀원이 넘긴 스냅샷 중 **데이터 전처리 + 태그**만 대상으로 편입했다. 앱(ai·search·UI)은 무변경.

- **tag 파이프라인**(`tag/`): A(자격)·B(주거물리)·C(입지·교통)·D(생활환경)·결합태그 산출, 가이드, 의료 접근 축(`pharmacy_access`·`primary_care_access`·`medical_daily_access`·`emergency_access`), 자격 표시 포맷.
- **좌표 전처리**(`scripts/ingest`·`gis`·`geocode`): 주소 → 좌표 로컬 결합과 품질등급.

---

## 2. 핵심 문제 — tag는 좌표 전처리에 커플링돼 있다

tag 코드는 단독으로 돌지 않았다. main 위에서 tag만 돌리면 좌표가 **전부 unknown**으로 붕괴하고 `dGisCovered`가 0이 됐다. 원인을 아래로 추적하니 의존 체인이 드러났다.

```
tag 좌표(dGisCovered)
  ← canonical.coordinateAccuracy
    ← geocode 로컬 인덱스
      ← gis.json.addressPoints
        ← gis 파이프라인
```

main의 `canonical.json`엔 `coordinateAccuracy` 필드가 없었고, `gis.json`엔 `addressPoints`가 없었다. 각 층이 팀원 쪽에서만 생산됐기 때문이다.

---

## 3. 해결 — 체인을 층별로 이어붙임

| 층 | 조치 |
|---|---|
| **shared-types** | `Complex`·`GeneratedHousing`에 `coordinateSource`·`coordinateAccuracy`(optional·nullable) 추가 → 좌표 등급이 canonical에 실림 |
| **gis 파이프라인**(`gis/index·tags·proj`) | 선도소프트 상가-건물에서 **주소 포인트 67,938건** 산출(옛 main엔 없던 `addressPoints`). KSIC 업종 매핑은 유지(POI 수치 동일) |
| **geocode** | 주소를 외부로 보내지 않는 **로컬 결합**: ①건물 정확주소 ②같은 도로 근접 ③`○○로173번길`→`○○로 173` 분기점. 품질등급을 남김 |
| **aggregate / index** | 좌표 필드 역전파 + 완전중복 호(32)·가격(1) dedup. **A/B harvest glue(`qualifications`·`physical-tags`)는 보존** |

### 캐시 함정
옛 `data/cache/geocode.json`(구 API 좌표)이 도로 근사 매칭을 가려 등급이 unknown으로 남았다. 재산출 시 캐시를 비우면 로컬 도로 인덱스가 정상 작동한다.

---

## 4. 결과

### 좌표 품질등급 (355단지 전부, 미확보 0)

| 등급 | 건수 | 의미 |
|---|--:|---|
| `exact_address` | 59 | 건물 정확주소 일치 |
| `road_nearest` | 246 | 같은 도로 근접 건물 |
| `road_anchor` | 50 | 분기도로 기준점(저신뢰) |

### tag 재산출 (main 자체 파이프라인)

| 지표 | 값 |
|---|--:|
| dGisCovered | 355 / 355 |
| preferenceReadyHousings | 179 |
| aHousings · aOffers | 355 · 4,398 |

`node tag/src/run-all.mjs` 산출이 팀원 summary와 일치(좌표등급·커버리지·완전근거 후보).

---

## 5. 편입하지 않은 것 · 후속

- **어댑터(`typed-units`·`maeip-pricing`)는 main 유지.** main이 자체 개선한 것과 양방향 분기라 팀원 것으로 덮으면 ingest 테스트 18개가 회귀한다. 어댑터 재조정은 데이터 세션과 함께.
  - 이로 인해 tag/output을 **재산출**하면 미래 준공일(`2032-10-31`) 주택 1건 등 미세 델타가 생긴다(현 커밋 output은 팀원 authoritative 유지, 테스트 통과).
- **의료 태그는 전 후보 산출되지만 앱에는 미연결.** `pharmacy_access`·`primary_care_access`·`medical_daily_access`·`emergency_access`는 355개 후보 전부에 대해 `tag/` 파이프라인이 산출한다. 다만 프론트 추천모델은 8축 가중치 벡터를 전제(온보딩·추천)라, 선택형 의료축을 shared-types·프론트에 연결하는 것은 별도 구현 과제로 남겼다. 현재는 좌표 필드만 최소 편입했다.
- **앱 glue(`qualifications`·`physical-tags`) 무변경** — 팀원 산출물을 canonical에 harvest하는 다운스트림이라 보존.

---

## 6. 태그 체계·정책 보완

이 보고서는 좌표·코드 병합 기록이며, 태그 의미·운영정책의 정본은 [`docs/데이터_전처리_품질보고서.md`](./데이터_전처리_품질보고서.md)·[`docs/최종_데이터_분석_및_태그_확정.md`](./최종_데이터_분석_및_태그_확정.md)·[`tag/최종_태그_체계_및_산출가이드.md`](../tag/최종_태그_체계_및_산출가이드.md)다. 병합 상태를 정본과 함께 읽도록 핵심 정책을 요약한다.

1. **태그 역할·추천 반영** — A(자격) 0 · B(주거물리) 원칙 0 · C(입지·교통)·D(생활환경) 원자특징만 취향점수, 결합태그 0. A/B는 하드필터, 결합·설명태그는 추천 사유용.
2. **A 판정** — 기본 산출에서 공급행 4,398개 모두 `unverified`가 정상. 특정 공고 미연결 76개(매입 71·재개발 4·행복 1)는 `type_standard_only` 참고연결이며 모집확정 아님.
3. **B unknown·이상치** — 세대당 주차 3 초과 등 비정상은 `parking_unknown` 격리, 엘리베이터·방수·옵션 결측을 `false`/0으로 바꾸지 않음.
4. **C 교통 한계** — 철도 원천에 동해선(23)·부산김해경전철(21) 포함(총 158행·복합체 147). 버스정류소 8,522는 근접 표시용이며 노선·배차 미반영, 거리값은 직선거리.
5. **기본 개인화 8축 ID** — `rail_access`·`cafe_choice`·`fitness_access`·`supermarket_access`·`restaurant_choice`·`culture_access`·`quiet_residential`·`park_walk`(프론트 `PREFERENCE_FEATURES`와 일치).
6. **의료 정책** — 4축 전 후보 산출하되 기본 8축에 자동 투입 안 함. `medical_daily_access`는 사용자가 의료 접근을 명시한 경우에만 개인화 활성화(나이·유형 자동추정 금지).
7. **대학가 생활권** — 대표 캠퍼스 25 · 근접 107 · `university_commercial_area` 73. 캠퍼스 접근성과 학생생활형 상권을 함께 충족할 때만 부여하는 **설명 전용**(추천 재가산 금지).
8. **결합태그** — 결합점수 ≥ 0.65 AND 모든 구성요소 ≥ 0.55, 구성요소 하나라도 `null`이면 `null`. 10종, 추천점수 재투입 금지.
9. **`null ≠ 0` · 백분위 금지** — 좌표·격자 결측은 0점이 아니라 `null`. 후보 백분위 대신 고정 거리감쇠로 후보군이 달라져도 점수 의미 유지.
10. **재산출 델타** — main 어댑터(`typed-units`·`maeip-pricing`)를 유지한 채 tag/output을 전량 재산출하면 A 공급행·결합 부여 등에 미세 델타가 생긴다. 따라서 커밋된 `tag/output`을 정본으로 유지하며, "완전 재현"이 아니라 **핵심 지표(좌표등급·355/208/179·summary 카운트) 일치**로 검증한다.

---

## 부록 — 파이프라인 & 변경

- **파이프라인:** `npm run ingest:gis` → `npm run ingest`(캐시 비우고) → `node tag/src/run-all.mjs`
- **변경 파일:** `packages/shared-types/src/index.ts` · `scripts/ingest/{geocode,aggregate,index}.ts` · `scripts/ingest/gis/{index,tags,proj,tags.test}.ts` · `frontend/src/generated/housings.json` · `tag/**`(소스·산출물·가이드)
- **커밋:** `d0f0895`(tag 파이프라인) · `5a5d77a`(geocode 좌표 체인)
