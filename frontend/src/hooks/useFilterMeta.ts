import { useQuery } from '@tanstack/react-query'
import { getFilterMeta } from '../api/meta'

// 필터 옵션 메타는 자주 안 바뀌므로 길게 캐시.
export function useFilterMeta() {
  return useQuery({
    queryKey: ['meta', 'filters'],
    queryFn: getFilterMeta,
    staleTime: 60 * 60_000,
  })
}
