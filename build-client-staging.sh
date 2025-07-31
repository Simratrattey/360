#!/usr/bin/env bash
set -e

BRANCH=${1:-main}

NAME=comm360-client-staging
IMAGE=comm360-client

docker stop ${NAME} 2>/dev/null || true
docker rm   ${NAME} 2>/dev/null || true

eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519github
timestamp=$(date +%Y%m%d%H%M%S)

docker build --no-cache --ssh default \
  --build-arg GIT_BRANCH=${BRANCH} \
  -t ${IMAGE}:latest \
  -f webrtc-client/Dockerfile \
  .
docker tag ${IMAGE}:latest ${IMAGE}:${timestamp}

docker run -d --network=host \
  --name ${NAME} \
  --env-file .env \
  ${IMAGE}:${timestamp}