# Design System — Be:live 테마 하네스

UI를 새로 만들거나 고치기 전, 이 문서 + `docs/DESIGN_CONTEXT.md`(브랜드·톤·카피)를 먼저 읽는다.
목적: 화면마다 즉흥으로 다시 그리지 말고, 여기 정의된 **토큰·컴포넌트·상태**에서 조합해 일관된 결과를 낸다. 새 규칙이 필요하면 화면에 임시로 넣지 말고 이 문서와 `components/ui`에 먼저 반영한다.

## 0. 원천 (single source)
- **토큰:** `frontend/src/index.css`의 `@theme` — 색·폰트·그림자·모션. 하드코딩 hex 금지, 토큰 유틸(`text-teal`, `bg-panel`, `border-line`…)만 사용.
- **컴포넌트:** `frontend/src/components/ui/*`. 새 패턴은 화면에서 복제하지 말고 여기로 추출해 재사용.
- **카피·톤:** `docs/DESIGN_CONTEXT.md` §Voice & microcopy.

## 1. 토큰 요약 (원천은 index.css)
- **색:** teal(#047480) 앵커 · teal-dark(hover/active) · teal-soft·teal-ghost(표면) / **gold** 청약·최상위 CTA·경고 강조 전용 / heart 관심 / 텍스트 위계 ink→body→sub→faint / 경계 line·line-soft / 표면 paper·panel. **순검정·순백 금지.**
- **타이포:** Pretendard 단일. 수치·가격·점수는 `tabular-nums`. 위계 예 — 화면 제목 21px extrabold, 섹션 제목 15px extrabold, 라벨 12.5px `text-sub`, 보조 11.5px `text-faint`.
- **반경:** 컨트롤 9px · 소형(옵션 등) 7px · 카드 14~18px · 칩·뱃지 pill.
- **그림자:** `sm`(테두리) · `card` · `pop`(팝오버·토스트) · `header`. 떠 있는 카드가 아니라 얇은 테두리 + 옅은 리프트.
- **모션:** transform·opacity만, ease-out `cubic-bezier(.22,1,.36,1)`. `rise`·`toast-in`. bounce·elastic 금지. `prefers-reduced-motion` 존중(전역 처리).

## 2. 컴포넌트 카탈로그 (`components/ui`)
| 컴포넌트 | 용도 | 상태·변형 |
|---|---|---|
| `Button` | 액션 | primary(teal)/outline/gold(청약·최상위)/ghost · hover·active(scale .98)·disabled |
| `Chip` | 다중 선택(지역·방 구조) | active teal 채움 / 미선택 흰 배경 테두리 |
| `Segmented` | 단일 선택 소형(중요도) | 배경 panel, 활성 흰 카드 |
| `Select` | 단일 선택 옵션 목록 | **네이티브 `<select>` 금지** — 트리거+팝오버 리스트박스. `value` 기반 `onChange(value)`, `placeholder`(미선택 faint). 선택 항목 teal 틴트+check |
| `Toggle`/`MustHaveToggle` | 온·오프(필수시설) | active teal |
| `Card` | 화면 최상위 컨테이너 | 카드 남발 금지 |
| `Toast`(`soon()`) | 준비 중 안내·관심 피드백 | 죽은 버튼 전용 통로 |
| `States` | 로딩·빈 상태·에러 표준 표시 | — |

**목록을 펼치는 UI(드롭다운·메뉴)는 반드시 `Select`류 테마 팝오버로** — OS 기본 옵션창은 테마가 먹지 않아 일관성이 깨진다.

## 3. 상호작용 상태 (모든 컨트롤 공통)
- **hover:** 테두리·표면을 teal 쪽으로 한 단계(`border-teal/45`, `bg-teal-ghost`).
- **active(선택됨):** teal 채움 또는 teal 틴트 + 굵게(+check).
- **focus:** 전역 `:focus-visible` teal 링(키보드에만). 개별 override 금지.
- **disabled:** 채도·불투명 낮추고 포인터 차단. **왜 막혔는지는 근처 한 줄로** 사용자 행동 언어로 안내.
- **경고 색은 gold**(에러 빨강 남발 금지). 개별 필드를 빨강·gold로 물들이기보다 아래 §4처럼 섹션·CTA 레벨에서 신호를 준다.

## 4. 폼·필수조건 패턴
- 섹션은 박스로 감싸지 말고 `Head`(아이콘+제목+보조) + 필드로 통일 — 필수 섹션도 같은 형식, 구분은 제목 옆 `필수` 뱃지로만.
- 필수 신호는 **필드 테두리 착색이 아니라** 제목 옆 `필수` 뱃지 + 미충족 시 진행 CTA `disabled` + 근처 한 줄 이유로 준다. 이유는 **구현 상태가 아니라 사용자 행동**으로("신청 자격을 먼저 선택하면…").
- 요약·카운트는 **사용자 언어**("맞는 매물 N곳"), 내부 지표 나열·부연 설명 지양(§DESIGN_CONTEXT Voice).

## 5. 새 UI 체크리스트
1. 기존 `ui/*`로 되나? 되면 재사용, 안 되면 컴포넌트로 추출.
2. 색·간격·반경·그림자가 전부 토큰인가? 하드코딩 0?
3. hover·active·focus·disabled·invalid 5상태를 정의했나?
4. 카피가 구현 상태를 고백하지 않고 확정형인가?(§Voice)
5. 모션은 transform·opacity + reduced-motion?
