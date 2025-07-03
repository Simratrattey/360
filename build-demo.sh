#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Building Real-Time Messaging App Demo${NC}"
echo "=================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is available${NC}"

# Build the Docker image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
docker build -t comm360-app .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image built successfully!${NC}"
else
    echo -e "${RED}❌ Failed to build Docker image${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🎉 Build completed successfully!${NC}"
echo ""
echo -e "${YELLOW}To run the application:${NC}"
echo "  docker run -p 3000:80 -p 5000:5000 comm360-app"
echo ""
echo -e "${YELLOW}Or use Docker Compose:${NC}"
echo "  docker-compose -f docker-compose.demo.yml up"
echo ""
echo -e "${YELLOW}Access the application at:${NC}"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:5000"
echo "  Health Check: http://localhost:3000/health"
echo ""
echo -e "${GREEN}📖 See DEMO_README.md for detailed instructions${NC}" 