# Multi-stage build for Comm360 application
# This builds both frontend and backend in a single image

# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY webrtc-client/package*.json ./

# Install frontend dependencies
RUN npm ci

# Copy frontend source code
COPY webrtc-client/ .

# Build frontend
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY webrtc-signaling-server/package*.json ./

# Install backend dependencies
RUN npm ci

# Copy backend source code
COPY webrtc-signaling-server/ .

# Stage 3: Production image
FROM node:18-alpine AS production

# Install nginx for serving frontend
RUN apk add --no-cache nginx

# Create app directory
WORKDIR /app

# Copy built frontend from frontend-builder
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy backend from backend-builder
COPY --from=backend-builder /app/backend /app/backend

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app/backend' >> /app/start.sh && \
    echo 'npm start &' >> /app/start.sh && \
    echo 'nginx -g "daemon off;"' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose ports
EXPOSE 80 5000

# Start both services
CMD ["/app/start.sh"] 