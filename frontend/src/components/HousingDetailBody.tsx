import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { detailTabDefs, detailRows } from '../data'
import {
  houseImage,
  manwon,
  rangeLabel,
  toCard,
  toMarker,
} from '../api/housings'
import { OPEN_DEPOSIT, OPEN_RENT } from '../lib/filter'
import { nearbyHighlights, formatDistance } from '../lib/landmarks'
import { universityBadge } from '../lib/listingTags'
import { LocationMap } from './LocationMap'
import { ScoreBar } from './ScoreBar'
import { candidateReason, candidateTradeoff } from '../onboarding/pairwise'
import { finalPreferenceModel } from '../onboarding/refine'
import type { GeneratedHousing, StoreState } from '../types'

// 내 기본조건 대비 이 후보의 충족 여부(§6.8-2) — 활성 조건만.
function conditionChecks(
  dto: GeneratedHousing,
  s: StoreState,
): { label: string; ok: boolean }[] {
  const out: { label: string; ok: boolean }[] = []
  if (s.depositMax !== OPEN_DEPOSIT)
    out.push({
      label: `보증금 ${s.depositMax.toLocaleString()}만원 이하`,
      ok: (dto.deposit?.min ?? Infinity) <= s.depositMax * 10000,
    })
  if (s.rentMax !== OPEN_RENT)
    out.push({
      label: `월세 ${s.rentMax}만원 이하`,
      ok: (dto.rent?.min ?? Infinity) <= s.rentMax * 10000,
    })
  if (s.regions.length)
    out.push({
      label: `지역 ${s.regions.join('·')}`,
      ok: s.regions.includes(dto.district),
    })
  if (s.buildYear !== '제한 없음') {
    const maxAge = Number(s.buildYear.replace(/\D/g, ''))
    const y = Number(dto.builtDate?.slice(0, 4))
    out.push({
      label: s.buildYear,
      ok: !!y && y >= new Date().getFullYear() - maxAge,
    })
  }
  if (s.elevatorRequired) out.push({ label: '엘리베이터', ok: dto.elevator })
  if (s.parkingRequired) out.push({ label: '주차 가능', ok: dto.parking > 0 })
  return out
}

const areaLabel = (r: { min: number; max: number }): string =>
  r.max <= 0 ? '-' : r.min === r.max ? `${r.min}m²` : `${r.min} ~ ${r.max}m²`
const countLabel = (r: { min: number; max: number }): string =>
  r.max <= 0 ? '-' : r.min === r.max ? `${r.min}개` : `${r.min} ~ ${r.max}개`

// 기본·비용 탭은 인제스천 실데이터로 렌더. 주변인프라·교통 탭은 상권 GIS 적재(P3-D) 전까지 목데이터 유지.
function realRows(
  dto: GeneratedHousing,
  tab: string,
): [string, string][] | null {
  if (tab === 'basic')
    return [
      ['임대유형', dto.type],
      ['세대수', `${dto.totalUnits.toLocaleString()}세대`],
      ['준공일', dto.builtDate ?? '-'],
      ['전용면적', areaLabel(dto.area)],
      ['방수', countLabel(dto.rooms)],
      ['승강기', dto.elevator ? '있음' : '없음'],
      ['주차대수', `${dto.parking.toLocaleString()}대`],
      ['주소', dto.address],
    ]
  if (tab === 'cost') {
    const rows: [string, string][] = [
      ['보증금', rangeLabel(dto.deposit)],
      ['월 임대료', rangeLabel(dto.rent)],
    ]
    // 조건별(공급계층·소득구간 등) 대표 가격 — 전체는 P3-D 상세 API에서
    for (const p of dto.pricingRows.slice(0, 6))
      rows.push([
        p.qualifier || '표준',
        `${manwon(p.deposit)} · 월 ${manwon(p.rent)}`,
      ])
    if (dto.pricingRows.length > 6)
      rows.push(['그 외 조건', `${dto.pricingRows.length - 6}건`])
    return rows
  }
  return null
}

// 대표장소 유형별 아이콘 — 사진 대신 아이콘으로 장소 성격만 전달한다.
function placeIcon(minor: string): string {
  if (minor.includes('백화점')) return 'shopping_bag'
  if (minor.includes('시장')) return 'storefront'
  if (minor.includes('몰')) return 'local_mall'
  if (minor.includes('마트')) return 'shopping_cart'
  if (minor.includes('해수욕장')) return 'beach_access'
  if (minor.includes('공원')) return 'park'
  if (minor.includes('문화')) return 'museum'
  if (minor.includes('컨벤션')) return 'festival'
  if (minor.includes('체육')) return 'fitness_center'
  if (minor.includes('자연')) return 'landscape'
  return 'place'
}

