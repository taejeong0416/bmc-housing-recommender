// 좌표 유틸. 선도소프트 SHP의 격자 폴리곤은 shpjs가 .prj(5186)를 읽어 이미 WGS84로 재투영하고,
// 상가-건물은 DBF에 LO/LA(WGS84)가 내장돼 있어(DATA_SCHEMA §6.4) 별도 좌표변환은 불필요하다.
// inBusanBbox는 파싱/재투영이 어긋나지 않았는지 검증하는 가드(격자가 bbox 밖이면 실패 처리).

export type LngLat = [number, number]

/** 부산광역시(기장·강서 포함) 여유 bbox — 행정경계 판정이 아닌 좌표 정상성 검증용. */
export function inBusanBbox([lng, lat]: LngLat): boolean {
  return lng > 128.72 && lng < 129.38 && lat > 34.82 && lat < 35.42
}
