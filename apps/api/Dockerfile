# NestJS API 이미지. 빌드 컨텍스트는 저장소 루트다 (workspace의 shared 패키지가 필요).
#   docker build -f apps/api/Dockerfile .
# 로컬에 Docker가 없으면 scripts/deploy-api.mjs가 CodeBuild에서 빌드한다.

FROM public.ecr.aws/docker/library/node:22-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

# 의존성 먼저 (소스가 바뀌어도 이 층은 캐시된다). postinstall이 prisma generate라 스키마도 같이 넣는다
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --filter @zipazum/api... --filter @zipazum/shared

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @zipazum/shared build \
 && pnpm --filter @zipazum/api exec prisma generate \
 && pnpm --filter @zipazum/api build \
 && pnpm --filter @zipazum/api deploy --prod --legacy --ignore-scripts /out \
 && rm -rf /out/src /out/test /out/scripts /out/*.tsbuildinfo

FROM public.ecr.aws/docker/library/node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 4000
CMD ["node", "--enable-source-maps", "dist/main.js"]
