import express from 'express';
const router = express.Router();

const transports = new Map();

function getTransportById(id) {
  const entry = transports.get(id);
  return entry && entry.transport;
}

// 1) get router RTP capabilities
router.get('/rtpCapabilities', (req, res) => {
  const msRouter = req.app.locals.mediasoupRouter;
  res.json(msRouter.rtpCapabilities);
});

// 2) create a WebRTC transport for send or receive
router.post('/transports', async (req, res) => {
  const { direction } = req.body; // 'send' or 'recv'
  const msRouter = req.app.locals.mediasoupRouter;
  const transport = await msRouter.createWebRtcTransport({
    listenIps: [ { ip: '0.0.0.0', announcedIp: process.env.PUBLIC_IP } ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true
  });
  transports.set(transport.id, { transport, direction });
  // Store transport in session or in-memory map keyed by userId
  res.json({
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters
  });
});

// 3) connect a transport
router.post('/transports/:id/connect', async (req, res) => {
  const transport = getTransportById(req.params.id);
  await transport.connect({ dtlsParameters: req.body.dtlsParameters });
  res.sendStatus(200);
});

// 4) produce (send) a track
router.post('/produce', async (req, res) => {
  const { transportId, kind, rtpParameters } = req.body;
  const transport = getTransportById(transportId);
  const producer = await transport.produce({ kind, rtpParameters });
  // store producer for routing to others
  res.json({ id: producer.id });
});

// 5) consume (receive) another user’s producer
router.post('/consume', async (req, res) => {
  const { transportId, producerId, rtpCapabilities } = req.body;
  const msRouter = req.app.locals.mediasoupRouter;
  if (!msRouter.canConsume({ producerId, rtpCapabilities })) {
    return res.status(400).json({ error: 'cannot consume' });
  }
  const transport = getTransportById(transportId);
  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: true
  });
  res.json({
    id: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters
  });
});
export default router;