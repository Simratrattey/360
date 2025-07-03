# Multi-stage build for complete application
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache python3 make g++ nginx

# Set working directory
WORKDIR /app

# Copy package files for both frontend and backend
COPY webrtc-client/package*.json ./frontend/
COPY webrtc-signaling-server/package*.json ./backend/

# Install dependencies for both applications
WORKDIR /app/frontend
RUN npm ci

WORKDIR /app/backend
RUN npm ci

# Copy source code
WORKDIR /app
COPY webrtc-client ./frontend/
COPY webrtc-signaling-server ./backend/

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Create production image
FROM node:18-alpine AS production

# Install nginx and other dependencies
RUN apk add --no-cache nginx python3 make g++

# Set working directory
WORKDIR /app

# Copy built frontend from builder stage
COPY --from=base /app/frontend/dist /usr/share/nginx/html

# Copy backend from builder stage
COPY --from=base /app/backend ./backend

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create directories for uploads and recordings
RUN mkdir -p /app/backend/uploads/messages /app/backend/uploads/avatars /app/backend/recordings /app/backend/tmp

# Set proper permissions
RUN chmod 755 /app/backend/uploads /app/backend/recordings /app/backend/tmp

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 80 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/auth/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start both services
CMD ["/app/start.sh"] 