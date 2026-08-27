import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { zooDb } from './plugins/zooDb'

/** 게임이 쓰는 고정 포트. 흔한 개발 포트(3000/5173/8080)를 피해 골랐다. */
const GAME_PORT = 29876

export default defineConfig({
  // zooDb 는 정적 서빙 옆에 /api 미들웨어를 얹어 db/ 폴더를 DB 로 쓴다.
  // dev 와 preview 양쪽에 붙으므로 실행 절차와 포트는 그대로다.
  plugins: [react(), zooDb()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  /**
   * 흔히 쓰이지 않는 포트를 골라 고정한다.
   * 자동 이동을 허용했더니 dev 서버가 14개까지 쌓였고,
   * 옛 코드를 들고 있는 좀비 서버에 접속한 채 HMR 오류로 오해했다.
   * `strictPort` 로 점유 시 조용히 옮기지 말고 실패시킨다.
   *
   * `host: true` 는 0.0.0.0 에 바인딩해 같은 네트워크의 다른 기기에서도 접속하게 한다.
   */
  server: {
    port: GAME_PORT,
    strictPort: true,
    host: true,
    open: true,
  },

  preview: {
    port: GAME_PORT,
    strictPort: true,
    host: true,
    open: true,
  },
})
