/// <reference types="vite/client" />

interface Window {
  // Naver Maps SDK — useNaverMap이 <script>로 로드(P6). 공식 타입 패키지가 없어 loose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  naver: any
  // NCP 지도 인증 실패 시 SDK가 호출하는 전역 콜백.
  navermap_authFailure?: () => void
}
