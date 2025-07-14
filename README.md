# Comm360 - Real-time Messaging and Collaboration Platform

A modern real-time messaging and collaboration application built with React/Vite frontend and Node.js backend, featuring WebRTC video calls, AI-powered avatars, and real-time messaging.

## 🚀 Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed
- Environment variables configured

### 1. Clone the Repository
```bash
git clone https://github.com/Simratrattey/360.git
cd 360
```

### 2. Set Up Environment Variables
```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file with your configuration
nano .env
```

**Required Environment Variables:**
```env
# Database
MONGO_URI=your_mongodb_connection_string

# JWT
JWT_SECRET=your_jwt_secret

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI Services (optional)
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key

# TTS (optional)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
TTS_VOICE_ID=your_voice_id

# Solr (optional)
SOLR_HOST=your_solr_host
COLL=your_collection_name
WHOSE_AVATAR=avatar_name
NUMUTTER=number_of_utterances

# TURN Server (optional)
TURN_USER=your_turn_username
TURN_PASS=your_turn_password

# File Upload
MAX_FILE_SIZE=52428800
```

### 3. Build and Run with Docker Compose
```bash
# Build and start the application
docker-compose up --build

# Or run in detached mode
docker-compose up --build -d
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

### 5. Stop the Application
```bash
# Stop and remove containers
docker-compose down

# Stop and remove containers + volumes
docker-compose down -v
```

## 🐳 Alternative: Build and Run with Docker

### Build the Image
```bash
# Build the Docker image
docker build -t comm360:latest .

# Or with a specific tag
docker build -t comm360:v1.0.0 .
```

### Run the Container
```bash
# Run with environment file
docker run -p 3000:80 -p 5000:5000 --env-file .env comm360:latest

# Or with specific environment variables
docker run -p 3000:80 -p 5000:5000 \
  -e MONGO_URI=your_mongo_uri \
  -e JWT_SECRET=your_jwt_secret \
  comm360:latest
```

## 🏗️ Local Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- MongoDB

### Frontend Setup
```bash
cd webrtc-client
npm install
npm run dev
```

### Backend Setup
```bash
cd webrtc-signaling-server
npm install
npm start
```

## 📁 Project Structure

```
360/
├── webrtc-client/          # React/Vite frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── webrtc-signaling-server/ # Node.js backend
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml      # Multi-service orchestration
├── Dockerfile             # Single image build
├── nginx.conf             # Nginx configuration
├── .env.example           # Environment variables template
└── README.md              # This file
```

## 🔧 Configuration

### Nginx Configuration
The application uses Nginx to serve the frontend and proxy API requests to the backend. The configuration is in `nginx.conf`.

### Environment Variables
All configuration is done through environment variables. See `env.example` for the complete list.

## 🚀 Features

- **Real-time Messaging**: Instant messaging with Socket.io
- **Video Calls**: WebRTC-powered video conferencing
- **AI Avatars**: AI-powered avatar interactions
- **File Sharing**: Secure file upload and sharing
- **User Authentication**: JWT-based authentication
- **Responsive Design**: Mobile-first responsive UI
- **Message Reactions**: Emoji reactions on messages
- **Typing Indicators**: Real-time typing status
- **Message Status**: Read receipts and delivery status

## 🛠️ Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the ports
   lsof -i :3000
   lsof -i :5000
   
   # Kill the process or use different ports
   docker-compose up -p 3001:80 -p 5001:5000
   ```

2. **Environment Variables Not Loading**
   ```bash
   # Check if .env file exists
   ls -la .env
   
   # Verify environment variables in container
   docker-compose exec comm360 env
   ```

3. **Build Failures**
   ```bash
   # Clean Docker cache
   docker system prune -a
   
   # Rebuild without cache
   docker-compose build --no-cache
   ```

4. **Database Connection Issues**
   - Verify MongoDB URI in `.env`
   - Check network connectivity
   - Ensure MongoDB is running

### Logs
```bash
# View application logs
docker-compose logs comm360

# Follow logs in real-time
docker-compose logs -f comm360

# View specific service logs
docker-compose logs -f comm360
```

## 📝 License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

## 🤝 Support

For technical support or questions, please contact the development team.