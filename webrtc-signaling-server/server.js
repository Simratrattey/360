// server.js
import 'dotenv/config';

import path    from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import axios   from 'axios';
import cors    from 'cors';
import multer  from 'multer';
import fs      from 'fs';
import http    from 'http';
import { Server as SocketIO } from 'socket.io';
import User    from './src/models/user.js';
import Message from './src/models/message.js';
import Conversation from './src/models/conversation.js';

import { generateReply } from './llm.js';
import { transcribeAudio } from './stt.js';
import { generateAudio } from './tts.js';

import authRoutes from './src/routes/auth.js';
import authMiddleware from './src/middleware/auth.js';
import conversationRoutes from './src/routes/conversation.js';
import messageRoutes from './src/routes/message.js';
import userRoutes from './src/routes/user.js';
import fileRoutes from './src/routes/file.js';
import meetingRoutes from './src/routes/meetings.js';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from './src/config/database.js';


const app = express();
app.set('trust proxy', 1);

// ── connect MongoDB ─────────────────────────────────────────────
connectDB()
  .then(() => console.log('✅ MongoDB Atlas connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Enable CORS for your front-end origin ──────────────────────────────────
const corsOptions = {
  origin: [
    'https://360-five-nu.vercel.app',
    'https://comm360-milestone1.vercel.app',
    'https://comm360-milestone1.onrender.com',

    // Add more Vercel preview URLs here as needed
    // You can also use a function or regex for more flexibility
    (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow all Vercel preview URLs
      if (origin.includes('vercel.app')) {
        return callback(null, true);
      }
      
      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    }
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─────────────────────────────────────────────────────────────────────────────

// public: register / login / google / me (must be before authMiddleware)
app.use('/api/auth', authRoutes);

// File routes should be accessible to authenticated users, so register before auth middleware
app.use('/api/files', fileRoutes);

app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// ─── Protect all other /api routes with JWT auth ───────────────────────────
// Apply authMiddleware to all /api routes EXCEPT /api/auth and /api/files
app.use('/api', (req, res, next) => {
  // Skip auth middleware for auth routes and file routes
  if (req.path.startsWith('/auth') || req.path.startsWith('/files')) {
    return next();
  }
  return authMiddleware(req, res, next);
});

// ─── Recording upload endpoint ────────────────────────────────────────────
// Temporarily store uploads, then move into a per-session folder
const upload = multer({ dest: 'tmp/' });

app.post('/api/recordings', upload.fields([
  { name: 'video',    maxCount: 1 },
  { name: 'metadata', maxCount: 1 }
]), (req, res) => {
  try {
    // Create a new directory for this session
    const sessionId  = Date.now().toString();
    const sessionDir = path.join(__dirname, 'recordings', sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    // Move video blob
    const vid = req.files.video[0];
    fs.renameSync(vid.path, path.join(sessionDir, 'full.webm'));

    // Move metadata JSON
    const meta = req.files.metadata[0];
    fs.renameSync(meta.path, path.join(sessionDir, 'metadata.json'));

    return res.status(200).send('OK');
  } catch (err) {
    console.error('Error saving recording:', err);
    return res.status(500).send('Error saving recording');
  }
});
// ──────────────────────────────────────────────────────────────────────────

// ─── 1. List all meetings (unique roomIds) ───────────────────────────────
app.get('/api/recordings', (req, res) => {
  const recordingsPath = path.join(__dirname, 'recordings');
  if (!fs.existsSync(recordingsPath)) return res.json({ meetings: [] });

  const sessions = fs.readdirSync(recordingsPath)
    .filter(d => fs.lstatSync(path.join(recordingsPath, d)).isDirectory());

  const meetings = new Set();
  sessions.forEach(sess => {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(recordingsPath, sess, 'metadata.json')));
      if (meta.roomId) meetings.add(meta.roomId);
    } catch {}
  });

  res.json({ meetings: Array.from(meetings) });
});
// ──────────────────────────────────────────────────────────────────────────


// ─── 2. List all clips for one meeting ────────────────────────────────────
app.get('/api/recordings/:roomId', (req, res) => {
  const { roomId } = req.params;
  const recordingsPath = path.join(__dirname, 'recordings');
  if (!fs.existsSync(recordingsPath)) return res.json({ clips: [] });

  const sessions = fs.readdirSync(recordingsPath)
    .filter(d => fs.lstatSync(path.join(recordingsPath, d)).isDirectory());

  const clips = sessions.flatMap(sess => {
    const metaPath = path.join(recordingsPath, sess, 'metadata.json');
    if (!fs.existsSync(metaPath)) return [];
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath));
      if (meta.roomId === roomId) {
        return [{ sessionId: sess, metadata: meta }];
      }
    } catch {}
    return [];
  });

  res.json({ clips });
});
// ──────────────────────────────────────────────────────────────────────────


