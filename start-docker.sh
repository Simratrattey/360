#!/bin/bash

# Docker Quick Start Script for Real-Time Messaging App

set -e

echo "🚀 Starting Real-Time Messaging App with Docker..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    if [ -f env.example ]; then
        cp env.example .env
        echo "📝 Please edit .env file with your actual values before continuing."
        echo "   Required: MONGO_URI, JWT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
        echo "   Optional: OPENAI_API_KEY, GROQ_API_KEY, ELEVENLABS_API_KEY, TTS_VOICE_ID"
        exit 1
    else
        echo "❌ env.example not found. Please create a .env file manually."
        exit 1
    fi
fi

# Check if required environment variables are set
source .env

required_vars=("MONGO_URI" "JWT_SECRET" "GOOGLE_CLIENT_ID" "GOOGLE_CLIENT_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ] || [ "${!var}" = "your-*" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing or invalid required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo "📝 Please update your .env file with valid values."
    exit 1
fi

echo "✅ Environment variables validated"

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Build images
echo "🔨 Building Docker images..."
docker-compose build

# Start services
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo "📊 Service status:"
docker-compose ps

# Check if services are healthy
echo "🏥 Health check:"
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running"
    
    # Test backend health
    if curl -f http://localhost:5000/api/auth/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy"
    else
        echo "⚠️  Backend health check failed (this is normal during startup)"
    fi
    
    echo ""
    echo "🎉 Application is starting up!"
    echo "📱 Frontend: http://localhost:3000"
    echo "🔧 Backend:  http://localhost:5000"
    echo ""
    echo "📋 Useful commands:"
    echo "   View logs:     docker-compose logs -f"
    echo "   Stop services: docker-compose down"
    echo "   Restart:       docker-compose restart"
    echo ""
    echo "🔍 Monitoring logs..."
    docker-compose logs -f --tail=50
else
    echo "❌ Services failed to start"
    echo "📋 Check logs with: docker-compose logs"
    exit 1
fi 