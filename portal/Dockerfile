# Stage 1: Build the SPA
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build-time env vars (baked into the static bundle)
ARG VITE_API_URL=https://api.praytify.bible
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm build

# Stage 2: Serve with Nginx (tiny, fast, static-optimized)
FROM nginx:alpine AS runtime

# Patch any vulnerable Alpine packages
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# SPA routing: all paths serve index.html
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # SPA client-side routing \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Cache static assets aggressively \
    location /assets/ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    \
    # Health check \
    location /health { \
        return 200 "ok"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
