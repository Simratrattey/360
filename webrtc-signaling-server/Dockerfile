# ─── Builder ────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
ARG GIT_BRANCH=main
ARG GITHUB_TOKEN
RUN apt-get update \
 && apt-get install -y git openssh-client python3 python3-pip make g++ libffi-dev libssl-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# trust GitHub host
RUN mkdir -p /root/.ssh && ssh-keyscan github.com >> /root/.ssh/known_hosts
# bust cache each build
# COPY ../timedatenow.txt /timedatenow.txt

# clone full repo & install
RUN echo "🛠️  Cloning branch: ${GIT_BRANCH}"
RUN --mount=type=ssh git clone --depth 1 \
      --single-branch \
      --branch "${GIT_BRANCH}" \
      'git@github.com:/TipTop-Tech/Comm360.git' /app
WORKDIR /app/webrtc-signaling-server
RUN npm ci --only=production

# ─── Runtime ────────────────────────────────────────────────────────────────
FROM node:20-slim
RUN apt-get update \
 && apt-get install -y python3 make g++ libffi-dev libssl-dev \
 && apt-get install -y curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# pull in built code & deps
COPY --from=builder /app/webrtc-signaling-server ./

# prepare storage dirs
RUN mkdir -p uploads recordings tmp && chmod 755 uploads recordings tmp

EXPOSE ${SERVER_PORT:-5050}
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:${PORT:-5050}/healthz || exit 1

CMD ["node","server.js"]
