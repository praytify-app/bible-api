# syntax=docker/dockerfile:1.7
# Praytify Bible portal: a static SPA served by unprivileged nginx.
# Build from the repository root so the embed package is in context:
#   docker build -f portal/Dockerfile .

ARG NODE_IMAGE=node:24.21-alpine3.24
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.5-alpine3.24-slim

# The <praytify-verse> widget, served by the portal at /embed/v1.js.
FROM ${NODE_IMAGE} AS embed
WORKDIR /embed
COPY packages/embed/package.json packages/embed/pnpm-lock.yaml packages/embed/pnpm-workspace.yaml ./
RUN corepack enable && corepack install
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY packages/embed/ ./
RUN pnpm build

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY portal/package.json portal/pnpm-lock.yaml portal/pnpm-workspace.yaml ./
RUN corepack enable && corepack install
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY portal/ ./
COPY --from=embed /embed/dist/embed.js ./public/embed/v1.js
# Baked into the bundle at build time. VITE_PUBLIC_SEARCH_KEY is a publishable
# key restricted to the portal's origin, so it is safe to ship to browsers.
ARG VITE_API_URL=https://api.praytify.bible
ARG VITE_PUBLIC_SEARCH_KEY=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_PUBLIC_SEARCH_KEY=$VITE_PUBLIC_SEARCH_KEY
RUN pnpm build
# The CSP must allow exactly the API the bundle talks to.
RUN API_ORIGIN=$(node -e "console.log(new URL(process.env.VITE_API_URL).origin)") && \
    sed "s#__API_ORIGIN__#${API_ORIGIN}#g" nginx.conf > /tmp/default.conf

FROM ${NGINX_IMAGE} AS runtime
COPY --from=builder /tmp/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
# The base image runs as uid 101; listening on 80 relies on Docker's default
# net.ipv4.ip_unprivileged_port_start=0 (set explicitly in the compose files).
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/health || exit 1
