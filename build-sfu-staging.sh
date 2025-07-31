#!/usr/bin/env bash
set -e

BRANCH=${1:-main}

NAME=comm360-sfu-staging
IMAGE=comm360-sfu

docker stop ${NAME} 2>/dev/null || true
docker rm   ${NAME} 2>/dev/null || true

eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519github
timestamp=$(date +%Y%m%d%H%M%S)

docker build --no-cache --ssh default \
  --build-arg GIT_BRANCH=${BRANCH} \
  --build-arg SERVER_PORT=8181 \
  -t ${IMAGE}:latest \
  -f webrtc-signaling-server/Dockerfile.sfu \
  .
docker tag ${IMAGE}:latest ${IMAGE}:${timestamp}

docker run -d --network=host \
  --name ${NAME} \
  --env-file .env \
  ${IMAGE}:${timestamp}