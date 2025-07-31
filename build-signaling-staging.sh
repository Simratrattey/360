#!/usr/bin/env bash
set -e

docker network create comm360-net 2>/dev/null || true

# pick a branch (defaults to "staging")
BRANCH=${1:-main}

NAME=comm360-signaling-staging
IMAGE=comm360-signaling

# 1️⃣ stop & remove old
docker stop ${NAME} 2>/dev/null || true
docker rm   ${NAME} 2>/dev/null || true

# 2️⃣ ssh-agent + cache‑bust
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519github
timestamp=$(date +%Y%m%d%H%M%S)

# 3️⃣ build & tag (no cache)
docker build --no-cache --ssh default \
  --build-arg GIT_BRANCH=${BRANCH} \
  --build-arg SERVER_PORT=5050 \
  -t ${IMAGE}:latest \
  -f webrtc-signaling-server/Dockerfile \
  .
docker tag ${IMAGE}:latest ${IMAGE}:${timestamp}

# 4️⃣ run
docker run -d \
  --network comm360-net \
  -p 5050:5050 \
  --name ${NAME} \
  --env-file .env \
  ${IMAGE}:${timestamp}