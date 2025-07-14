# 360 WebRTC Client

A modern, professional video conferencing application built with React, WebRTC, and real-time communication features.

## Features

- 🎥 **Real-time Video Conferencing** - High-quality video calls with WebRTC
- 🔐 **Authentication** - Secure user authentication with JWT tokens
- 👥 **Multi-participant Support** - Join meetings with multiple users
- 💬 **Real-time Chat** - In-meeting chat functionality
- 📹 **Screen Recording** - Record meetings for later review
- 🤖 **AI Bot Integration** - Text-to-speech and speech-to-text capabilities
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎨 **Modern UI/UX** - Beautiful interface with smooth animations

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, Socket.IO, MongoDB
- **WebRTC**: Peer-to-peer video communication
- **Authentication**: JWT tokens, Google OAuth
- **Real-time**: Socket.IO for signaling and chat
- **AI Features**: ElevenLabs TTS, OpenAI integration

## Backend Integration

This frontend connects to a comprehensive backend that provides:

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/google` - Google OAuth authentication
- `GET /api/auth/me` - Get current user profile

### WebRTC Signaling
- `GET /ice` - Get ICE servers configuration
- `GET /rooms` - Get active rooms
- Socket.IO events for WebRTC signaling

### Recording Management
- `POST /api/recordings` - Upload meeting recordings
- `GET /api/recordings` - List all recordings
- `GET /api/recordings/:roomId` - Get recordings for specific room

### AI Bot Features
- `POST /bot/reply` - Get AI bot responses (text or audio)
- `POST /bot/tts` - Text-to-speech conversion

## Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the root directory:

```env
# Backend API Configuration
VITE_API_URL=https://three60-za2d.onrender.com

# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here

# WebRTC Configuration
VITE_TURN_SERVER_URL=turn:54.210.247.10:3478
VITE_TURN_USERNAME=webrtc
VITE_TURN_PASSWORD=webrtc

# Feature Flags
VITE_ENABLE_RECORDING=true
VITE_ENABLE_BOT_FEATURES=true
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── api/                    # API service layer
│   ├── client.js          # Axios configuration
│   ├── authService.js     # Authentication API calls
│   ├── meetingService.js  # Meeting and recording API calls
│   └── botService.js      # AI bot API calls
├── components/            # Reusable UI components
├── context/              # React context providers
│   ├── AuthContext.jsx   # Authentication state management
│   └── SocketContext.jsx # Socket.IO connection management
├── hooks/                # Custom React hooks
│   └── useWebRTC.js      # WebRTC functionality
├── pages/                # Application pages
│   ├── DashboardPage.jsx
│   ├── LoginPage.jsx
│   ├── MeetingPage.jsx
│   └── ...
└── styles/               # CSS and styling
```

## API Services

### AuthService
Handles all authentication-related API calls with proper error handling:

```javascript
import authService from '../api/authService';

// Login
const result = await authService.login(email, password);
if (result.success) {
  // Handle successful login
} else {
  // Handle error
  console.error(result.error);
}
```

### MeetingService
Manages WebRTC signaling, room management, and recording functionality:

```javascript
import meetingService from '../api/meetingService';

// Get ICE servers
const result = await meetingService.getIceServers();

// Upload recording
const result = await meetingService.uploadRecording(videoBlob, metadata);
```

### BotService
Handles AI bot interactions including TTS and STT:

```javascript
import botService from '../api/botService';

// Get bot reply
const result = await botService.getBotReply(text);

// Text-to-speech
const result = await botService.textToSpeech(text);
```

## WebRTC Integration

The application uses a custom `useWebRTC` hook that provides:

- **Peer Connection Management** - Automatic WebRTC peer connection setup
- **Media Stream Handling** - Local and remote video/audio streams
- **Signaling Integration** - Seamless integration with Socket.IO signaling
- **ICE Candidate Management** - Automatic ICE candidate exchange
- **Connection State Management** - Real-time connection status updates

```javascript
import { useWebRTC } from '../hooks/useWebRTC';

const {
  localStream,
  remoteStreams,
  isConnected,
  participants,
  joinMeeting,
  leaveMeeting,
  createOffer,
} = useWebRTC();
```

## Socket.IO Events

The application handles various Socket.IO events for real-time communication:

### Client → Server
- `newOffer` - Send WebRTC offer
- `newAnswer` - Send WebRTC answer
- `sendIceCandidateToSignalingServer` - Send ICE candidate
- `sendMessage` - Send chat message
- `hangup` - Leave meeting

### Server → Client
- `roomParticipants` - Updated participant list
- `availableOffers` - Available WebRTC offers
- `newOfferAwaiting` - New offer received
- `answerResponse` - Answer received
- `receivedIceCandidateFromServer` - ICE candidate received
- `hangup` - Participant left
- `receiveMessage` - Chat message received

## Authentication Flow

1. **Login/Register** - User authenticates via email/password or Google OAuth
2. **Token Storage** - JWT token stored in localStorage
3. **Auto-login** - Token validated on app startup
4. **Protected Routes** - Routes protected based on authentication status
5. **Socket Authentication** - Socket.IO connections authenticated with JWT

## Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production

Make sure to set these in your deployment platform:

- `VITE_API_URL` - Backend API URL
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `VITE_TURN_SERVER_URL` - TURN server URL
- `VITE_TURN_USERNAME` - TURN server username
- `VITE_TURN_PASSWORD` - TURN server password

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the GitHub repository.