// ─── 3. Serve your recordings UI under ./public/recordings/ ───────────────
//  (make sure you have public/recordings/index.html & meeting.html)
app.use(express.static(path.join(__dirname, 'public')));

// Visiting /recordings           → public/recordings/index.html
app.get('/recordings', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/recordings/index.html'));
});

// Visiting /recordings/:roomId  → public/recordings/meeting.html
app.get('/recordings/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/recordings/meeting.html'));
});

// 4) Serve raw files at /recordings/files/<sessionId>/*
app.use(
  '/recordings/files',
  express.static(path.join(__dirname, 'recordings'))
);
// ──────────────────────────────────────────────────────────────────────────

// Bot reply endpoint:
//  • If client POSTs multipart/form-data with field "audio", we STT → LLM.
//  • Else if client POSTs JSON { text }, we skip STT and go straight to LLM.
// Returns JSON { reply: "…assistant response text…" }.
app.post(
  '/bot/reply',
  upload.single('audio'),           // parse an uploaded audio file
  express.json({ limit: '1mb' }),   // parse JSON text fallback
  async (req, res) => {
    try {
      let userText;

      // 1) JSON text path (highest priority)
      if (req.body?.text) {
        userText = req.body.text;
      }
      // 2) Audio path
      else if (req.file) {
        // 1) Audio path: read and transcribe
        const audioBuf = await fs.promises.readFile(req.file.path);
        userText = await transcribeAudio(audioBuf, {
          prompt:   '',        // optional STT prompt
          language: 'auto',
          translate: false
        });
      }
      // 3) Neither provided
      else {
        return res.status(400).json({ error: 'No audio or text provided' });
      }

      // 3) LLM reply
      const replyText = await generateReply(userText);

      // 4) Return JSON
      return res.json({ reply: replyText });
    } catch (err) {
      console.error('❌ /bot/reply error:', err);
      return res.status(500).json({ error: 'Bot reply failed', details: err.toString() });
    } finally {
      // Clean up uploaded file
      if (req.file) {
        await fs.promises.unlink(req.file.path).catch(() => {/* ignore */});
      }
    }
  }
);

// TTS endpoint: accepts { text } and returns audio bytes (Opus/WebM)
app.post(
  '/bot/tts',
  express.json({ limit: '200kb' }),
  async (req, res) => {
    try {
      const text = req.body?.text;
      if (!text) return res.status(400).json({ error: 'No "text" provided' });

      // 1) get the raw axios response from ElevenLabs
      const elevenResp = await generateAudio(text);
      const audioBuffer = Buffer.from(elevenResp.data);
      const contentType = elevenResp.headers['content-type'] || 'application/octet-stream';

      // 2) proxy back the exact Content-Type
      res.set({
        'Content-Type':        contentType,
        'Content-Length':      audioBuffer.length,
        'Cache-Control':       'no-cache'
      });
      return res.send(audioBuffer);
    } catch (err) {
      // Unwrap any Buffer payload from Axios
      let detail = err.response?.data;
      if (detail && Buffer.isBuffer(detail)) {
        const str = detail.toString('utf8');
        try {
          detail = JSON.parse(str);
        } catch {
          detail = str;
        }
      }
      console.error('❌ /bot/tts error:', err.message, detail);
      return res.status(500).json({
        error:   'TTS generation failed',
        details: detail || err.message
      });
    }
  }
);
// ─────────────────────────────────────────────────────────────────────

