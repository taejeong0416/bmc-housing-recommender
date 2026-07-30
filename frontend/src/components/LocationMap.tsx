import { useNaverMap } from '../hooks/useNaverMap'
import type { HomeMarker } from '../types'

// 상세화면 위치 지도 — 단일 매물 핀을 좌표 중심에 찍는다. 지도·목록 화면과 같은 Naver 훅을
// 재사용해 마커 스타일(teal 집 pill)과 부산 경계 제약을 그대로 공유한다. 선택·범위 콜백은 없음.
export function LocationMap({ marker }: { marker: HomeMarker }) {
  const { setMapEl, zoomIn, zoomOut } = useNaverMap(
    [marker],
    () => {},
    () => {},
    { lat: marker.lat, lng: marker.lng },
  )
  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-xl border border-line-soft bg-[#e4f5f2] lg:h-[260px]">
      <div
        ref={setMapEl}
        className="naver-map absolute inset-0 z-0 h-full w-full"
      />
      <div className="absolute right-3 top-3 z-[1000] flex flex-col overflow-hidden rounded-[10px] bg-white shadow-pop">
        <button
          onClick={zoomIn}
          aria-label="지도 확대"
          className="px-2.5 py-2 transition-colors hover:bg-panel"
        >
          <span className="ms text-[18px] text-body">add</span>
        </button>
        <span className="h-px bg-line-soft" />
        <button
          onClick={zoomOut}
          aria-label="지도 축소"
          className="px-2.5 py-2 transition-colors hover:bg-panel"
        >
          <span className="ms text-[18px] text-body">remove</span>
        </button>
      </div>
    </div>
  )
}
