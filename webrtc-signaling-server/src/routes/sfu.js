import express from 'express';
const router = express.Router();

const transports = new Map();
const producers = new Map();
const consumers = new Map();

function getTransportById(id) {
  const entry = transports.get(id);
  return entry && entry.transport;
}

// 1) Get router RTP capabilities
router.get('/rtpCapabilities', (req, res) => {
  const msRouter = req.app.locals.mediasoupRouter;
  res.json(msRouter.rtpCapabilities);
});

// 2) Create a WebRTC transport for send or receive
router.post('/transports', async (req, res) => {
  const { direction } = req.body; // 'send' or 'recv'
  const msRouter = req.app.locals.mediasoupRouter;
  const iceServers = req.app.locals.cachedIceServers;
  const transport = await msRouter.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.PUBLIC_IP }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    iceServers
  });

  // Store transport
  transports.set(transport.id, { transport, direction });

  // 🧹 CLEANUP: Remove producers if transport closes
  transport.on('close', () => {
    console.log(`🚮 Transport ${transport.id} closed, cleaning up producers`);
    producers.forEach((producer, producerId) => {
      if (producer.transport.id === transport.id) {
        producers.delete(producerId);
        console.log(`🗑️ Removed producer ${producerId}`);
      }
    });
    consumers.forEach((consumer, consumerId) => {
      if (consumer.transport.id === transport.id) {
        consumers.delete(consumerId);
        console.log(`🗑️ Removed consumer ${consumerId}`);
      }
    });
  });

  // Send transport parameters back to client
  res.json({
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
    iceServers: req.app.locals.cachedIceServers || []
  });
});

// 3) Connect a transport
router.post('/transports/:id/connect', async (req, res) => {
  console.log(`[SFU] /transports/${req.params.id}/connect received DTLS params:`, req.body.dtlsParameters);
  const transport = getTransportById(req.params.id);
  await transport.connect({ dtlsParameters: req.body.dtlsParameters });
  res.sendStatus(200);
});

// 4) Produce (send) a track
router.post('/produce', async (req, res) => {
  const roomId = req.body.roomId;
  console.log(`[SFU] ▶️  produce() → roomId=${roomId}`, { transportId: req.body.transportId, kind: req.body.kind });
  const { transportId, kind, rtpParameters, peerId } = req.body;
  const transport = getTransportById(transportId);

  try {
    const producer = await transport.produce({ kind, rtpParameters });
    producers.set(producer.id, { producer, roomId, peerId });
    const io = req.app.locals.io;
    if (req.body.roomId) {
      io.to(req.body.roomId).emit('newProducer', {
        producerId: producer.id,
        peerId
      });
    }
    res.json({ id: producer.id });
  } catch (err) {
    console.error('❌ Error creating producer:', err);
    res.status(500).json({ error: 'Failed to create producer' });
  }
});

// 5) Consume (receive) another user’s producer
router.post('/consume', async (req, res) => {
  const { transportId, producerId, rtpCapabilities } = req.body;
  const msRouter = req.app.locals.mediasoupRouter;

  const producer = producers.get(producerId);
  if (!producer) {
    return res.status(404).json({ error: 'Producer not found' });
  }

  if (!msRouter.canConsume({ producerId, rtpCapabilities })) {
    return res.status(400).json({ error: 'cannot consume' });
  }

  const transport = getTransportById(transportId);
  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: true
  });
  await consumer.resume();
  consumers.set(consumer.id, consumer);

  res.json({
    id: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters
  });
});

// Return all active producers
router.get('/producers', (req, res) => {
  const roomId = req.query.roomId;
  console.log(`[SFU] 🔍 getProducers() for roomId=`, roomId);
  const list = [];
  for (const [id, entry] of producers) {
    if (!roomId || entry.roomId === roomId) {
      list.push({
        id: entry.producer.id,
        kind: entry.producer.kind,
        peerId: entry.peerId
      });
    }
  }
  res.json(list);
});

export default router;