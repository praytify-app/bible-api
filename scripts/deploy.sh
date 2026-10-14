#!/usr/bin/env bash
set -euo pipefail

# === Praytify Bible Deploy Script ===
# Builds images for linux/amd64, pushes to Docker Hub
#
# Usage:
#   ./scripts/deploy.sh              # builds + pushes all 3 images with "latest" tag
#   ./scripts/deploy.sh v1.0.0       # builds + pushes with version tag + latest
#   ./scripts/deploy.sh --engine-only   # only build the Bible engine
#   ./scripts/deploy.sh --gateway-only  # only build the gateway
#   ./scripts/deploy.sh --portal-only   # only build the developer portal

DOCKER_USER="novashock"
BIBLE_API_IMAGE="${DOCKER_USER}/praytify-bible-engine"
GATEWAY_IMAGE="${DOCKER_USER}/praytify-bible-gateway"
PORTAL_IMAGE="${DOCKER_USER}/praytify-bible-portal"

TAG="${1:-$(git rev-parse --short HEAD)}"
BUILD_ENGINE=true
BUILD_GATEWAY=true
BUILD_PORTAL=true

if [ "$TAG" = "--engine-only" ]; then
  BUILD_GATEWAY=false; BUILD_PORTAL=false; TAG="$(git rev-parse --short HEAD)"
elif [ "$TAG" = "--gateway-only" ]; then
  BUILD_ENGINE=false; BUILD_PORTAL=false; TAG="$(git rev-parse --short HEAD)"
elif [ "$TAG" = "--portal-only" ]; then
  BUILD_ENGINE=false; BUILD_GATEWAY=false; TAG="$(git rev-parse --short HEAD)"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GATEWAY_DIR="$(dirname "$SCRIPT_DIR")"
BIBLE_API_DIR="${GATEWAY_DIR}/../open-bible-api"
PORTAL_DIR="${GATEWAY_DIR}/portal"

echo "=== Praytify Bible Deploy ==="
echo "Docker Hub: ${DOCKER_USER}"
echo "Tag: ${TAG}"
echo ""

# Ensure buildx builder exists for multi-platform
if ! docker buildx inspect praytify-builder &>/dev/null; then
  echo "Creating buildx builder..."
  docker buildx create --name praytify-builder --use
else
  docker buildx use praytify-builder
fi

# Build + push Bible engine
if [ "$BUILD_ENGINE" = true ]; then
  echo ">>> Building ${BIBLE_API_IMAGE}:${TAG} (linux/amd64)..."
  docker buildx build \
    --platform linux/amd64 \
    --tag "${BIBLE_API_IMAGE}:${TAG}" \
    --tag "${BIBLE_API_IMAGE}:latest" \
    --push \
    "${BIBLE_API_DIR}"
  echo ">>> Pushed ${BIBLE_API_IMAGE}:${TAG}"
  echo ""
fi

# Build + push gateway
if [ "$BUILD_GATEWAY" = true ]; then
  echo ">>> Building ${GATEWAY_IMAGE}:${TAG} (linux/amd64)..."
  docker buildx build \
    --platform linux/amd64 \
    --tag "${GATEWAY_IMAGE}:${TAG}" \
    --tag "${GATEWAY_IMAGE}:latest" \
    --push \
    "${GATEWAY_DIR}"
  echo ">>> Pushed ${GATEWAY_IMAGE}:${TAG}"
  echo ""
fi

# Build + push portal
if [ "$BUILD_PORTAL" = true ]; then
  echo ">>> Building ${PORTAL_IMAGE}:${TAG} (linux/amd64)..."
  docker buildx build \
    --platform linux/amd64 \
    --build-arg VITE_API_URL="${VITE_API_URL:-https://api.praytify.bible}" \
    --build-arg VITE_PUBLIC_SEARCH_KEY="${VITE_PUBLIC_SEARCH_KEY:-}" \
    --file "${PORTAL_DIR}/Dockerfile" \
    --tag "${PORTAL_IMAGE}:${TAG}" \
    --tag "${PORTAL_IMAGE}:latest" \
    --push \
    "${GATEWAY_DIR}"
  echo ">>> Pushed ${PORTAL_IMAGE}:${TAG}"
  echo ""
fi

echo "=== Deploy Complete ==="
echo ""
echo "Images pushed:"
[ "$BUILD_ENGINE" = true ] && echo "  ${BIBLE_API_IMAGE}:${TAG}"
[ "$BUILD_GATEWAY" = true ] && echo "  ${GATEWAY_IMAGE}:${TAG}"
[ "$BUILD_PORTAL" = true ] && echo "  ${PORTAL_IMAGE}:${TAG}"
echo ""
echo "On your VPS, run: docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d"
echo "Rollback: pin to previous tag in docker-compose.prod.yml"