// 단지 상세 본문 — 대표이미지부터 기본/비용 탭까지. 상세 페이지(DetailScreen)와
// 홈 추천 스와이프 카드가 공유한다. 페이지 고유 크롬(뒤로/공유/청약 CTA·우측 요약)은
// 각 화면이 자기 몫으로 두르고, 여기선 dto만으로 렌더되는 순수 본문만 담는다.
// variant='embed'는 우측 요약이 없는 카드 안에서 쓰므로 인라인 점수를 항상 노출한다.
export function HousingDetailBody({
  dto,
  variant = 'page',
}: {
  dto: GeneratedHousing
  variant?: 'page' | 'embed'
}) {
  const st = useStore((z) => z.state)
  // 최종 모델(추론+직접보정+찜) — 매 렌더 favoriteSignal 재스캔 방지(memo).
  const model = useMemo(
    () =>
      finalPreferenceModel({
        model: st.preferenceModel,
        overrides: st.preferenceOverrides,
        favorites: st.favorites,
        favoriteLearningEnabled: st.favoriteLearningEnabled,
      }),
    [
      st.preferenceModel,
      st.preferenceOverrides,
      st.favorites,
      st.favoriteLearningEnabled,
    ],
  )
  const h = toCard(dto)
  const learnedScore = dto.scoreSource === 'engine'
  const [tab, setTab] = useState('basic')
  const rows = realRows(dto, tab) ?? detailRows[tab] ?? []
  const reason = candidateReason(dto.id, model)
  const tradeoff = candidateTradeoff(dto.id, model)
  const conditions = conditionChecks(dto, st)
  const highlights =
    typeof dto.lat === 'number' && typeof dto.lng === 'number'
      ? nearbyHighlights(dto.lat, dto.lng)
      : []
  const uniBadge = universityBadge(dto.id)
  // 위치 지도는 페이지 상세에서만 — 임베드(스와이프 카드)엔 지도를 띄우지 않는다.
  const marker = variant === 'page' ? toMarker(dto) : null

  return (
    <>
      {/* 대표 이미지 — 세대수 기준 대표 유형(아파트/오피스텔/빌라) */}
      <div className="relative h-[260px] overflow-hidden lg:h-[320px]">
        <img
          src={houseImage(dto).src}
          alt={`${h.name} ${houseImage(dto).label}`}
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-3 left-4 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
          {houseImage(dto).label}
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[19px] font-extrabold text-ink">{h.name}</h2>
              {h.tag !== '매입임대' && (
                <span className="rounded-[5px] bg-teal-soft px-1.5 py-0.5 text-[11px] font-bold text-teal">
                  {h.tag}
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-sub">
              <span className="ms text-[15px] text-faint">place</span>
              {h.loc}
            </p>
          </div>
          {/* 페이지에선 우측 요약에 점수가 있어 본문 점수는 모바일에서만.
              임베드(스와이프 카드)엔 요약이 없어 항상 노출한다. */}
          <div
            className={`shrink-0 text-right ${variant === 'page' ? 'lg:hidden' : ''}`}
          >
            <p className="text-[11px] font-semibold text-sub">
              {learnedScore ? '생활취향 적합도' : '매칭 점수'}
            </p>
            <p className="text-[28px] font-extrabold leading-none tabular-nums text-teal">
              {h.score}
              {!learnedScore && <span className="text-[16px]">%</span>}
            </p>
            {variant === 'page' && (
              <ScoreBar score={h.score} className="ms-auto mt-1.5 w-24" />
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2.5">
          <div className="flex-1 rounded-xl border border-line-soft bg-panel px-4 py-3">
            <p className="text-[11.5px] text-sub">보증금</p>
            <p className="mt-0.5 text-[16px] font-extrabold tabular-nums text-ink">
              {h.deposit}
            </p>
          </div>
          <div className="flex-1 rounded-xl border border-line-soft bg-panel px-4 py-3">
            <p className="text-[11.5px] text-sub">월 임대료</p>
            <p className="mt-0.5 text-[16px] font-extrabold tabular-nums text-ink">
              {h.rent}
            </p>
          </div>
        </div>

        {/* 위치 — 단지 좌표 중심 지도(Naver). 좌표가 있는 페이지 상세에서만. */}
        {marker && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="ms text-[16px] text-teal">map</span>
              <p className="text-[12px] font-bold text-sub">위치</p>
            </div>
            <LocationMap marker={marker} />
            <p className="mt-2 flex items-start gap-1 text-[12px] text-sub">
              <span className="ms mt-px text-[15px] text-faint">place</span>
              {dto.address}
            </p>
          </div>
        )}

        {/* 대학가 생활권 — tag/ 대학상권 설명태그(설명 전용, 추천점수 무관). 직선거리·추정임을 명시. */}
        {uniBadge && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-teal/30 bg-teal-soft px-4 py-3">
            <span className="ms mt-px text-[18px] text-teal">school</span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-ink">
                대학가 생활권 추정
              </p>
              <p className="mt-0.5 text-[11.5px] text-sub">
                {uniBadge.campusName ?? '대학 캠퍼스'}
                {uniBadge.meters != null
                  ? ` 약 ${uniBadge.meters}m(직선거리)`
                  : ''}{' '}
                · 카페·외식 등 학생생활형 상권이 함께 형성돼 있어요
              </p>
            </div>
          </div>
        )}

        {/* 주변 대표장소 — 큐레이션 라이프스타일 거점(백화점·시장·해수욕장·공원 등). 표시 전용, 추천점수 무관. */}
        {highlights.length > 0 && (
          <div className="mt-4 rounded-xl border border-line-soft px-4 py-3.5">
            <div className="flex items-center gap-1.5">
              <span className="ms text-[16px] text-teal">explore</span>
              <p className="text-[12px] font-bold text-sub">주변 대표장소</p>
            </div>
            <ul className="mt-2.5 space-y-2">
              {highlights.map((l) => (
                <li key={l.id} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-soft">
                    <span className="ms text-[17px] text-teal">
                      {placeIcon(l.categoryMinor)}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-ink">
                      {l.name}
                    </p>
                    <p className="text-[11.5px] text-faint">
                      {l.categoryMinor}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-sub">
                    {formatDistance(l.distanceM)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 내 기본조건 충족 (§6.8-2) */}
        {conditions.length > 0 && (
          <div className="mt-3 rounded-xl border border-line-soft px-4 py-3">
            <p className="text-[12px] font-bold text-sub">내 기본조건 대비</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {conditions.map((c) => (
                <span
                  key={c.label}
                  className={`flex items-center gap-1 text-[12px] ${
                    c.ok ? 'text-body' : 'text-gold-dark'
                  }`}
                >
                  <span
                    className={`ms text-[15px] ${
                      c.ok ? 'text-teal' : 'text-gold-dark'
                    }`}
                  >
                    {c.ok ? 'check_circle' : 'error'}
                  </span>
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 3-4. 추천 이유·감수할 점 (§6.8-3,4 / §8.6-7) */}
        {learnedScore && (
          <div className="mt-3 rounded-xl border border-teal/15 bg-teal-ghost px-4 py-3">
            <p className="text-[13px] font-bold text-teal">
              {h.highlight || '내 취향 맞춤 추천'}
            </p>
            {reason && (
              <p className="mt-1.5 text-[12px] leading-relaxed text-body">
                <b className="text-teal">추천 이유</b> {reason}
              </p>
            )}
            <p className="mt-1 text-[12px] leading-relaxed text-body">
              <b>감수할 점</b> {tradeoff}
            </p>
            <p className="mt-1.5 text-[11px] text-sub">
              생활취향 적합도 {h.score}점
            </p>
          </div>
        )}

        <div className="mt-5 flex gap-5 border-b border-line-soft">
          {detailTabDefs.map(([tid, label]) => (
            <button
              key={tid}
              onClick={() => setTab(tid)}
              className={`-mb-px border-b-2 pb-2.5 pt-1 text-[14px] font-bold transition-colors ${
                tab === tid
                  ? 'border-teal text-teal'
                  : 'border-transparent text-sub hover:text-body'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-7 gap-y-3.5">
          {rows.map(([k, v], idx) => (
            <div
              key={idx}
              className="flex justify-between gap-2 border-b border-line-soft pb-2.5"
            >
              <span className="shrink-0 text-[13px] text-sub">{k}</span>
              <span className="text-right text-[13.5px] font-bold text-ink">
                {v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