// Health check for Render
app.get('/healthz', (req, res) => res.send('OK'));

// Serve static client files from public/
// app.use(express.static(path.join(__dirname, 'public')));    // removed: front-end now on Vercel

// --- ICE SERVERS CACHING (via Xirsys) ---
let cachedIceServers = [];


// async function refreshIceServers() {
//   try {
//     // 1. Make a PUT to the Xirsys _turn endpoint (no ?format parameter)
//     const response = await axios.put(
//       process.env.XIRSYS_ENDPOINT,
//       {}, // empty body
//       {
//         auth: {
//           username: process.env.XIRSYS_IDENT,
//           password: process.env.XIRSYS_SECRET
//         },
//         headers: {
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     const data = response.data;
//     // 2. Pull out the ICE servers array
//     const servers = data.v?.iceServers
//                   || data.d?.iceServers
//                   || data.iceServers
//                   || [];
//     if (!servers.length) {
//       console.error('❌ No iceServers array in Xirsys response:', data);
//       return;
//     }

//     // 🔧 NORMALISE url → urls  (Xirsys still returns the old key)
//     cachedIceServers = servers.map(s => {
//       // If Xirsys already gave you urls, leave them; otherwise wrap url
//       const urls = s.urls || (s.url ? [s.url] : []);
//       return {
//         urls,
//         username: s.username,
//         credential: s.credential
//       };
//     });
    
//     console.log('🔄 ICE servers refreshed:', cachedIceServers);

//   } catch (err) {
//     console.error('❌ Error fetching ICE servers:', err.message);
//   }
// }

// // Initial fetch and periodic refresh every hour
// refreshIceServers();
// setInterval(refreshIceServers, 1000 * 60 * 60);

// ─── USE ONLY YOUR EC2 coturn ───────────────────────────────
async function refreshIceServers() {
  cachedIceServers = [
    {
      urls: [
        'turn:54.210.247.10:3478?transport=udp',
        'turn:54.210.247.10:3478?transport=tcp'
        // if you enabled TLS on 5349, add:
        // 'turns:54.210.247.10:5349?transport=tcp'
      ],
      username: process.env.TURN_USER || 'webrtc',
      credential: process.env.TURN_PASS || 'webrtc'
    }
  ];
  console.log('🔄 ICE servers (only EC2 TURN):', cachedIceServers);
}

// Set once (no need to refresh unless your creds rotate)
refreshIceServers();


// Expose ICE config to clients
app.get('/ice', (req, res) => {
  if (!cachedIceServers.length) {
    return res.status(503).json({ error: 'ICE servers not yet available' });
  }
  res.json({ iceServers: cachedIceServers });
});
// ---------------------------------------

// Create HTTP server (Render will handle TLS)
const server = http.createServer(app);

// Socket.io with CORS set by env var (e.g. your Vercel URL)
const io = new SocketIO(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow all Vercel preview URLs
      if (origin.includes('vercel.app')) {
        return callback(null, true);
      }
      
      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      // Allow specific origins from environment variable
      if (process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ── Socket Authentication ───────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = id;
    next();
  } catch (e) {
    next(new Error('Unauthorized'));
  }
});

// In-memory signaling state
// Organize offers by room
const rooms = {};
const connectedSockets = [];
const onlineUsers = new Map(); // Track online users
const messageStatus = new Map(); // Track message status

