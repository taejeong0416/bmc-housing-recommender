import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { ALL_TYPE, OPEN_DEPOSIT, OPEN_RENT } from './lib/filter'
import { uniformWeights } from './onboarding/weights'
import type { StatePatch, StoreState, StoreValue } from './types'

// UI/필터 상태. 서버상태는 TanStack Query, 화면 라우팅은 react-router가 담당.
// Provider 없는 Zustand 단일 스토어 — Context 대비 트리 정리 + 선택적 구독 여지.
// 조건은 실제 필터로 동작하므로 기본값은 '열린 상태'(전체) — 사용자가 좁혀나가는 방향.
const initialState: StoreState = {
  weights: uniformWeights(), // 균등 사전분포 — 온보딩 전 콜드스타트
  onboardingLeans: null,
  onboardingLog: null,
  preferenceModel: null,
  preferenceHistory: [],
  comparisonRounds: 0,
  preferenceOverrides: {},
  selectedTags: [],
  tagWeights: {},
  depositMax: OPEN_DEPOSIT,
  rentMax: OPEN_RENT,
  regions: [],
  rentType: ALL_TYPE,
  buildYear: '제한 없음',
  area: '전체',
  houseTypes: [],
  buildingTypes: [],
  elevatorRequired: false,
  parkingRequired: false,
  favorites: {},
  favoriteLearningEnabled: false, // 기본 OFF — 첫 찜 맥락 동의로만 켜짐
  medicalPreferred: false, // 기본 OFF — 사용자가 명시적으로 켤 때만 의료축 랭킹 반영
  learningPromptSeen: false,
  learningPromptOpen: false,
  advancedOpen: false,
  advanced: {},
}

// localStorage 부재(테스트 node 환경)에선 no-op 폴백 — persist는 조용히 비활성.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

// 영속 대상은 관심목록·취향/조건만. 일시적 UI 상태(advancedOpen·advanced)는 제외.
const persistKeys = [
  'weights',
  'onboardingLog',
  'preferenceModel',
  'preferenceHistory',
  'comparisonRounds',
  'preferenceOverrides',
  'selectedTags',
  'tagWeights',
  'depositMax',
  'rentMax',
  'regions',
  'rentType',
  'buildYear',
  'area',
  'houseTypes',
  'buildingTypes',
  'elevatorRequired',
  'parkingRequired',
  'favorites',
  'favoriteLearningEnabled',
  'medicalPreferred',
  'learningPromptSeen',
] as const

type PersistedState = {
  state: Pick<StoreState, (typeof persistKeys)[number]>
}

// 관심목록·취향(조건저장)을 이 브라우저의 localStorage에만 영속. 서버 전송 없음.
export const useStore = create<StoreValue>()(
  persist(
    (set) => ({
      state: initialState,
      // 패치 객체 또는 업데이터를 받아 얕게 병합(기존 Context patch와 동일 계약).
      patch: (update: StatePatch) =>
        set((s) => ({
          state: {
            ...s.state,
            ...(typeof update === 'function' ? update(s.state) : update),
          },
        })),
    }),
    {
      name: 'bmc-store',
      version: 10,
      // 취향·조건은 초기값으로 되돌리고(과거 학습 로그는 스키마가 달라 그대로 못 쓴다)
      // 관심목록과 추천 설정 토글만 이어받는다. 지난 저장분의 나머지 키는 버린다.
      migrate: (persisted) => {
        const { state } = persisted as PersistedState
        return {
          state: {
            ...initialState,
            buildingTypes: state.buildingTypes,
            favorites: state.favorites,
            favoriteLearningEnabled: state.favoriteLearningEnabled,
            medicalPreferred: state.medicalPreferred,
            learningPromptSeen: state.learningPromptSeen,
          },
        }
      },
      storage: createJSONStorage(() =>
        typeof localStorage !== 'undefined' ? localStorage : noopStorage,
      ),
      partialize: (s): PersistedState => ({
        state: Object.fromEntries(
          persistKeys.map((k) => [k, s.state[k]]),
        ) as PersistedState['state'],
      }),
      // 저장분을 기본값 위에 병합 — StoreState에 필드가 추가돼도 undefined로 남지 않음.
      merge: (persisted, current) => ({
        ...current,
        state: {
          ...current.state,
          ...(persisted as PersistedState | undefined)?.state,
        },
      }),
    },
  ),
)
