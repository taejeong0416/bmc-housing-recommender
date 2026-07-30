# Backend (API 서버)

NestJS(TypeScript) 기반 API 서버. 스택: NestJS + PostgreSQL/PostGIS + Docker.

## 현재 (P2-A)
- NestJS 스캐폴드 + `@nestjs/config`(zod env 검증) + `GET /health`.
- 실행: 루트에서 `npm run build -w backend` → `npm run start -w backend` (기본 `:3000`).
- 환경변수: `backend/.env`(예시 `.env.example`) — `PORT`, `DATABASE_URL`(P2-B에서 필수).

## 예정 (docs/PRODUCTION_PLAN.md P2~)
- P2-B: Prisma + PostGIS 스키마·마이그레이션·시드(`data/out/canonical.json` 적재).
- P2-C: 코어 API(`GET /housings`, `/housings/:id`, `/meta/filters`) — 응답은 `GeneratedHousing`과 동형.
- P2-D: docker-compose(db·api) + `/health` DB ping.
- 모듈 골격: auth · users · housings · pois · recommend · search · notifications.
