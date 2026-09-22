import { useQuery } from '@tanstack/react-query'
import { getHousing, getHousings } from '../api/housings'
import { ApiError } from '../api/client'

export function useHousings() {
  return useQuery({ queryKey: ['housings'], queryFn: getHousings })
}

export function useHousing(id: string | undefined) {
  return useQuery({
    queryKey: ['housing', id],
    queryFn: () => getHousing(id!),
    enabled: !!id,
    // 없는 ID(404)는 다시 불러도 같으므로 재시도하지 않는다. 그 밖의 오류는 기본값처럼 1회.
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 404) && count < 1,
  })
}
