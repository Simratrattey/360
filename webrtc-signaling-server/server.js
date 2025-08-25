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
import { 
  transcribeAudio, 
  generateAudio, 
  translateText 
} from './realtime-speech/index.js';

import authRoutes from './src/routes/auth.js';
import authMiddleware from './src/middleware/auth.js';
import conversationRoutes from './src/routes/conversation.js';
import messageRoutes from './src/routes/message.js';
import userRoutes from './src/routes/user.js';
import fileRoutes from './src/routes/file.js';
import meetingRoutes from './src/routes/meetings.js';
import sfuRoutes, { producers } from './src/routes/sfu.js';
import notificationRoutes from './src/routes/notification.js';
import { createNotification } from './src/controllers/notificationController.js';

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
const whitelist = (process.env.CORS_WHITELIST || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
whitelist.push('https://360-five-nu.vercel.app');

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // allow mobile apps / curl
    if (whitelist.includes(origin)) return callback(null, true);
    if (origin.includes('vercel.app') || origin.includes('localhost')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
app.use('/api/sfu', authMiddleware, sfuRoutes);
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth') || req.path.startsWith('/files') || req.path.startsWith('/bot') || req.path.startsWith('/broadcast')) {
    return next();
  }
  return authMiddleware(req, res, next);
});

// at top of server.js
import mediasoup from 'mediasoup';

let worker, router;
async function initMediasoup() {
  worker = await mediasoup.createWorker({ 
    rtcMinPort : parseInt(process.env.RTC_MIN_PORT) || 10000,
    rtcMaxPort : parseInt(process.env.RTC_MAX_PORT) || 10100,
    logLevel   : 'debug',
    logTags    : [
      'ice',   // ICE candidate gathering & checks
      'dtls',  // DTLS handshake
      'rtp',   // RTP packets
      'rtcp'   // RTCP reports
    ]
  });
  router = await worker.createRouter({
    mediaCodecs: [
      { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
      { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 }
    ]
  });
  app.locals.mediasoupRouter = router;
  console.log('🛠️  mediasoup router created');
}
initMediasoup();

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
  '/api/bot/reply',
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
      console.error('❌ /api/bot/reply error:', err);
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

// Translation endpoint: accepts { text, sourceLanguage, targetLanguage }
app.post(
  '/api/translate',
  express.json({ limit: '200kb' }),
  async (req, res) => {
    try {
      const { text, sourceLanguage = 'auto', targetLanguage = 'en' } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'No "text" provided' });
      }

      const translatedText = await translateText(text, sourceLanguage, targetLanguage);
      
      return res.json({ 
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage
      });

    } catch (err) {
      console.error('❌ /api/translate error:', err.message);
      return res.status(500).json({
        error: 'Translation failed',
        details: err.message
      });
    }
  }
);

// STT endpoint with fallback for non-FFmpeg environments
app.post(
  '/api/stt',
  upload.single('audio'),
  async (req, res) => {
    try {
      console.log('[STT] Request received:', {
        hasFile: !!req.file,
        body: req.body,
        fileSize: req.file?.size,
        filename: req.file?.filename,
        mimetype: req.file?.mimetype
      });

      if (!req.file) {
        console.error('[STT] No audio file provided');
        return res.status(400).json({ error: 'No audio file provided' });
      }

      console.log('[STT] Reading audio file...');
      const audioBuffer = await fs.promises.readFile(req.file.path);
      const { language = 'auto', translate = false } = req.body;
      
      console.log(`[STT] Processing ${audioBuffer.length} bytes of audio, language=${language}, translate=${translate}`);
      console.log(`[STT] GROQ_API_KEY exists: ${!!process.env.GROQ_API_KEY}`);
      
      const transcription = await transcribeAudio(audioBuffer, {
        language,
        translate: translate === 'true'
      });
      
      console.log(`[STT] Transcription successful: ${transcription}`);
      
      return res.json({ 
        transcription,
        language,
        translate
      });

    } catch (err) {
      console.error('❌ /api/stt error:', err.message);
      console.error('❌ /api/stt stack:', err.stack);
      return res.status(500).json({
        error: 'Speech-to-text failed',
        details: err.message
      });
    } finally {
      // Clean up uploaded file
      if (req.file) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
    }
  }
);

