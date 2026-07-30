import { configDefaults, defineConfig } from 'vitest/config'

// 루트 vitest — frontend·scripts/ingest 유닛테스트를 수집한다.
// tag/는 자체 node:test 러너(`node --test tag/test/…`)로 검증하므로 vitest 수집에서 제외.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'tag/**'],
  },
})
