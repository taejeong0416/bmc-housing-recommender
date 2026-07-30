import { describe, expect, it } from 'vitest'
import { nearbyLandmarks, landmarkSummary, formatDistance } from './landmarks'

describe('nearbyLandmarks', () => {
  // 부산대학교 정문 좌표 근처 → 부산대가 최상단으로 나온다.
  it('가까운 거점을 거리순으로 반환한다', () => {
    const near = nearbyLandmarks(35.2333, 129.0844)
    expect(near.length).toBeGreaterThan(0)
    expect(near[0].name).toBe('부산대학교')
    // 거리 오름차순 정렬 보장
    for (let i = 1; i < near.length; i++) {
      expect(near[i].distanceM).toBeGreaterThanOrEqual(near[i - 1].distanceM)
    }
  })

  // 영향권 밖(부산 경계 밖 좌표)이면 빈 배열 → 상세에서 카드가 숨겨진다.
  it('영향권 밖이면 빈 배열을 반환한다', () => {
    expect(nearbyLandmarks(37.5665, 126.978)).toEqual([])
  })

  it('landmarkSummary는 근처가 없으면 null', () => {
    expect(landmarkSummary(37.5665, 126.978)).toBeNull()
    expect(landmarkSummary(35.2333, 129.0844)).toContain('부산대학교')
  })
})

describe('formatDistance', () => {
  it('1km 미만은 m, 이상은 km로 표기', () => {
    expect(formatDistance(257)).toBe('260m')
    expect(formatDistance(1220)).toBe('1.2km')
  })
})
