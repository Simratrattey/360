# ─── Builder ────────────────────────────────────────────────────────────────
FROM node:18-slim AS builder
ARG GIT_BRANCH=main
ARG GITHUB_TOKEN
RUN apt-get update \
 && apt-get install -y git openssh-client \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN mkdir -p /root/.ssh && ssh-keyscan github.com >> /root/.ssh/known_hosts
# (dropped cache-buster step—timedatenow.txt lives outside this context)
# COPY ../timedatenow.txt /timedatenow.txt

RUN --mount=type=ssh git clone --depth 1 \
      --single-branch \
      --branch "${GIT_BRANCH}" \
      'git@github.com:/TipTop-Tech/Comm360.git' /app
WORKDIR /app/webrtc-client

# Copy .env from root repository (context is now root directory)
COPY .env .env
RUN npm ci && npm run build

# ─── Production (nginx) ───────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/webrtc-client/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
