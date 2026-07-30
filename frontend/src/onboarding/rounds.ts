// 가상 생활권 A/B 비교 라운드 정책 — SwipeScreen(진행)과 PrefillScreen(결과에서 '더 비교')이 공유.
export const BASE_ROUNDS = 5 // 기본 진행 라운드
export const EXTRA_ROUNDS = 5 // 결과 화면에서 '더 비교'를 누를 때 이어서 진행하는 라운드
export const MAX_ROUNDS = 10 // 누적 상한(기획안 §6.1 기본 5회 + 선택 최대 5회)
