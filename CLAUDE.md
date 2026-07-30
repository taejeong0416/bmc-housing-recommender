# CLAUDE.md — BMC 주택 추천 서비스

부산도시공사(BMC) 취향 기반 공공임대주택 추천 서비스.
구성: **React+Vite 프론트 + NestJS / PostgreSQL+PostGIS 백엔드**(모노레포·Docker). 현 진행 단계·완료/잔여는 `docs/PRODUCTION_PLAN.md` 로드맵 표가 단일 원천 — 여기에 상태를 중복 기재하지 않는다.

## 먼저 읽을 문서
- `docs/PRODUCTION_PLAN.md` — 프로덕션 전환 로드맵(P0~P7). 지금 작업이 어느 단계인지 먼저 확인.
- `docs/STACK_DECISION.md` — 인프라 스택 결정 기록. **인프라·DB·배포 관련 제안 전 필독.**
- `docs/HARNESS_DESIGN.md` — 프로젝트 골격(컨테이너·데이터 인제스천·모듈 배치).
- `docs/DESIGN_CONTEXT.md` + `docs/DESIGN_SYSTEM.md` — 브랜드·톤·카피 원칙 + 토큰·컴포넌트·상태 테마 하네스. **UI를 만들거나 고치기 전 필독.**

## 확정된 스택 (재논의 금지 — 재검토는 STACK_DECISION §7 조건에서만)
- self-host 전통 구성: **React+Vite / NestJS / PostgreSQL+PostGIS / Docker**.
- **Supabase·Vercel 아님.** 매니지드로 갈아타자는 제안 하지 말 것(근거: STACK_DECISION).
- 지도는 국내 지도 **Naver Maps JS API(NCP)**.

## 데이터
- 실데이터 교체점은 **`data/source/`의 CSV + 유형별 어댑터 한 곳뿐** (HARNESS_DESIGN §3). 그 뒤 단계·UI는 무변경.
- 원천 CSV는 **CP949 인코딩**, 좌표 없음 → 지오코딩 필요, 유형별 스키마 상이.
- P0 산출물 `frontend/src/generated/housings.json`이 앱이 읽는 실데이터.

## 작업 규칙
- **커밋:** 하나의 논리가 **settled**(빌드 통과 + 더 안 고칠 상태)됐을 때 한 번. 편집마다 ❌, 끝에 몰아서 ❌, `git add .` ❌. 해당 유닛의 파일만 스테이징.
- **메시지:** 한국어 `feat:`/`fix:`/`docs:`/`chore:` 접두. 무관한 변경(버그픽스+문서+리팩토링) 섞지 않기.
- **push:** 명시 요청 시에만. 커밋은 유닛이 settle될 때마다 자유롭게.
- **문서:** 레퍼런스 문서(PLAN·STACK_DECISION·HARNESS)는 **제자리 갱신** — 변경 이력 흔적(`v2`, `기존 X → 신규 Y`, `수정됨`) 남기지 말고 최종 상태로 다시 쓰기. 시간순 기록은 git 히스토리와 PLAN 상태 마커가 담당(별도 개발 로그 파일은 두지 않음).
- **플랜 동기화(필수):** 코드/기능 커밋으로 어떤 단계가 settle되면, **같은 커밋 유닛 안에서** `docs/PRODUCTION_PLAN.md`의 해당 상태 마커(✅/◐/⬜)와 §2 로드맵 표·§6 착수 순서를 실제 상태로 갱신한다. "코드만 끝내고 PLAN은 나중에"는 금지 — 문서가 실제와 어긋나면 드리프트다. 상태 표기는 실제 코드로 검증된 것만(추측 ✅ 금지, 부분 구현은 ◐). 문서만의 변경이면 `docs:` 단독 커밋도 무방.
