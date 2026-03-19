# Stage 1: Install all deps and build
FROM node:22-alpine3.22 AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Stage 2: Production deps only (clean install)
FROM node:22-alpine3.22 AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && \
    # Remove Go binaries from esbuild (pulled transitively by better-auth peer deps)
    find node_modules -name "esbuild" -type d -exec rm -rf {} + 2>/dev/null; \
    find node_modules -name "@esbuild" -type d -exec rm -rf {} + 2>/dev/null; \
    find node_modules -name "@esbuild-kit" -type d -exec rm -rf {} + 2>/dev/null; \
    find node_modules -name "drizzle-kit" -type d -exec rm -rf {} + 2>/dev/null; \
    true

# Stage 3: Runtime (minimal)
FROM node:22-alpine3.22 AS runtime
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY drizzle ./drizzle

USER appuser
EXPOSE 3200

CMD ["node", "dist/index.js"]
