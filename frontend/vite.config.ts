import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  // 개발 포트 고정 — 데모/문서의 접속 주소를 항상 localhost:5173으로 일치시킨다.
  server: {
    port: 5173,
    strictPort: true,
    // /api → 로컬 NestJS. 실백엔드 모드(VITE_API_BASE_URL=/)와
    // 목+실AI 하이브리드(VITE_AI_PROXY=1)의 AI 요청을 모두 백엔드로 넘긴다.
    proxy: {
      '/api': 'http://localhost:3000',
    },
    // 터널(cloudflared/ngrok 등)로 공개 데모할 때 임의 서브도메인 허용.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.loca.lt'],
  },
})