// Socket.io logic
io.on('connection', async socket => {
  // fetch authenticated user
  const user = await User.findById(socket.userId).select('username fullName avatarUrl');
  if (!user) return socket.disconnect(true);
  const userName = user.username;
  
  // Add user to online users
  onlineUsers.set(socket.userId, {
    id: socket.userId,
    username: userName,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    socketId: socket.id,
    lastSeen: new Date()
  });
  
  // Broadcast online status to all users
  io.emit('user:online', { userId: socket.userId, user: onlineUsers.get(socket.userId) });
  
  // roomId can still come from client
  const roomId = socket.handshake.auth.roomId || 'default';
  
  // Initialize room if it doesn't exist
  if (!rooms[roomId]) {
    rooms[roomId] = {
      offers: [],
      participants: []
    };
  }

  // Add user to room participants
  rooms[roomId].participants.push(userName);
  
  // Track socket connection with room info
  connectedSockets.push({ socketId: socket.id, userName, roomId });
  
  // Join socket.io room
  socket.join(roomId);
  
  // Broadcast updated participant list to everyone in the room
  io.to(roomId).emit('roomParticipants', rooms[roomId].participants);

  // Send any existing offers in this room to newcomers
  if (rooms[roomId].offers.length) {
    socket.emit('availableOffers', rooms[roomId].offers);
  }

  socket.on('newOffer', newOffer => {
    const offerObj = {
      offererUserName: userName,
      offer: newOffer,
      offerIceCandidates: [],
      answererUserName: null,
      answer: null,
      answererIceCandidates: [],
      roomId: roomId
    };
    rooms[roomId].offers.push(offerObj);
    
    // Only broadcast to others in the same room
    socket.to(roomId).emit('newOfferAwaiting', [offerObj]);
  });

  socket.on('newAnswer', (offerObj, ack) => {
    const roomOfferObj = rooms[roomId];
    if (!roomOfferObj) return;
    
    const dest = connectedSockets.find(s => s.userName === offerObj.offererUserName && s.roomId === roomId);
    const offerToUpdate = roomOfferObj.offers.find(o => o.offererUserName === offerObj.offererUserName);
    
    if (!dest || !offerToUpdate) return;

    // Send back any ICE candidates collected so far
    ack(offerToUpdate.offerIceCandidates);

    offerToUpdate.answererUserName = userName;
    offerToUpdate.answer = offerObj.answer;

    socket.to(dest.socketId).emit('answerResponse', offerToUpdate);
  });

  socket.on('sendIceCandidateToSignalingServer', iceObj => {
    const { didIOffer, iceUserName, iceCandidate } = iceObj;
    const roomOffers = rooms[roomId]?.offers;
    if (!roomOffers) return;
    
    if (didIOffer) {
      const offerRec = roomOffers.find(o => o.offererUserName === iceUserName);
      if (!offerRec) return;
      offerRec.offerIceCandidates.push(iceCandidate);
      // Forward to answerer if answered
      if (offerRec.answererUserName) {
        const ansDest = connectedSockets.find(s => s.userName === offerRec.answererUserName && s.roomId === roomId);
        if (ansDest) {
          socket.to(ansDest.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
        }
      }
    } else {
      // ICE from answerer → offerer
      const offerRec = roomOffers.find(o => o.answererUserName === iceUserName);
      if (!offerRec) return;
      const offDest = connectedSockets.find(s => s.userName === offerRec.offererUserName && s.roomId === roomId);
      if (offDest) {
        socket.to(offDest.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
      }
    }
  });

  socket.on('hangup', () => {
    // Only notify users in the same room
    socket.to(roomId).emit('hangup', userName);
    
    // Remove user from room participants
    if (rooms[roomId]) {
      const participantIndex = rooms[roomId].participants.indexOf(userName);
      if (participantIndex !== -1) {
        rooms[roomId].participants.splice(participantIndex, 1);
      }
      
      // Remove any offers made by this user in this room
      const roomOffers = rooms[roomId].offers;
      for (let i = roomOffers.length - 1; i >= 0; i--) {
        if (roomOffers[i].offererUserName === userName) {
          roomOffers.splice(i, 1);
        }
      }
      
      // Broadcast updated offers and participants to room
      io.to(roomId).emit('availableOffers', rooms[roomId].offers);
      io.to(roomId).emit('roomParticipants', rooms[roomId].participants);
      
      // If room is empty, clean it up
      if (rooms[roomId].participants.length === 0) {
        delete rooms[roomId];
      }
    }
    
    // Remove socket from tracking
    const socketIndex = connectedSockets.findIndex(s => s.socketId === socket.id);
    if (socketIndex !== -1) {
      connectedSockets.splice(socketIndex, 1);
    }
  });
  
  // Handle disconnections
  socket.on('disconnect', () => {
    // Remove user from online users
    onlineUsers.delete(socket.userId);
    io.emit('user:offline', { userId: socket.userId });
    
    // Clean up the same way as hangup
    if (rooms[roomId]) {
      const participantIndex = rooms[roomId].participants.indexOf(userName);
      if (participantIndex !== -1) {
        rooms[roomId].participants.splice(participantIndex, 1);
      }
      
      // Remove any offers made by this user in this room
      const roomOffers = rooms[roomId].offers;
      for (let i = roomOffers.length - 1; i >= 0; i--) {
        if (roomOffers[i].offererUserName === userName) {
          roomOffers.splice(i, 1);
        }
      }
      
      // Broadcast updated participants to room
      io.to(roomId).emit('roomParticipants', rooms[roomId].participants);
      io.to(roomId).emit('availableOffers', rooms[roomId].offers);
      
      // If room is empty, clean it up
      if (rooms[roomId].participants.length === 0) {
        delete rooms[roomId];
      }
    }
    
    // Remove socket from tracking
    const socketIndex = connectedSockets.findIndex(s => s.socketId === socket.id);
    if (socketIndex !== -1) {
      connectedSockets.splice(socketIndex, 1);
    }
  });

  socket.on('sendMessage', message => {
    // broadcast using fetched userName
    socket.to(roomId).emit('receiveMessage', { userName, message });
  });

  socket.on('avatarOutput', json => {
    const roomId = socket.handshake.auth.roomId;
    socket.to(roomId).emit('avatarOutput', json);
  });

  socket.on('avatarNavigate', ({ index }) => {
    const roomId = socket.handshake.auth.roomId;
    socket.to(roomId).emit('avatarNavigate', { index });
  });

  // --- Real-time chat events ---

  // Join a conversation room
  socket.on('joinConversation', async (conversationId) => {
    socket.join(conversationId);
  });

  // Leave a conversation room
  socket.on('leaveConversation', async (conversationId) => {
    socket.leave(conversationId);
  });

  // Send a new message
  socket.on('chat:send', async ({ conversationId, text, file, replyTo }) => {
    const userId = socket.userId;
    const message = new Message({
      conversation: conversationId,
      sender: userId,
      text,
      file,
      replyTo,
    });
    await message.save();
    await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
    const populated = await message.populate([
      { path: 'sender', select: 'username fullName avatarUrl' },
      { path: 'replyTo', select: 'text file' }
    ]);
    
    // Track message status
    const messageId = message._id.toString();
    messageStatus.set(messageId, {
      sent: true,
      delivered: false,
      read: false,
      recipients: []
    });
    
    io.to(conversationId).emit('chat:new', populated);
    
    // Mark as delivered for online users in the conversation
    const conversation = await Conversation.findById(conversationId).populate('members');
    if (conversation) {
      const onlineRecipients = conversation.members
        .filter(member => member._id.toString() !== userId && onlineUsers.has(member._id.toString()))
        .map(member => member._id.toString());
      
      if (onlineRecipients.length > 0) {
        const status = messageStatus.get(messageId);
        status.delivered = true;
        status.recipients = onlineRecipients;
        io.to(conversationId).emit('chat:delivered', { messageId, recipients: onlineRecipients });
      }
    }
  });

  // Mark message as read
  socket.on('chat:read', async ({ messageId }) => {
    const userId = socket.userId;
    const status = messageStatus.get(messageId);
    if (status && !status.read) {
      status.read = true;
      // Get the conversation ID for this message
      const message = await Message.findById(messageId);
      if (message) {
        io.to(message.conversation.toString()).emit('chat:read', { messageId, userId });
      }
    }
  });

  // Get online users
  socket.on('getOnlineUsers', () => {
    socket.emit('onlineUsers', Array.from(onlineUsers.values()));
  });

  // Edit a message
  socket.on('chat:edit', async ({ messageId, text }) => {
    const userId = socket.userId;
    const message = await Message.findById(messageId);
    if (!message || message.sender.toString() !== userId) return;
    message.text = text;
    message.edited = true;
    await message.save();
    io.to(message.conversation.toString()).emit('chat:edit', { messageId, text });
  });

  // Delete a message
  socket.on('chat:delete', async ({ messageId }) => {
    const userId = socket.userId;
    const message = await Message.findById(messageId);
    if (!message || message.sender.toString() !== userId) return;
    const conversationId = message.conversation.toString();
    await message.deleteOne();
    io.to(conversationId).emit('chat:delete', { messageId });
  });

  // React to a message
  socket.on('chat:react', async ({ messageId, emoji }) => {
    const userId = socket.userId;
    const message = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { reactions: { user: userId, emoji } } },
      { new: true }
    );
    io.to(message.conversation.toString()).emit('chat:react', { messageId, emoji, userId });
  });

  // Remove a reaction
  socket.on('chat:unreact', async ({ messageId, emoji }) => {
    const userId = socket.userId;
    const message = await Message.findByIdAndUpdate(
      messageId,
      { $pull: { reactions: { user: userId, emoji } } },
      { new: true }
    );
    io.to(message.conversation.toString()).emit('chat:unreact', { messageId, emoji, userId });
  });

  // Typing indicator
  socket.on('chat:typing', ({ conversationId, typing }) => {
    socket.to(conversationId).emit('chat:typing', { userId: socket.userId, typing });
  });

});

