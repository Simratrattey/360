# 🚀 Real-Time Messaging & Collaboration App - Demo

A modern real-time messaging and collaboration application built with React, Node.js, WebRTC, and Socket.IO.

## 🎯 Features

- **Real-time messaging** with Socket.IO
- **WebRTC video/audio calls** with screen sharing
- **File uploads** (images, documents, videos, audio)
- **User authentication** with JWT and Google OAuth
- **Modern UI** with Tailwind CSS and Framer Motion
- **Responsive design** for all devices
- **Message reactions** and emoji support
- **Typing indicators** and read receipts
- **User avatars** and profiles
- **Meeting recordings** with automatic upload
- **AI-powered features** (optional)
- **Search functionality** with Solr (optional)

## 🏗️ Architecture

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.IO
- **Database**: MongoDB (Atlas or local)
- **Real-time**: WebRTC + Socket.IO
- **File Storage**: Local file system
- **Reverse Proxy**: Nginx

## 🚀 Quick Start

### Option 1: Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd 360
   ```

2. **Build and run with Docker**
   ```bash
   # Build the image
   docker build -t comm360-app .
   
   # Run the application
   docker run -p 3000:80 -p 5000:5000 comm360-app
   ```

3. **Or use Docker Compose**
   ```bash
   # Run with default settings
   docker-compose -f docker-compose.demo.yml up --build
   
   # Run with local MongoDB
   docker-compose -f docker-compose.demo.yml --profile local-db up --build
   ```

### Option 2: Manual Setup

1. **Install dependencies**
   ```bash
   # Frontend
   cd webrtc-client
   npm install
   
   # Backend
   cd ../webrtc-signaling-server
   npm install
   ```

2. **Set up environment variables**
   ```bash
   # Create .env file in webrtc-signaling-server/
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the application**
   ```bash
   # Terminal 1: Backend
   cd webrtc-signaling-server
   npm start
   
   # Terminal 2: Frontend
   cd webrtc-client
   npm run dev
   ```

## 🌐 Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:3000/health

## 🔧 Configuration

### Required Environment Variables

```bash
# Database
MONGO_URI=mongodb://localhost:27017/comm360

# JWT Secret (generate a secure one)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Config
NODE_ENV=production
BACKEND_URL=http://localhost:5000
CORS_ORIGIN=http://localhost:3000
```

### Optional Environment Variables

```bash
# Google OAuth (for Google login)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# AI Services
OPENAI_API_KEY=your-openai-api-key
GROQ_API_KEY=your-groq-api-key

# Text-to-Speech
ELEVENLABS_API_KEY=your-elevenlabs-api-key
TTS_VOICE_ID=your-voice-id

# Search (Solr)
SOLR_HOST=your-solr-host
COLL=your-collection
WHOSE_AVATAR=your-avatar
NUMUTTER=your-numutter

# WebRTC TURN Server
TURN_USER=your-turn-username
TURN_PASS=your-turn-password
```

## 🧪 Testing the Application

### 1. User Registration/Login
- Open http://localhost:3000
- Register a new account or use Google OAuth
- Verify authentication works

### 2. Real-time Messaging
- Open multiple browser tabs/windows
- Log in with different users
- Send messages and verify real-time updates
- Test emoji reactions and file uploads

### 3. WebRTC Calls
- Start a video call between users
- Test audio/video quality
- Try screen sharing
- Test recording functionality

### 4. File Uploads
- Upload different file types (images, documents, videos)
- Verify file preview and download
- Test file size limits

### 5. API Testing
- Test health endpoint: `GET /health`
- Test authentication: `POST /api/auth/login`
- Test file upload: `POST /api/messages/upload`

## 📁 Project Structure

```
360/
├── webrtc-client/          # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   ├── api/           # API services
│   │   └── utils/         # Utility functions
│   ├── public/            # Static assets
│   └── package.json
├── webrtc-signaling-server/ # Node.js backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── middleware/    # Express middleware
│   │   ├── models/        # Database models
│   │   └── utils/         # Utility functions
│   ├── uploads/           # File uploads
│   ├── recordings/        # Meeting recordings
│   └── package.json
├── Dockerfile             # Main Docker image
├── docker-compose.demo.yml # Demo Docker Compose
├── nginx.conf            # Nginx configuration
├── start.sh              # Startup script
└── DEMO_README.md        # This file
```

## 🔍 Key Features Demo

### Real-time Messaging
- Messages appear instantly across all connected clients
- Typing indicators show when users are typing
- Read receipts confirm message delivery
- Emoji reactions and message editing

### WebRTC Video Calls
- High-quality video/audio calls
- Screen sharing capability
- Meeting recording with automatic upload
- Multiple participants support

### File Management
- Drag-and-drop file uploads
- Support for images, documents, videos, audio
- File preview and download
- Organized file categories

### User Experience
- Modern, responsive UI
- Dark/light mode support
- Real-time notifications
- User avatars and profiles

## 🛠️ Development

### Frontend Development
```bash
cd webrtc-client
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
```

### Backend Development
```bash
cd webrtc-signaling-server
npm start            # Start production server
npm run dev          # Start development server
npm run lint         # Run ESLint
```

## 🐳 Docker Commands

```bash
# Build image
docker build -t comm360-app .

# Run container
docker run -p 3000:80 -p 5000:5000 comm360-app

# Run with environment variables
docker run -p 3000:80 -p 5000:5000 \
  -e MONGO_URI=your-mongo-uri \
  -e JWT_SECRET=your-jwt-secret \
  comm360-app

# View logs
docker logs <container-id>

# Access container shell
docker exec -it <container-id> /bin/sh
```

## 🔒 Security Features

- JWT-based authentication
- CORS protection
- Rate limiting on API endpoints
- File upload validation
- XSS protection headers
- Secure WebSocket connections

## 📊 Performance

- Optimized bundle size with Vite
- Gzip compression
- Static file caching
- Efficient WebRTC connections
- Database connection pooling

## 🚨 Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :3000
   lsof -i :5000
   ```

2. **MongoDB connection failed**
   - Verify your MongoDB URI
   - Check network connectivity
   - Ensure database permissions

3. **WebRTC not working**
   - Check TURN server configuration
   - Verify HTTPS in production
   - Check browser permissions

4. **File uploads failing**
   - Check file size limits
   - Verify upload directory permissions
   - Check available disk space

### Logs
```bash
# Docker logs
docker logs <container-id>

# Nginx logs
docker exec <container-id> tail -f /var/log/nginx/access.log
docker exec <container-id> tail -f /var/log/nginx/error.log

# Application logs
docker exec <container-id> tail -f /app/backend/logs/app.log
```

## 📞 Support

For questions or issues:
- Check the troubleshooting section
- Review the logs for error messages
- Ensure all environment variables are set correctly
- Verify network connectivity and firewall settings

---

**Built with ❤️ using modern web technologies** 