#!/usr/bin/env bash
set -e

docker network create comm360-net 2>/dev/null || true

BRANCH=${1:-main}

NAME=comm360-client-staging
IMAGE=comm360-client

docker stop ${NAME} 2>/dev/null || true
docker rm   ${NAME} 2>/dev/null || true

eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519github
timestamp=$(date +%Y%m%d%H%M%S)

cp .env webrtc-client/.env

docker build --no-cache --ssh default \
  --build-arg GIT_BRANCH=${BRANCH} \
  -t ${IMAGE}:latest \
  -f webrtc-client/Dockerfile \
  webrtc-client
docker tag ${IMAGE}:latest ${IMAGE}:${timestamp}

docker run -d \
  --network comm360-net \
  -p 3050:80 \
  --name ${NAME} \
  --env-file .env \
  ${IMAGE}:${timestamp}