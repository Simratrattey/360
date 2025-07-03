#!/bin/sh

# Function to handle shutdown gracefully
cleanup() {
    echo "Shutting down services..."
    kill $BACKEND_PID $NGINX_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Set environment variables for backend
export NODE_ENV=production
export PORT=5000
export BACKEND_URL=http://localhost:5000
export CORS_ORIGIN=http://localhost

# Start backend server in background
echo "Starting backend server..."
cd /app/backend
node server.js &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "Backend failed to start"
    exit 1
fi

echo "Backend started with PID: $BACKEND_PID"

# Start nginx
echo "Starting nginx..."
nginx -g "daemon off;" &
NGINX_PID=$!

echo "Nginx started with PID: $NGINX_PID"
echo "Application is running!"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost/api"
echo "Health check: http://localhost/health"

# Wait for either process to exit
wait $BACKEND_PID $NGINX_PID 