// API endpoint to get active rooms
app.get('/api/rooms', (req, res) => {
  const activeRooms = Object.keys(rooms).map(roomId => ({
    roomId,
    participantCount: rooms[roomId].participants.length
  }));
  res.json({ rooms: activeRooms });
});

// Register new conversation and message routes
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/meetings', require('./routes/meetings'));

// Serve uploaded message files statically from /uploads/messages at /uploads/messages/*.
app.use('/uploads/messages', (req, res, next) => {
  // Add comprehensive CORS headers for file downloads
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, Accept-Ranges, Origin, X-Requested-With');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  res.header('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Set proper content type based on file extension
  const filePath = req.path;
  const ext = path.extname(filePath).toLowerCase();
  
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.aac': 'audio/aac',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/avi',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv'
  };
  
  if (mimeTypes[ext]) {
    res.setHeader('Content-Type', mimeTypes[ext]);
  }
  
  // Enable range requests for large files
  res.setHeader('Accept-Ranges', 'bytes');
  
  next();
}, express.static(path.join(process.cwd(), 'uploads', 'messages'), {
  // Enable range requests and set additional headers
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, Accept-Ranges, Origin, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  }
}));

// ─── ICE Servers endpoint for WebRTC ─────────────────────────────
app.get('/api/ice', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
      // Add TURN servers here if you have them
    ]
  });
});

// Ensure uploads/avatars directory exists
const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

// Listen on the port Render (or local) specifies
const PORT = process.env.PORT || 8181;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server listening on port ${PORT}`);
});
