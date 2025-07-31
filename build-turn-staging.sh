#!/usr/bin/env bash
set -e

docker network create comm360-net 2>/dev/null || true

NAME=comm360-coturn-staging
IMAGE=comm360-coturn

docker stop ${NAME} 2>/dev/null || true
docker rm   ${NAME} 2>/dev/null || true

eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519github
timestamp=$(date +%Y%m%d%H%M%S)

docker build --no-cache --ssh default \
  -t ${IMAGE}:latest \
  -f coturn/Dockerfile \
  .
docker tag ${IMAGE}:latest ${IMAGE}:${timestamp}

docker run -d \
  --network comm360-net \
  -p 3478:3478 \
  -p 3478:3478/udp \
  --env-file .env \
  --name ${NAME} \
  ${IMAGE}:${timestamp}