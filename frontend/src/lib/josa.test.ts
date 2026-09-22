import { describe, expect, it } from 'vitest'
import { josa } from './josa'

describe('josa', () => {
  it('받침 유무로 조사를 고른다', () => {
    expect(josa('공원 산책', '을/를')).toBe('공원 산책을')
    expect(josa('카페 선택지', '을/를')).toBe('카페 선택지를')
    expect(josa('조용한 주거', '은/는')).toBe('조용한 주거는')
    expect(josa('도시철도 접근', '과/와')).toBe('도시철도 접근과')
    expect(josa('문화·여가', '과/와')).toBe('문화·여가와')
  })
})
