// generated/에 데이터가 없으면 합성 픽스처(frontend/src/demo)를 복사해 채운다.
// 공개 저장소를 클론한 직후에도 dev/build가 바로 돌게 하는 용도다. dev·build 앞에서 자동 실행된다.
// 이미 있는 파일은 건드리지 않는다 — 실데이터(`npm run ingest` 산출)를 덮어쓰면 안 된다.
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const FILES = ['housings.json', 'preference-features.json', 'listing-tags.json']

for (const name of FILES) {
  const target = resolve(ROOT, 'frontend/src/generated', name)
  if (existsSync(target)) continue
  copyFileSync(resolve(ROOT, 'frontend/src/demo', name), target)
  console.log(`[seed] 합성 데모 → generated/${name}`)
}
