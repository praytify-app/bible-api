#!/usr/bin/env bash
set -euo pipefail

# === Praytify Bible Deploy Script ===
# Builds both images for linux/amd64, pushes to Docker Hub
#
# Usage:
#   ./scripts/deploy.sh              # builds + pushes with "latest" tag
#   ./scripts/deploy.sh v1.0.0       # builds + pushes with version tag + latest
#   ./scripts/deploy.sh --engine-only   # only build the Bible engine
#   ./scripts/deploy.sh --gateway-only  # only build the gateway

DOCKER_USER="novashock"
BIBLE_API_IMAGE="${DOCKER_USER}/praytify-bible-engine"
GATEWAY_IMAGE="${DOCKER_USER}/praytify-bible-gateway"

TAG="${1:-latest}"
BUILD_ENGINE=true
BUILD_GATEWAY=true

if [ "$TAG" = "--engine-only" ]; then
  BUILD_GATEWAY=false
  TAG="latest"
elif [ "$TAG" = "--gateway-only" ]; then
  BUILD_ENGINE=false
  TAG="latest"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GATEWAY_DIR="$(dirname "$SCRIPT_DIR")"
BIBLE_API_DIR="${GATEWAY_DIR}/../open-bible-api"

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

# Build + push open-bible-api
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

echo "=== Deploy Complete ==="
echo ""
echo "Images pushed:"
[ "$BUILD_ENGINE" = true ] && echo "  ${BIBLE_API_IMAGE}:${TAG}"
[ "$BUILD_GATEWAY" = true ] && echo "  ${GATEWAY_IMAGE}:${TAG}"
echo ""
echo "On your VPS, run: docker compose pull && docker compose up -d"
