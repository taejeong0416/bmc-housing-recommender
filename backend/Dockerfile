# 루트 컨텍스트(context: .) — npm workspaces 전체 설치 후 backend만 빌드.
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
# @prisma/client 실제 클라이언트 생성 — 스키마가 backend/에 있어 npm ci의 postinstall
# 자동 생성(루트 ./prisma 탐색)이 못 찾는다. 빠지면 부팅 시 "run prisma generate" 크래시.
# prisma CLI는 루트 .bin에 호이스팅되지 않으므로 workspace 경유로 실행(backend 디렉터리 기준).
RUN npm exec -w backend -- prisma generate
RUN npm run build -w backend

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
# @prisma/client·prisma는 루트로 호이스팅되지 않고 backend/node_modules에 설치된다
# (생성된 .prisma 클라이언트 포함) — 함께 복사해야 런타임 require가 산다.
COPY --from=build /app/backend/node_modules ./backend/node_modules
# node_modules/@bmc/shared-types는 packages/로의 워크스페이스 심링크 —
# 실체(dist)를 함께 복사해야 런타임 require가 깨지지 않는다.
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
EXPOSE 3000
CMD ["node", "backend/dist/main.js"]
