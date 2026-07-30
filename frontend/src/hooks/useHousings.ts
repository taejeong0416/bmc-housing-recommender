import { useQuery } from '@tanstack/react-query'
import { getHousing, getHousings } from '../api/housings'

export function useHousings() {
  return useQuery({ queryKey: ['housings'], queryFn: getHousings })
}

export function useHousing(id: string | undefined) {
  return useQuery({
    queryKey: ['housing', id],
    queryFn: () => getHousing(id!),
    enabled: !!id,
  })
}
