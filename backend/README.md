# Backend (API 서버)

NestJS(TypeScript) + Prisma + PostgreSQL/PostGIS. **배포 런타임에는 쓰이지 않는다** — 앱은 정적 배포로 완결되고, 이 서버는 개발·검증 경로이자 실서비스 전환 시의 기반이다.

## 실행

```bash
docker compose up -d db          # 루트에서 — PostGIS (호스트 55432)
npm run db:push -w backend       # 스키마 반영
npm run db:seed -w backend       # data/out/canonical.json 적재 (멱등)
npm run start:dev -w backend     # http://localhost:3000
```

환경변수는 `backend/.env`(예시 `.env.example`) — `PORT`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`(폴백용, 선택). 두 키가 모두 없으면 `/api/search/nl`은 503으로 설정을 안내한다.

## 모듈

| 경로               | 내용                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `src/health/`      | `GET /api/health` — DB ping 포함                                          |
| `src/housings/`    | `GET /api/housings`(필터·정렬·페이지) · `GET /api/housings/:id`            |
| `src/meta/`        | `GET /api/meta/filters` — 공급유형·지역 옵션(DB distinct)                 |
| `src/search/`      | `POST /api/search/nl` — 자연어 → 구조화 필터(Claude structured outputs, Gemini 폴백) |
| `src/config/`      | zod env 검증 · 로깅                                                       |
| `src/prisma/`      | Prisma 클라이언트 모듈                                                     |

응답 타입은 `@bmc/shared-types`가 단일 원천이라 프론트와 동형이다. 공간 컬럼은 Prisma `Unsupported("geometry(...,4326)")` + `$queryRaw`(`ST_DWithin`)로 다룬다.

`src/search/search.service.ts`의 프롬프트·스키마는 `functions/api/search/nl.ts`(Cloudflare Pages Function)와 동형 사본이다 — 한쪽을 고치면 다른 쪽도 함께 고친다.

## 잔여

- 프론트–백엔드 실연결(현재 프론트는 번들 JSON으로 로컬 계산).
- 스키마 반영이 `prisma db push` — 정식 Migrate 이력화 미도입.
- `prisma/score.ts` / `complex_tag_scores`는 옛 퍼센타일 스코어링 잔재로 미사용.
