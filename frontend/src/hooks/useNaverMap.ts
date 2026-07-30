/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef } from 'react'
import type { HomeMarker } from '../types'

// 지도 훅 계약: 컨테이너 ref(setMapEl) + 마커 데이터 in — 화면은 지도 구현에 독립(P6-A-1).
// Naver 객체는 CDN 전역(window.naver)이라 loose 타입.

const CLIENT_ID = import.meta.env.VITE_NAVER_MAP_CLIENT_ID as string | undefined

// NCP Maps SDK 1회 로드(싱글턴). 신규 콘솔(ncpKeyId·oapi) 우선, 인증 실패 시 구(ncpClientId·openapi) 폴백.
let loadPromise: Promise<void> | null = null
function loadNaver(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    if (window.naver?.maps?.Map) return resolve()
    if (!CLIENT_ID) return reject(new Error('VITE_NAVER_MAP_CLIENT_ID 미설정'))
    const base = 'openapi/v3/maps.js'
    const urls = [
      `https://oapi.map.naver.com/${base}?ncpKeyId=${CLIENT_ID}`,
      `https://openapi.map.naver.com/${base}?ncpClientId=${CLIENT_ID}`,
    ]
    let settled = false
    // 실패는 캐시하지 않는다 — 일시적 네트워크 오류가 새로고침 전까지 지도를 막지 않도록.
    const fail = (msg: string) => {
      loadPromise = null
      reject(new Error(msg))
    }
    const tryLoad = (i: number) => {
      if (i >= urls.length)
        return fail(
          '인증 실패 — NCP 콘솔에서 Maps Client ID와 등록된 Web 서비스 URL(현재 origin) 확인',
        )
      const s = document.createElement('script')
      // 인증 실패 시 SDK가 이 전역 콜백을 호출. resolve 전이면 다음 URL(파라미터 방식)로 재시도.
      window.navermap_authFailure = () => {
        if (settled)
          return console.error(
            '[naver-map] 인증 실패 — Client ID 또는 등록된 Web 서비스 URL(현재 origin) 확인',
          )
        s.remove()
        tryLoad(i + 1)
      }
      s.src = urls[i]
      s.async = true
      s.onload = () => {
        if (window.naver?.maps?.Map) {
          settled = true
          resolve()
        } else tryLoad(i + 1)
      }
      s.onerror = () => {
        s.remove()
        tryLoad(i + 1)
      }
      document.head.appendChild(s)
    }
    tryLoad(0)
  })
  return loadPromise
}

const BUSAN = { lat: 35.162, lng: 129.112 }
// 부산 전역 대략 경계(가덕도~기장) — 지도를 이 밖으로 못 나가게 제한(부산 전용 서비스).
const BUSAN_BOUNDS = {
  swLat: 34.95,
  swLng: 128.73,
  neLat: 35.42,
  neLng: 129.32,
}
const MIN_ZOOM = 11 // 부산 밖이 보일 만큼 축소 방지
// 픽셀 격자 한 변(현재 줌 기준) — 이 안에 든 마커는 한 덩어리로 묶는다. 줌인하면 격자가
// 벌어져 자연히 개별 마커로 풀린다.
const CELL = 96

// 집아이콘 pill 마커 — 고정 크기 박스에 pill을 중앙 배치하고 icon.size를 명시한다.
// (size 없이 transform으로만 위치를 잡으면 Naver가 클릭 영역을 좌표 한 점으로 잡아
//  마커가 잘 안 눌리는 문제가 생김.) 개별=1, 클러스터=묶인 개수를 표기.
const MW = 80
const MH = 34
// top=추천 상위(홈 탭과 동일 집합) → gold 배경 + 별 아이콘으로 강조. 아니면 teal 집아이콘.
function pillIcon(naver: any, n: number, top: boolean) {
  const bg = top ? '#f6c026' : '#047480'
  const fg = top ? '#3a2f00' : '#fff'
  const icon = top ? 'star' : 'home'
  return {
    content: `<div style="width:${MW}px;height:${MH}px;display:flex;align-items:center;justify-content:center;font-family:Pretendard"><div style="display:inline-flex;align-items:center;gap:2px;background:${bg};color:${fg};border:2px solid #fff;border-radius:20px;padding:5px 10px;box-shadow:0 2px 8px rgba(0,0,0,.35);font-weight:800;font-size:13px;white-space:nowrap"><span class="ms" style="font-size:14px">${icon}</span>${n}</div></div>`,
    size: new naver.maps.Size(MW, MH),
    anchor: new naver.maps.Point(MW / 2, MH / 2),
  }
}

