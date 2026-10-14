# syntax=docker/dockerfile:1.7
# Praytify Bible portal: a static SPA served by unprivileged nginx.

ARG NODE_IMAGE=node:24.21-alpine3.24
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.5-alpine3.24-slim

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack install
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
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
# net.ipv4.ip_unprivileged_port_start=0 (set explicitly in the prod compose).
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/health || exit 1
