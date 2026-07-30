// shpjs 공식 타입 미제공 — 최소 선언(우리가 쓰는 시그니처만).
declare module 'shpjs' {
  interface ShpFeature {
    type: 'Feature'
    properties: Record<string, unknown>
    geometry: { type: string; coordinates: unknown }
  }
  interface ShpFeatureCollection {
    type: 'FeatureCollection'
    features: ShpFeature[]
  }
  export default function shp(
    data: ArrayBuffer | Buffer,
  ): Promise<ShpFeatureCollection | ShpFeatureCollection[]>
}
