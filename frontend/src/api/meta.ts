import type { FilterMeta } from '../types'
import { apiFetch } from './client'

// 필터 셀렉트 옵션 메타(공급유형·지역) — 프론트 하드코딩 대체(P2-C-2).
export const getFilterMeta = () => apiFetch<FilterMeta>('api/meta/filters')