// STT health check endpoint
app.get('/api/stt-health', async (req, res) => {
  try {
    const { transcribeAudio } = await import('./realtime-speech/index.js');
    res.json({ 
      status: 'ok',
      sttAvailable: typeof transcribeAudio === 'function',
      groqKeyConfigured: !!process.env.GROQ_API_KEY,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.json({ 
      status: 'error', 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test FFmpeg availability endpoint
app.get('/api/test-ffmpeg', async (req, res) => {
  try {
    const { checkFFmpegAvailable } = await import('./realtime-speech/audioConverter.js');
    const available = await checkFFmpegAvailable();
    res.json({ ffmpegAvailable: available });
  } catch (err) {
    res.json({ ffmpegAvailable: false, error: err.message });
  }
});

// Debug STT endpoint (for testing without real API keys)
app.post('/api/stt-debug', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioBuffer = await fs.promises.readFile(req.file.path);
    const { language = 'auto', translate = false } = req.body;
    
    console.log(`[STT-DEBUG] Processing ${audioBuffer.length} bytes of audio`);
    console.log(`[STT-DEBUG] Language: ${language}, Translate: ${translate}`);
    console.log(`[STT-DEBUG] GROQ_API_KEY set: ${process.env.GROQ_API_KEY ? 'Yes' : 'No'}`);
    console.log(`[STT-DEBUG] GROQ_API_KEY value: ${process.env.GROQ_API_KEY?.substring(0, 10)}...`);
    
    // Return mock transcription for testing
    const mockTranscription = `Mock transcription for ${audioBuffer.length} bytes of audio data`;
    
    return res.json({ 
      transcription: mockTranscription,
      language,
      translate,
      debug: true
    });

  } catch (err) {
    console.error('❌ /api/stt-debug error:', err.message);
    return res.status(500).json({
      error: 'STT debug failed',
      details: err.message
    });
  } finally {
    // Clean up uploaded file
    if (req.file) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }
  }
});
// ─────────────────────────────────────────────────────────────────────

// Health check for Render
app.get('/healthz', (req, res) => res.send('OK'));

// --- ICE SERVERS CACHING (via Xirsys) ---
let cachedIceServers = [];

// ─── USE ONLY YOUR EC2 coturn ───────────────────────────────
async function refreshIceServers() {
  const host = process.env.TURN_HOST || '54.210.247.10';
  const port = process.env.TURN_PORT || '3478';
 
  cachedIceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        `turn:${host}:${port}?transport=udp`,
        `turn:${host}:${port}?transport=tcp`
      ],
      username: process.env.TURN_USER || 'webrtc',
      credential: process.env.TURN_PASS || 'webrtc'
    }
  ];
  
  console.log('🔄 ICE servers (from .env):', cachedIceServers);
  app.locals.cachedIceServers = cachedIceServers;
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

// ✅ Enhanced notification sending function
const sendNotificationToUser = (userId, notification) => {
  // Method 1: Try real-time socket notification
  const userSocket = onlineUsers.get(userId);
  if (userSocket) {
    console.log(`📢 Sending real-time notification to user ${userId} via socket ${userSocket.socketId}`);
    io.to(userSocket.socketId).emit('notification:new', notification);
  } else {
    console.log(`📢 User ${userId} not online, notification saved to database and will be delivered on next connection`);
  }
  
  // Method 2: Could add push notification service here for truly offline users
  // Example: sendPushNotification(userId, notification);
};

// Keep the old function for backward compatibility
const sendNotification = sendNotificationToUser;

// Make sendNotification available to routes
app.locals.sendNotification = sendNotification;
app.locals.io = io;
app.locals.onlineUsers = onlineUsers;

// Socket.io logic
io.on('connection', async socket => {
  console.log('[Signaling] 🆕 client connected:', socket.id);
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
  socket.on('joinRoom', roomId => {
    console.log(`[Signaling] socket ${socket.id} requesting joinRoom ${roomId}`);
    if (socket.currentRoom) {
      socket.leave(socket.currentRoom);
      // Remove by socketId, not username
      if (rooms[socket.currentRoom]) {
        rooms[socket.currentRoom].participants = rooms[socket.currentRoom].participants.filter(
          p => typeof p === 'object' ? p.socketId !== socket.id : true
        );
      }
    }
    socket.join(roomId);
    console.log(`[Signaling] socket ${socket.id} joined room ${roomId}`);
    socket.currentRoom = roomId;

    if (!rooms[roomId]) rooms[roomId] = { offers: [], participants: [] };
    // Remove any legacy username-only entries
    rooms[roomId].participants = rooms[roomId].participants.filter(p => typeof p === 'object');
    // Only add if not already present
    if (!rooms[roomId].participants.some(p => p.socketId === socket.id)) {
      rooms[roomId].participants.push({ socketId: socket.id, userName });
    }
    connectedSockets.push({ socketId: socket.id, userName, roomId });

    io.to(roomId).emit('roomParticipants', rooms[roomId].participants);
    socket.emit('availableOffers', rooms[roomId].offers);
    
    // 🔥 NEW: Broadcast existing producers in the room to the newly joined participant
    // This ensures they receive newProducer events for existing participants
    setTimeout(() => {
      if (producers && producers.size > 0) {
        console.log(`[Signaling] 🔍 Checking ${producers.size} producers for room ${roomId}, new joiner: ${socket.id}`);
        for (const [producerId, entry] of producers) {
          if (entry.roomId === roomId && entry.peerId !== socket.id) {
            console.log(`[Signaling] 📡 Broadcasting existing producer ${producerId} (${entry.producer.kind}) from ${entry.peerId} to new joiner ${socket.id}`);
            socket.emit('newProducer', {
              producerId: producerId,
              peerId: entry.peerId
            });
          }
        }
      } else {
        console.log(`[Signaling] ℹ️ No existing producers found for room ${roomId}`);
      }
    }, 100); // Small delay to let the client finish setup
  });

  socket.on('newOffer', newOffer => {
    const rid = socket.currentRoom;
    if (!rid) return;
    const offerObj = {
      offererSocketId: socket.id,
      offer: newOffer,
      offerIceCandidates: [],
      answererSocketId: null,
      answer: null,
      answererIceCandidates: [],
      roomId: rid
    };
    rooms[rid].offers.push(offerObj);
    socket.to(rid).emit('newOfferAwaiting', [offerObj]);
  });

  socket.on('newAnswer', (offerObj, ack) => {
    const rid = socket.currentRoom;
    const roomOfferObj = rooms[rid];
    if (!roomOfferObj) return;
    const dest = connectedSockets.find(s => s.socketId === offerObj.offererSocketId && s.roomId === rid);
    const offerToUpdate = roomOfferObj.offers.find(o => o.offererSocketId === offerObj.offererSocketId);
    if (!dest || !offerToUpdate) return;
    ack(offerToUpdate.offerIceCandidates);
    offerToUpdate.answererSocketId = socket.id;
    offerToUpdate.answer = offerObj.answer;
    socket.to(dest.socketId).emit('answerResponse', offerToUpdate);
  });

  socket.on('sendIceCandidateToSignalingServer', iceObj => {
    const rid = socket.currentRoom;
    console.log(`[Signaling] Got ICE from ${socket.id} (user=${userName}) in room=${rid}:`, iceObj);
    if (!rid) return;
    const { didIOffer, iceSocketId, iceCandidate } = iceObj;
    const roomOffers = rooms[rid]?.offers;
    if (!roomOffers) return;
    if (didIOffer) {
      const offerRec = roomOffers.find(o => o.offererSocketId === iceSocketId);
      if (!offerRec) return;
      offerRec.offerIceCandidates.push(iceCandidate);
      if (offerRec.answererSocketId) {
        const ansDest = connectedSockets.find(s => s.socketId === offerRec.answererSocketId && s.roomId === rid);
        if (ansDest) {
          console.log(`[Signaling] ▶️ ice-candidate → answerer(${ansDest.socketId}):`, iceCandidate);
          socket.to(ansDest.socketId).emit('ice-candidate', iceCandidate);
        }
      }
    } else {
      const offerRec = roomOffers.find(o => o.answererSocketId === iceSocketId);
      if (!offerRec) return;
      const offDest = connectedSockets.find(s => s.socketId === offerRec.offererSocketId && s.roomId === rid);
      if (offDest) {
        console.log(`[Signaling] ▶️ ice-candidate → offerer(${offDest.socketId}):`, iceCandidate);
        socket.to(offDest.socketId).emit('ice-candidate', iceCandidate);
      }
    }
  });

  socket.on('hangup', (peerId, ack) => {
    console.log('[Signaling] hangup received from client:', peerId, 'typeof:', typeof peerId);
    const rid = socket.currentRoom;
    console.log('[Signaling] 🔔 hangup from', peerId, 'room', rid, 'socket.id:', socket.id, 'userName:', userName);
    if (!rid) {
      if (typeof ack === 'function') ack();
      return;
    }
    console.log('[Signaling] Emitting hangup to room', rid, 'with peerId:', peerId, 'participants:', rooms[rid]?.participants);
    socket.to(rid).emit('hangup', peerId);
    if (rooms[rid]) {
      rooms[rid].participants = rooms[rid].participants.filter(p => typeof p === 'object' && p.socketId !== socket.id);
      rooms[rid].offers = rooms[rid].offers.filter(o => o.offererSocketId !== socket.id);
      io.to(rid).emit('availableOffers', rooms[rid].offers);
      io.to(rid).emit('roomParticipants', rooms[rid].participants);
      if (rooms[rid].participants.length === 0) {
        io.emit('roomClosed', rid);
        delete rooms[rid];
      }
      if (typeof ack === 'function') ack();
    }
    const socketIndex = connectedSockets.findIndex(s => s.socketId === socket.id);
    if (socketIndex !== -1) {
      connectedSockets.splice(socketIndex, 1);
    }
  });
  
  // Handle disconnections
  socket.on('disconnect', () => {
    const rid = socket.currentRoom;
    
    // Remove user from online users
    onlineUsers.delete(socket.userId);
    io.emit('user:offline', { userId: socket.userId });
    console.log('[Signaling] 🔔 disconnect handler on server for', socket.id);
    
    if (rid) {
      socket.to(rid).emit('hangup', socket.id);
      
      // Clean up the same way as hangup
      if (rooms[rid]) {
        rooms[rid].participants = rooms[rid].participants.filter(p => typeof p === 'object' && p.socketId !== socket.id);
        rooms[rid].offers       = rooms[rid].offers.filter(o => o.offererSocketId !== socket.id);
        
        // Broadcast updated participants to room
        io.to(rid).emit('roomParticipants', rooms[rid].participants);
        io.to(rid).emit('availableOffers', rooms[rid].offers);
        
        // If room is empty, clean it up
        if (rooms[rid].participants.length === 0) {
          io.emit('roomClosed', rid);
          delete rooms[rid];
        }
      }
    }
    
    // Remove socket from tracking
    const socketIndex = connectedSockets.findIndex(s => s.socketId === socket.id);
    if (socketIndex !== -1) {
      connectedSockets.splice(socketIndex, 1);
    }
  });

  socket.on('sendMessage', message => {
    const rid = socket.currentRoom;
    if (!rid) return;
    // broadcast using fetched userName
    socket.to(rid).emit('receiveMessage', { userName, message });
  });

  socket.on('avatarOutput', json => {
    const rid = socket.currentRoom;
    if (rid) io.to(rid).emit('avatarOutput', json);
  });

  socket.on('avatarNavigate', ({ index }) => {
    const rid = socket.currentRoom;
    if (rid) io.to(rid).emit('avatarNavigate', { index });
  });

  // Recording notifications
  socket.on('recordingStarted', ({ recordedBy }) => {
    const rid = socket.currentRoom;
    if (rid) {
      console.log(`[Signaling] Recording started by ${recordedBy} in room ${rid}`);
      io.to(rid).emit('recordingStarted', { recordedBy });
    }
  });

  socket.on('recordingStopped', ({ recordedBy }) => {
    const rid = socket.currentRoom;
    if (rid) {
      console.log(`[Signaling] Recording stopped by ${recordedBy} in room ${rid}`);
      io.to(rid).emit('recordingStopped', { recordedBy });
    }
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
  socket.on('chat:send', async ({ conversationId, text, file, replyTo, tempId }) => {
    const userId = socket.userId;
    const session = await mongoose.startSession();
    let populatedMessage;
    
    try {
      await session.withTransaction(async () => {
        // Create and save the message
        const message = new Message({
          conversation: conversationId,
          sender: userId,
          text,
          file,
          replyTo,
        });
        
        await message.save({ session });
        
        // Update conversation's last message
        await Conversation.findByIdAndUpdate(
          conversationId,
          { lastMessage: message._id },
          { session }
        );
        
        // Populate sender and replyTo references
        populatedMessage = await Message.populate(message, [
          { path: 'sender', select: 'username fullName avatarUrl' },
          { path: 'replyTo', select: 'text file' }
        ]);
      });
      
      // Get the conversation with members
      const conversation = await Conversation.findById(conversationId).populate('members');
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      // Get all member IDs except the sender
      const recipientIds = conversation.members
        .filter(member => member._id.toString() !== userId)
        .map(member => member._id.toString());
      
      // Track online recipients for delivery status
      const onlineRecipients = recipientIds.filter(id => onlineUsers.has(id));
      
      // Update delivery status for online recipients
      if (onlineRecipients.length > 0) {
        await Message.findByIdAndUpdate(
          populatedMessage._id,
          { $addToSet: { deliveredTo: { $each: onlineRecipients } } }
        );
        
        // Emit delivery status to sender
        socket.emit('chat:delivered', {
          messageId: populatedMessage._id.toString(),
          recipients: onlineRecipients
        });
      }
      
      // Send the message to all conversation members
      const messageForClient = {
        ...populatedMessage.toObject(),
        conversationId: conversationId,
        senderId: userId,
        senderName: populatedMessage.sender.fullName || populatedMessage.sender.username,
        tempId: tempId // Include tempId for client-side deduplication
      };
      
      // Send to all online members except sender
      recipientIds.forEach(recipientId => {
        const recipient = onlineUsers.get(recipientId);
        if (recipient) {
          io.to(recipient.socketId).emit('chat:new', messageForClient);
        }
      });
      
      // Also send to the conversation room for anyone currently viewing it
      io.to(conversationId).emit('chat:new', messageForClient);
      
      // Create and send notifications
      const messagePreview = text 
        ? (text.length > 50 ? text.substring(0, 50) + '...' : text)
        : file ? `📎 ${file.originalName || 'Attachment'}` : 'New message';
      
      for (const recipientId of recipientIds) {
        try {
          // Skip notification for sender
          if (recipientId === userId) continue;
          
          // Create notification
          const notification = await createNotification(
            recipientId,
            userId,
            'message',
            `${populatedMessage.sender.fullName || populatedMessage.sender.username}`,
            messagePreview,
            {
              conversationId: conversationId,
              messageId: populatedMessage._id.toString(),
              senderAvatar: populatedMessage.sender.avatarUrl
            }
          );
          
          console.log(`📢 Created notification for user ${recipientId}:`, notification._id);
          
          // Send real-time notification if user is online
          const recipientSocket = onlineUsers.get(recipientId);
          if (recipientSocket) {
            io.to(recipientSocket.socketId).emit('notification:new', notification);
            
            // Also send browser notification
            io.to(recipientSocket.socketId).emit('notify-message', {
              title: `${populatedMessage.sender.fullName || populatedMessage.sender.username}`,
              body: messagePreview,
              conversationId: conversationId,
              messageId: populatedMessage._id.toString(),
              type: 'message'
            });
          }
        } catch (error) {
          console.error(`Error creating notification for user ${recipientId}:`, error);
        }
      }
      
      // Send success acknowledgment to sender
      socket.emit('chat:sent', {
        success: true,
        messageId: populatedMessage._id.toString(),
        tempId: tempId || `${conversationId}-${Date.now()}`
      });
      
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('chat:send:error', { message: 'Failed to send message', tempId });
    } finally {
      await session.endSession();
    }
  });


  // Mark message as read
  socket.on('chat:read', async ({ messageId }) => {
    const userId = socket.userId;
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update the message to mark it as read by this user
        const message = await Message.findOneAndUpdate(
          { _id: messageId, readBy: { $ne: userId } }, // Only update if not already read by this user
          { $addToSet: { readBy: userId } },
          { new: true, session }
        );
        
        if (message) {
          // Get the conversation to find other members
          const conversation = await Conversation.findById(message.conversation).populate('members');
          if (conversation) {
            // Emit read receipt to all conversation members
            const readData = {
              messageId: message._id.toString(),
              userId: userId,
              readAt: new Date()
            };
            
            // Send to all online members of the conversation
            conversation.members.forEach(member => {
              const memberId = member._id.toString();
              const memberSocket = onlineUsers.get(memberId);
              if (memberSocket) {
                io.to(memberSocket.socketId).emit('chat:read', readData);
              }
            });
            
            // Also send to the conversation room for anyone currently viewing it
            io.to(conversation._id.toString()).emit('chat:read', readData);
            
            // Update in-memory status if it exists
            const status = messageStatus.get(messageId);
            if (status) {
              status.read = true;
            }
          }
        }
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
      socket.emit('chat:read:error', { message: 'Failed to mark message as read' });
    } finally {
      await session.endSession();
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
    socket.to(conversationId).emit('chat:typing', { userId: socket.userId, conversationId, typing });
  });

  // Join all conversations for this user
  socket.on('joinAllConversations', async () => {
    try {
      // Find all conversations where the user is a member
      const conversations = await Conversation.find({ members: socket.userId }).select('_id');
      conversations.forEach(conv => {
        socket.join(conv._id.toString());
      });
      // Optionally, join all public communities as well
      const communities = await Conversation.find({ type: 'community' }).select('_id');
      communities.forEach(comm => {
        socket.join(comm._id.toString());
      });
      console.log(`[Socket] User ${socket.userId} joined all conversations (${conversations.length + communities.length} rooms)`);
    } catch (err) {
      console.error('Error joining all conversations:', err);
    }
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

// 🔥 NEW: Endpoint for SFU server to broadcast newProducer events
app.post('/api/broadcast/newProducer', express.json(), (req, res) => {
  const { roomId, producerId, peerId } = req.body;
  
  if (!roomId || !producerId || !peerId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Check how many sockets are in the room
  const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
  const socketCount = socketsInRoom ? socketsInRoom.size : 0;
  
  console.log(`[Signaling] 📡 Broadcasting newProducer to room ${roomId} (${socketCount} sockets): producerId=${producerId}, peerId=${peerId}`);
  
  if (socketsInRoom && socketCount > 0) {
    console.log(`[Signaling] 🔍 Sockets in room ${roomId}:`, Array.from(socketsInRoom));
    
    // Broadcast to all sockets in the room
    io.to(roomId).emit('newProducer', {
      producerId,
      peerId
    });
    
    res.json({ success: true, socketCount });
  } else {
    console.log(`[Signaling] ⚠️ No sockets found in room ${roomId}`);
    res.json({ success: true, socketCount: 0 });
  }
});

// Middleware to make io instance and onlineUsers available to controllers
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  next();
});

// Register new conversation and message routes
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/notifications', notificationRoutes);

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

// Ensure uploads/avatars directory exists
const avatarDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

// Listen on the port Render (or local) specifies
const PORT = process.env.PORT || 8181;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server listening on port ${PORT}`);
});
