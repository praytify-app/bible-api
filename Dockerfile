# syntax=docker/dockerfile:1.7
# Praytify Bible gateway. Three stages so the runtime image carries only
# compiled JS and production dependencies.

ARG NODE_IMAGE=node:24.21-alpine3.24

FROM ${NODE_IMAGE} AS base
WORKDIR /app
# packageManager in package.json pins the exact pnpm release.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack install

FROM base AS builder
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM base AS deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3200
RUN addgroup -S app && adduser -S app -G app
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --from=builder --chown=root:root /app/dist ./dist
COPY --chown=root:root package.json ./
COPY --chown=root:root drizzle ./drizzle
# Code stays root-owned and read-only to the runtime user.
USER app
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3200)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/index.js"]
