# Server Setup for Video Calls and Real-Time Features

This document describes all requirements and setup steps for enabling video calls, real-time messaging, and collaboration features in the Comm360 platform.

---

## 1. WebRTC Signaling Server
- The backend (`webrtc-signaling-server`) must be running and accessible to all clients.
- Handles signaling for WebRTC (negotiating connections, exchanging ICE candidates, etc.).
- Uses [mediasoup](https://mediasoup.org/) for SFU (Selective Forwarding Unit) to support multi-party video calls.

### Dependencies
- Node.js 18+
- System packages (for Alpine Linux):
  - `python3`, `py3-pip`, `py3-invoke`, `make`, `g++`, `libffi-dev`, `openssl-dev`
- All Node.js dependencies installed (`npm ci`)

### Ports
- HTTP/WebSocket port (default: `5000`)
- Mediasoup may require additional UDP/TCP ports for media transport (see mediasoup config)

---

## 2. MongoDB Database
- MongoDB is required for user accounts, messages, meetings, and other persistent data.
- Deploy a MongoDB instance accessible to the backend.
- Set the `MONGO_URI` environment variable in your `.env` file to point to your MongoDB connection string.

---

## 3. Environment Variables
- Copy `env.example` to `.env` and fill in all required values:
  - `MONGO_URI` (MongoDB connection string)
  - `JWT_SECRET` (for authentication)
  - Optional: Google OAuth, AI services, TURN server credentials, etc.

---

## 4. TURN/STUN Servers (Recommended for WebRTC)
- For reliable video calls across NAT/firewalls, configure a TURN server (e.g., [coturn](https://github.com/coturn/coturn)).
- Set `TURN_USER` and `TURN_PASS` in your `.env` if using a TURN server.

---

## 5. Nginx (Optional, for Production)
- Use the provided `nginx.conf` to serve the frontend and proxy API/WebSocket requests to the backend.

---

## 6. Networking
- Open necessary ports:
  - `5000` for backend API/WebSocket
  - `3000` for frontend (if not using Nginx)
  - TURN/mediasoup ports as needed (see their configs)

---

## Quick Setup Checklist

1. **MongoDB:**  
   - Deploy MongoDB and set `MONGO_URI` in your `.env`.
2. **Backend:**  
   - Build and run the signaling server (`webrtc-signaling-server`).
   - Ensure all system and Node.js dependencies are installed.
3. **Frontend:**  
   - Build and run the client (`webrtc-client`).
4. **TURN Server (Recommended):**  
   - Deploy a TURN server and set credentials in `.env`.
5. **Networking:**  
   - Open necessary ports (5000 for backend, 3000 for frontend, TURN/mediasoup ports as needed).

---

## Example `.env` Entries

```
MONGO_URI=mongodb://user:password@host:port/dbname
JWT_SECRET=your_jwt_secret
TURN_USER=your_turn_username
TURN_PASS=your_turn_password
# ...other optional settings...
```

---

## Additional Notes
- For production, use Docker Compose or Kubernetes for orchestration.
- Review and adjust `nginx.conf` and Dockerfiles as needed for your environment.
- For best reliability, always use a TURN server in addition to STUN.

---

For further details, see the main README or contact the project maintainers. 