// 내 현 위치 파란 점 마커.
const DOT = 20
function dotIcon(naver: any) {
  return {
    content: `<div style="width:${DOT}px;height:${DOT}px;display:flex;align-items:center;justify-content:center"><div style="width:14px;height:14px;border-radius:50%;background:#2b7fff;border:3px solid #fff;box-shadow:0 0 0 3px rgba(43,127,255,.3),0 1px 4px rgba(0,0,0,.4)"></div></div>`,
    size: new naver.maps.Size(DOT, DOT),
    anchor: new naver.maps.Point(DOT / 2, DOT / 2),
  }
}

export interface MapBounds {
  swLat: number
  swLng: number
  neLat: number
  neLng: number
}

export function useNaverMap(
  markers: HomeMarker[],
  onMarkerClick: (ids: string[] | null) => void,
  onBoundsChange: (bounds: MapBounds) => void,
  // 첫 진입 중심 — 추천 1위 매물 좌표. 위치 권한 없이 이 지점으로 지도를 잡는다(없으면 부산 기본).
  initialCenter: { lat: number; lng: number } | null = null,
) {
  const map = useRef<any>(null)
  const markerObjs = useRef<any[]>([])
  const myLocMarker = useRef<any>(null)
  const idleListener = useRef<any>(null)
  const el = useRef<HTMLDivElement | null>(null)
  const glowDispose = useRef<(() => void) | null>(null)
  const resizeObs = useRef<ResizeObserver | null>(null)

  const clickRef = useRef(onMarkerClick)
  clickRef.current = onMarkerClick
  const boundsRef = useRef(onBoundsChange)
  boundsRef.current = onBoundsChange
  const markersRef = useRef(markers)
  markersRef.current = markers
  const initialCenterRef = useRef(initialCenter)
  initialCenterRef.current = initialCenter
  // 첫 진입 자동 중심을 1회만 적용(이후 사용자의 팬·줌을 덮어쓰지 않게).
  const autoCenteredRef = useRef(false)

  // 근접 마커를 픽셀 격자로 묶어 재구성. 셀당 매물 개수를 pill에 표기(개별=1).
  // idle(팬·줌)마다 현재 줌 기준으로 다시 계산.
  const recluster = useCallback(() => {
    const naver = window.naver
    if (!map.current || !naver) return
    markerObjs.current.forEach((m) => m.setMap(null))
    markerObjs.current = []
    const list = markersRef.current
    if (!list.length) return

    const proj = map.current.getProjection()
    const cells = new Map<
      string,
      { items: HomeMarker[]; sx: number; sy: number }
    >()
    for (const h of list) {
      const pt = proj.fromCoordToOffset(new naver.maps.LatLng(h.lat, h.lng))
      const key = `${Math.floor(pt.x / CELL)}:${Math.floor(pt.y / CELL)}`
      let c = cells.get(key)
      if (!c) cells.set(key, (c = { items: [], sx: 0, sy: 0 }))
      c.items.push(h)
      c.sx += h.lng
      c.sy += h.lat
    }

    cells.forEach((c) => {
      const n = c.items.length
      // 개별(1) = 그 좌표, 클러스터(2+) = 묶인 매물 중심. 클릭하면 해당 매물 id들을 선택.
      const lat = n === 1 ? c.items[0].lat : c.sy / n
      const lng = n === 1 ? c.items[0].lng : c.sx / n
      const ids = c.items.map((i) => i.id)
      // 추천 상위가 하나라도 든 셀은 강조 핀 — 다른 마커 위로 올려 눈에 띄게.
      const top = c.items.some((i) => i.top)
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(lat, lng),
        map: map.current,
        zIndex: top ? 150000 + n : n === 1 ? 0 : 100000 + n, // 추천 > 클러스터 > 개별
        icon: pillIcon(naver, n, top),
      })
      naver.maps.Event.addListener(marker, 'click', () =>
        clickRef.current?.(ids),
      )
      markerObjs.current.push(marker)
    })
  }, [])

  // 내 현 위치로 이동 — 부산 경계 안이면 그 지점을 중심에 두고 파란 점을 찍는다.
  // 밖(부산 외 지역)이거나 권한 거부·미지원이면 조용히 기본(부산) 상태를 유지.
  const locate = useCallback((zoom = 15) => {
    const naver = window.naver
    if (!navigator.geolocation || !map.current || !naver) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!map.current) return
        const { latitude: lat, longitude: lng } = pos.coords
        const inBusan =
          lat >= BUSAN_BOUNDS.swLat &&
          lat <= BUSAN_BOUNDS.neLat &&
          lng >= BUSAN_BOUNDS.swLng &&
          lng <= BUSAN_BOUNDS.neLng
        if (!inBusan) return
        const at = new naver.maps.LatLng(lat, lng)
        if (myLocMarker.current) myLocMarker.current.setPosition(at)
        else
          myLocMarker.current = new naver.maps.Marker({
            position: at,
            map: map.current,
            icon: dotIcon(naver),
            zIndex: 200000,
          })
        map.current.setCenter(at)
        map.current.setZoom(zoom, true)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  }, [])

  // 첫 진입 중심을 추천 1위 좌표로 1회 적용(위치 권한 불필요). 좌표가 아직 없으면(추천 로딩 중)
  // no-op하고, 좌표가 준비되면 아래 effect가 지도 준비 후 다시 호출해 적용한다.
  const applyInitialCenter = useCallback(() => {
    const naver = window.naver
    const c = initialCenterRef.current
    if (autoCenteredRef.current || !map.current || !naver || !c) return
    autoCenteredRef.current = true
    map.current.setCenter(new naver.maps.LatLng(c.lat, c.lng))
    map.current.setZoom(14, true)
  }, [])

  const initMap = useCallback(() => {
    if (map.current || !el.current) return
    loadNaver()
      .then(() => {
        const naver = window.naver
        if (!el.current || map.current) return
        const start = initialCenterRef.current ?? BUSAN
        map.current = new naver.maps.Map(el.current, {
          center: new naver.maps.LatLng(start.lat, start.lng),
          zoom: initialCenterRef.current ? 14 : 13,
          minZoom: MIN_ZOOM,
          maxBounds: new naver.maps.LatLngBounds(
            new naver.maps.LatLng(BUSAN_BOUNDS.swLat, BUSAN_BOUNDS.swLng),
            new naver.maps.LatLng(BUSAN_BOUNDS.neLat, BUSAN_BOUNDS.neLng),
          ),
          zoomControl: false,
        })
        const emitBounds = () => {
          const b = map.current.getBounds()
          boundsRef.current?.({
            swLat: b.getSW().lat(),
            swLng: b.getSW().lng(),
            neLat: b.getNE().lat(),
            neLng: b.getNE().lng(),
          })
        }
        // 팬·줌이 끝날 때마다 현재 줌 기준으로 다시 묶고, 화면 범위를 알린다(리스트 = 화면 내 매물).
        idleListener.current = naver.maps.Event.addListener(
          map.current,
          'idle',
          () => {
            recluster()
            emitBounds()
          },
        )
        // 빈 지도 클릭 → 마커 선택 해제.
        naver.maps.Event.addListener(map.current, 'click', () =>
          clickRef.current?.(null),
        )
        // 부산 경계 오버스크롤 글로우 — 막히는 방향에만, 벽을 미는 양에 비례해 회색이
        // 짙어지고 손을 떼거나 멈추면 서서히 사라진다(관례적 overscroll 피드백).
        if (el.current) {
          const container = el.current
          const layer = document.createElement('div')
          layer.style.cssText =
            'position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden'
          container.appendChild(layer)
          const G = 'rgba(38,38,38,.5)'
          const edge = (css: string) => {
            const d = document.createElement('div')
            d.style.cssText = `position:absolute;opacity:0;${css}`
            layer.appendChild(d)
            return d
          }
          const glows = {
            top: edge(
              `left:0;right:0;top:0;height:40px;transform-origin:top;background:linear-gradient(to bottom,${G},transparent)`,
            ),
            bottom: edge(
              `left:0;right:0;bottom:0;height:40px;transform-origin:bottom;background:linear-gradient(to top,${G},transparent)`,
            ),
            left: edge(
              `top:0;bottom:0;left:0;width:40px;transform-origin:left;background:linear-gradient(to right,${G},transparent)`,
            ),
            right: edge(
              `top:0;bottom:0;right:0;width:40px;transform-origin:right;background:linear-gradient(to left,${G},transparent)`,
            ),
          }
          const EDGES = ['top', 'bottom', 'left', 'right'] as const
          const over = { top: 0, bottom: 0, left: 0, right: 0 }
          const MAX = 260 // 이 정도(px) 밀어야 최대 강도(둔감하게)
          const render = () => {
            for (const k of EDGES) {
              const t = Math.min(over[k] / MAX, 1)
              glows[k].style.opacity = String(t)
              const sc = 0.35 + 0.65 * t
              glows[k].style.transform =
                k === 'top' || k === 'bottom'
                  ? `scaleY(${sc})`
                  : `scaleX(${sc})`
            }
          }
          let raf = 0
          const tick = () => {
            let any = false
            for (const k of EDGES) {
              over[k] *= 0.86 // 매 프레임 감쇠 → 미는 강도(속도)에 비례한 세기로 수렴
              if (over[k] < 0.5) over[k] = 0
              else any = true
            }
            render()
            raf = any ? requestAnimationFrame(tick) : 0
          }
          const kick = () => {
            if (!raf) raf = requestAnimationFrame(tick)
          }
          const EPS = 0.0008 // 실제 클램프(벽) 순간만 감지 — 근처에선 안 뜨게
          let dragging = false
          let lx = 0
          let ly = 0
          const onDown = (e: PointerEvent) => {
            dragging = true
            lx = e.clientX
            ly = e.clientY
          }
          const onMove = (e: PointerEvent) => {
            if (!dragging || !map.current) return
            const dx = e.clientX - lx
            const dy = e.clientY - ly
            lx = e.clientX
            ly = e.clientY
            const b = map.current.getBounds()
            // 줌과 무관하게 실제로 경계에 닿은 방향으로 더 미는 양만 글로우에 누적.
            if (b.getNE().lat() >= BUSAN_BOUNDS.neLat - EPS && dy > 0)
              over.top += dy
            if (b.getSW().lat() <= BUSAN_BOUNDS.swLat + EPS && dy < 0)
              over.bottom -= dy
            if (b.getSW().lng() <= BUSAN_BOUNDS.swLng + EPS && dx > 0)
              over.left += dx
            if (b.getNE().lng() >= BUSAN_BOUNDS.neLng - EPS && dx < 0)
              over.right -= dx
            kick()
          }
          const onUp = () => {
            dragging = false
          }
          container.addEventListener('pointerdown', onDown)
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', onUp)
          glowDispose.current = () => {
            container.removeEventListener('pointerdown', onDown)
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            if (raf) cancelAnimationFrame(raf)
            layer.remove()
          }
        }
        recluster()
        emitBounds()
        // 추천 1위 좌표가 준비돼 있으면 첫 프레임부터 그 지점으로(위치 권한 불필요).
        applyInitialCenter()
      })
      .catch((e) => console.error('[naver-map]', e))
  }, [recluster, applyInitialCenter])

  const teardown = useCallback(() => {
    markerObjs.current.forEach((m) => m.setMap(null))
    markerObjs.current = []
    myLocMarker.current?.setMap(null)
    myLocMarker.current = null
    if (idleListener.current)
      window.naver?.maps?.Event.removeListener(idleListener.current)
    idleListener.current = null
    glowDispose.current?.()
    glowDispose.current = null
    resizeObs.current?.disconnect()
    resizeObs.current = null
    map.current?.destroy?.()
    map.current = null
  }, [])

  const setMapEl = useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node
      if (node) {
        initMap()
        // 컨테이너 폭 변화(AI 대화창 push 등) 시 Naver 지도 재배치 — 타일 공백 방지.
        resizeObs.current?.disconnect()
        resizeObs.current = new ResizeObserver(() => {
          if (map.current)
            window.naver?.maps?.Event?.trigger(map.current, 'resize')
        })
        resizeObs.current.observe(node)
      } else teardown()
    },
    [initMap, teardown],
  )

  useEffect(() => {
    recluster()
  }, [markers, recluster])
  // 추천 1위 좌표가 지도 생성 뒤에 도착한 경우(추천 비동기 로딩) 첫 진입 중심을 적용.
  useEffect(() => {
    applyInitialCenter()
  }, [initialCenter, applyInitialCenter])
  useEffect(() => () => teardown(), [teardown])

  const zoomIn = useCallback(
    () => map.current?.setZoom(map.current.getZoom() + 1, true),
    [],
  )
  const zoomOut = useCallback(
    () => map.current?.setZoom(map.current.getZoom() - 1, true),
    [],
  )
  // 검색한 지역·거점으로 지도 이동 — 지역/근처 검색이 지도에 반영되게 한다.
  const panTo = useCallback((lat: number, lng: number) => {
    if (map.current && window.naver)
      map.current.panTo(new window.naver.maps.LatLng(lat, lng))
  }, [])

  return { setMapEl, zoomIn, zoomOut, panTo, locate }
}
