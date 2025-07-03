# Node.js backend server
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for bcrypt and other native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create directories for file uploads and recordings
RUN mkdir -p uploads recordings tmp

# Set proper permissions
RUN chmod 755 uploads recordings tmp

# Expose port 5000
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/auth/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the server
CMD ["node", "server.js"] 