# Docker Setup for Real-Time Messaging App

This guide will help you set up and run the real-time messaging application using Docker.

## Prerequisites

- Docker installed on your system
- Docker Compose installed
- MongoDB Atlas account (for database)
- Required API keys (Google OAuth, OpenAI, Groq, ElevenLabs)

## Project Structure

```
360/
├── webrtc-client/          # React frontend
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .dockerignore
├── webrtc-signaling-server/ # Node.js backend
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml
├── env.example
└── DOCKER_SETUP.md
```

## Step-by-Step Setup

### 1. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and fill in your actual values:
   ```bash
   # Required: MongoDB Atlas connection string
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database
   
   # Required: JWT secret (generate a strong random string)
   JWT_SECRET=your-super-secret-jwt-key-here
   
   # Required: Google OAuth credentials
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   
   # Optional: AI services (for enhanced features)
   OPENAI_API_KEY=your-openai-api-key
   GROQ_API_KEY=your-groq-api-key
   ELEVENLABS_API_KEY=your-elevenlabs-api-key
   TTS_VOICE_ID=your-tts-voice-id
   ```

### 2. Build and Run with Docker Compose

1. Build the images:
   ```bash
   docker-compose build
   ```

2. Start the services:
   ```bash
   docker-compose up -d
   ```

3. Check service status:
   ```bash
   docker-compose ps
   ```

4. View logs:
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f frontend
   docker-compose logs -f backend
   ```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/auth/health

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-key` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-your-secret` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for AI features | - |
| `GROQ_API_KEY` | Groq API key for AI features | - |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for TTS | - |
| `TTS_VOICE_ID` | ElevenLabs voice ID | - |
| `SOLR_HOST` | Solr host for LLM context | `clavisds01.feeltiptop.com` |
| `COLL` | Solr collection name | `360calls-speaker` |
| `TURN_USER` | TURN server username | `webrtc` |
| `TURN_PASS` | TURN server password | `webrtc` |
| `PORT` | Backend server port | `5000` |
| `NODE_ENV` | Node environment | `production` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `MAX_FILE_SIZE` | Max file upload size (bytes) | `10485760` |

## Docker Commands

### Development

```bash
# Start services in development mode
docker-compose up

# Start services in background
docker-compose up -d

# Rebuild and start
docker-compose up --build

# View logs
docker-compose logs -f
```

### Production

```bash
# Build for production
docker-compose -f docker-compose.yml build

# Start production services
docker-compose -f docker-compose.yml up -d

# Scale services
docker-compose up -d --scale backend=3
```

### Maintenance

```bash
# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Remove all containers and images
docker-compose down --rmi all

# Clean up unused resources
docker system prune -a
```

## Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Check what's using the port
   lsof -i :3000
   lsof -i :5000
   
   # Kill the process or change ports in docker-compose.yml
   ```

2. **MongoDB connection failed**:
   - Verify your MongoDB Atlas connection string
   - Check if your IP is whitelisted in MongoDB Atlas
   - Ensure the database user has proper permissions

3. **Build fails**:
   ```bash
   # Clean build cache
   docker-compose build --no-cache
   
   # Check Docker logs
   docker-compose logs build
   ```

4. **Services not starting**:
   ```bash
   # Check service health
   docker-compose ps
   
   # View detailed logs
   docker-compose logs backend
   ```

### Health Checks

The backend service includes a health check. You can monitor it:

```bash
# Check health status
docker-compose ps

# View health check logs
docker inspect --format='{{json .State.Health}}' $(docker-compose ps -q backend)
```

## File Storage

The application uses Docker volumes for file storage:

- `./webrtc-signaling-server/uploads` - User uploaded files
- `./webrtc-signaling-server/recordings` - Meeting recordings
- `./webrtc-signaling-server/tmp` - Temporary files

These directories are automatically created and persist between container restarts.

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to version control
2. **JWT Secret**: Use a strong, random secret for JWT_SECRET
3. **API Keys**: Keep API keys secure and rotate them regularly
4. **CORS**: Configure CORS_ORIGIN for your production domain
5. **Ports**: Consider using reverse proxy (nginx, traefik) for production

## Production Deployment

For production deployment:

1. Use a reverse proxy (nginx, traefik)
2. Set up SSL/TLS certificates
3. Configure proper CORS origins
4. Use environment-specific configurations
5. Set up monitoring and logging
6. Configure backup strategies for volumes

## Support

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify environment variables are set correctly
3. Ensure all required services are running
4. Check network connectivity between containers 