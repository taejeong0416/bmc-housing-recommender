import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './store'

// Zustand 스토어는 모듈 싱글턴 — 각 테스트 전 초기값 복원.
const initial = useStore.getState().state

describe('useStore.patch', () => {
  beforeEach(() => {
    useStore.setState({ state: initial })
  })

  it('패치 객체는 얕게 병합', () => {
    useStore.getState().patch({ depositMax: 5000 })
    expect(useStore.getState().state.depositMax).toBe(5000)
    // 다른 필드는 보존
    expect(useStore.getState().state.rentMax).toBe(initial.rentMax)
  })

  it('업데이터 함수는 이전 상태를 받아 부분 반환', () => {
    useStore.getState().patch((s) => ({ advancedOpen: !s.advancedOpen }))
    expect(useStore.getState().state.advancedOpen).toBe(!initial.advancedOpen)
  })

  it('중첩 Record 필드도 병합 대상(favorites 토글)', () => {
    useStore
      .getState()
      .patch((s) => ({ favorites: { ...s.favorites, x1: true } }))
    expect(useStore.getState().state.favorites['x1']).toBe(true)
  })
})
