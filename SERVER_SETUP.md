# Server Setup for Video Calls and Real-Time Features

This document describes all requirements and setup steps for enabling video calls, real-time messaging, and collaboration features in the Comm360 platform.

---

## 1. Architecture Overview
- The platform is designed to run using **Docker Compose** for easy orchestration of all services.
- **nginx** acts as a reverse proxy, routing all user traffic to the correct service (frontend or backend).
- The stack consists of three main containers:
  - `nginx` (reverse proxy)
  - `frontend` (React/Vite, served as static files)
  - `backend` (Node.js/Express signaling server)
- Persistent volumes are used for uploads, recordings, and temp files.

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
  - `TURN_USER` and `TURN_PASS` (for TURN server, recommended)
  - `VITE_SFU_URL` (URL for the SFU server, required for frontend)
  - `PUBLIC_IP` (public IP for SFU, required for backend)
  - Any other required settings for your deployment

---

## 4. TURN/STUN Servers (Recommended for WebRTC)
- For reliable video calls across NAT/firewalls, configure a TURN server (e.g., [coturn](https://github.com/coturn/coturn)).
- Set `TURN_USER` and `TURN_PASS` in your `.env` if using a TURN server.

---

## 5. Docker & Docker Compose Setup

### Prerequisites
- Docker and Docker Compose installed on your server
- `.env` file configured with all required environment variables

### Build and Run the Stack
```sh
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up --build -d
```

### Stopping the Stack
```sh
docker-compose down
```

### Volumes
- The backend uses Docker volumes for persistent storage:
  - `uploads` (for file uploads)
  - `recordings` (for meeting recordings)
  - `tmp` (for temporary files)
- These are defined in `docker-compose.yml` and mapped to the backend container.

---

## 6. nginx Reverse Proxy
- nginx is the only service exposed to the outside world (port 80).
- All HTTP/WebSocket traffic goes through nginx, which:
  - Serves static frontend files
  - Proxies `/api`, `/uploads`, and `/socket.io` to the backend
- The nginx configuration is defined in `nginx.conf` and used in the custom nginx Docker image (`nginx.Dockerfile`).

---

## 7. Networking & Ports
- Only port `80` (nginx) needs to be open to the public.
- All other services communicate over the internal Docker network.
- If using a TURN server or custom mediasoup ports, ensure those are open as needed.

---

## 8. CI/CD & Image Pulling (Optional)
- If using CI/CD (e.g., GitHub Actions), Docker images for each service can be built and pushed to a container registry.
- On your server, you can pull the latest images and run with the same `docker-compose.yml`.
- Update the `image:` fields in `docker-compose.yml` if pulling from a registry instead of building locally.

---

## Quick Setup Checklist

1. **MongoDB:**  
   - Deploy MongoDB and set `MONGO_URI` in your `.env`.
2. **Environment:**  
   - Copy `env.example` to `.env` and fill in all required values.
3. **TURN Server (Recommended):**  
   - Deploy a TURN server and set credentials in `.env`.
4. **Docker Compose:**  
   - Build and run the stack with `docker-compose up --build`.
5. **Networking:**  
   - Open port 80 (nginx) and any TURN/mediasoup ports as needed.

---

## Example .env Files for External SFU, TURN, and Cloud MongoDB

### Frontend (.env)
```env
# Backend API
VITE_API_URL=https://your-backend-domain-or-ip

# SFU (hosted on EC2)
VITE_SFU_URL=https://sfu.comm360.space

# TURN (hosted on EC2)
VITE_TURN_SERVER_URL=turn:54.210.247.10:3478
VITE_TURN_USERNAME=webrtc
VITE_TURN_PASSWORD=webrtc

# Other frontend variables...
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_ENABLE_RECORDING=true
VITE_ENABLE_BOT_FEATURES=true
VITE_PORT=3000
```

### Backend (.env)
```env
# MongoDB (cloud, e.g., Atlas)
MONGO_URI=mongodb+srv://your-mongodb-atlas-connection-string

# TURN (hosted on EC2)
TURN_USER=webrtc
TURN_PASS=webrtc

# SFU (if backend needs to know, e.g., for ICE config)
PUBLIC_IP=your-ec2-public-ip

# Other backend variables...
JWT_SECRET=your-super-secret-jwt-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
PORT=5000
NODE_ENV=production
BACKEND_URL=https://your-backend-domain-or-ip
CORS_ORIGIN=https://your-frontend-domain-or-ip
MAX_FILE_SIZE=10485760
```

---

## Example `.env` Entries

```
