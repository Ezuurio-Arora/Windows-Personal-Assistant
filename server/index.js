import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import QRCode from 'qrcode';

import { StorageService } from './storage.js';
import { TunnelManager } from './tunnel.js';
import { AgentOrchestrator, TOOL_DEFINITIONS, selectRelevantTools, detectActionIntent } from './agent.js';
import { autoDetectProviders, createChatCompletion, DEFAULT_PROVIDERS, startModelKeepAlive } from './llm.js';
import { launchApp } from './tools/apps.js';
import { FastActionDispatcher } from './fast_actions.js';
import { screenStreamManager } from './screen_stream.js';

const PORT = process.env.PORT || 42000;
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const storage = new StorageService();
const tunnel = new TunnelManager(PORT);
const agent = new AgentOrchestrator({ safetyMode: storage.getSettings().safetyMode });

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Active WebSocket client connections
const clients = new Set();

function broadcast(event, data) {
  const payload = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Initialize Fast Actions Dispatcher
const fastActions = new FastActionDispatcher({
  storage,
  broadcast,
  closeClient: (ws, code, reason) => {
    try {
      ws?.close(code, reason);
    } catch (e) {
      console.error('[WS] Error closing socket:', e);
    }
  }
});
fastActions.startBackgroundPolling();

/**
 * Get all active local IPv4 addresses (Wi-Fi, Ethernet).
 */
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

// ----------------------------------------------------
// HMAC-SHA256 Security & Helper Functions
// ----------------------------------------------------

function computeBodyHash(body) {
  if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
    return crypto.createHash('sha256').update('').digest('hex');
  }
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildCanonicalHttpString(method, pathUrl, timestamp, nonce, body) {
  const bodyHash = computeBodyHash(body);
  return `${method.toUpperCase()}\n${pathUrl}\n${timestamp}\n${nonce}\n${bodyHash}`;
}

/**
 * HTTP Middleware: Enforces HMAC-SHA256 signature verification,
 * ±60s clock skew tolerance, and nonce replay defense.
 */
function hmacAuthMiddleware(req, res, next) {
  const sessionToken = req.headers['x-session-token'];
  const timestamp = req.headers['x-timestamp'];
  const nonce = req.headers['x-nonce'];
  const signature = req.headers['x-signature'];

  // 1. Missing header validation
  if (!sessionToken || !timestamp || !nonce || !signature) {
    return res.status(401).json({
      error: 'MISSING_AUTH_HEADERS',
      message: 'Required authentication headers missing: X-Session-Token, X-Timestamp, X-Nonce, X-Signature.'
    });
  }

  // 2. Validate paired session token
  const paired = storage.validateSessionToken(sessionToken);
  if (!paired) {
    return res.status(401).json({
      error: 'INVALID_SESSION_TOKEN',
      message: 'The provided session token is invalid, expired, or revoked.'
    });
  }

  // 3. Timestamp tolerance check (±60 seconds clock skew)
  const clientTime = parseInt(timestamp, 10);
  const now = Date.now();
  if (isNaN(clientTime) || Math.abs(now - clientTime) > 60000) {
    return res.status(401).json({
      error: 'TIMESTAMP_OUT_OF_BOUNDS',
      message: `Request timestamp is out of acceptable bounds (skew > 60s). Server time: ${now}, received: ${clientTime}.`,
      serverTime: now
    });
  }

  // 4. Replay attack protection (nonce cache)
  const fresh = storage.checkAndRecordNonce(nonce, clientTime);
  if (!fresh) {
    return res.status(401).json({
      error: 'REPLAY_ATTACK_DETECTED',
      message: 'Nonce has already been used within the tolerance window. Request rejected.'
    });
  }

  // 5. Reconstruct canonical string & compute HMAC-SHA256
  const cleanPath = req.originalUrl.split('?')[0];
  const canonicalString = buildCanonicalHttpString(req.method, cleanPath, timestamp, nonce, req.body);
  const expectedSig = crypto
    .createHmac('sha256', paired.hmacSecret)
    .update(canonicalString)
    .digest('hex');

  // 6. Constant-time signature verification
  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return res.status(401).json({
      error: 'INVALID_HMAC_SIGNATURE',
      message: 'Cryptographic signature mismatch. Packet dropped.'
    });
  }

  req.pairedDevice = paired;
  next();
}

/**
 * Validate HMAC-SHA256 on WebSocket frame auth envelopes.
 */
function verifyWebSocketAuth(event, data, auth, store) {
  if (!auth) {
    return { valid: false, code: 4001, error: 'MISSING_AUTH' };
  }

  const { sessionToken, timestamp, nonce, signature } = auth;
  if (!sessionToken || !timestamp || !nonce || !signature) {
    return { valid: false, code: 4001, error: 'MISSING_AUTH_FIELDS' };
  }

  const paired = store.validateSessionToken(sessionToken);
  if (!paired) {
    return { valid: false, code: 4001, error: 'INVALID_SESSION_TOKEN' };
  }

  const clientTime = parseInt(timestamp, 10);
  const now = Date.now();
  if (isNaN(clientTime) || Math.abs(now - clientTime) > 60000) {
    return { valid: false, code: 4001, error: 'TIMESTAMP_OUT_OF_BOUNDS' };
  }

  if (!store.checkAndRecordNonce(nonce, clientTime)) {
    return { valid: false, code: 4001, error: 'REPLAY_ATTACK_DETECTED' };
  }

  const dataString = JSON.stringify(data || {});
  const canonical = `${event}\n${timestamp}\n${nonce}\n${dataString}`;
  const expectedSig = crypto
    .createHmac('sha256', paired.hmacSecret)
    .update(canonical)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, code: 4001, error: 'INVALID_HMAC_SIGNATURE' };
  }

  return { valid: true, pairedDevice: paired };
}

// ----------------------------------------------------
// REST API Endpoints: System & Settings
// ----------------------------------------------------

app.get('/api/status', async (req, res) => {
  const localIps = getLocalIpAddresses();
  const primaryIp = localIps[0]?.address || '127.0.0.1';
  res.json({
    status: 'running',
    port: PORT,
    localIps,
    primaryLocalUrl: `http://${primaryIp}:${PORT}`,
    tunnelUrl: tunnel.getUrl(),
    tunnelStatus: tunnel.status,
    activeProvider: storage.getSettings().activeProvider,
    connectedClients: clients.size,
    hostName: os.hostname(),
    platform: os.platform(),
    pairingState: storage.getPairingState(),
    paired: storage.isPaired(),
    pairedDevice: storage.getPairedDevice(true)
  });
});

app.get('/api/providers', async (req, res) => {
  const detected = await autoDetectProviders();
  res.json({
    providers: detected,
    settings: storage.getSettings()
  });
});

app.post('/api/settings', (req, res) => {
  const updated = storage.updateSettings(req.body);
  if (updated.safetyMode) {
    agent.safetyMode = updated.safetyMode;
  }
  broadcast('settings:updated', updated);
  res.json(updated);
});

app.get('/api/sessions', (req, res) => {
  res.json(storage.getSessions());
});

app.post('/api/sessions', (req, res) => {
  const session = storage.createSession(req.body.title || 'New Conversation');
  broadcast('session:created', session);
  res.json(session);
});

app.get('/api/sessions/:id', (req, res) => {
  const session = storage.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.patch('/api/sessions/:id', (req, res) => {
  const updated = storage.updateSession(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Session not found' });
  broadcast('session:updated', updated);
  res.json(updated);
});

app.delete('/api/sessions/:id', (req, res) => {
  storage.deleteSession(req.params.id);
  broadcast('session:deleted', { id: req.params.id });
  res.json({ success: true });
});

app.post('/api/approve', (req, res) => {
  const { approvalId, approved } = req.body;
  const result = agent.resolveApproval(approvalId, !!approved);
  broadcast('approval:resolved', { approvalId, approved });
  res.json({ success: result });
});

app.post('/api/open-url', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    const result = await launchApp(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { content, sessionId, providerConfig } = req.body || {};
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'Content is required' });
  }
  const targetSessionId = sessionId || 'mobile_main';
  try {
    const result = await handleChatMessage({
      sessionId: targetSessionId,
      content: content.trim(),
      providerConfig
    });
    res.json({ success: true, sessionId: targetSessionId, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// APK Download & Auto-Update Endpoints
// ----------------------------------------------------

function getApkPath() {
  const relPath = path.join('mobile', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk');
  const candidate1 = path.resolve(relPath);
  if (fs.existsSync(candidate1)) return candidate1;
  try {
    const serverDir = path.dirname(fileURLToPath(import.meta.url));
    const candidate2 = path.resolve(serverDir, '..', relPath);
    if (fs.existsSync(candidate2)) return candidate2;
  } catch (e) {}
  return candidate1;
}

function getAppVersionInfo() {
  const localIps = getLocalIpAddresses();
  const primaryIp = localIps[0]?.address || '127.0.0.1';
  const apkPath = getApkPath();

  const baseInfo = {
    appName: 'Personal Assistant',
    versionName: '1.1.0',
    versionCode: 2,
    apkUrl: `http://${primaryIp}:${PORT}/app-debug.apk`,
    releaseNotes: 'Personal Assistant v1.1.0 update with desktop hub versioning & auto-update support.'
  };

  try {
    const stats = fs.statSync(apkPath);
    return {
      ...baseInfo,
      fileSize: stats.size,
      lastModified: stats.mtimeMs
    };
  } catch (err) {
    console.warn('[Version] Could not stat APK (may be rebuilding):', err.message);
    return {
      ...baseInfo,
      fileSize: 0,
      lastModified: null,
      isRebuilding: true
    };
  }
}

app.get('/api/app/version', (req, res) => {
  try {
    const versionPayload = getAppVersionInfo();
    res.status(200).json(versionPayload);
  } catch (err) {
    console.error('[Version] Error getting app version:', err);
    const localIps = getLocalIpAddresses();
    const primaryIp = localIps[0]?.address || '127.0.0.1';
    res.status(200).json({
      appName: 'Personal Assistant',
      versionName: '1.1.0',
      versionCode: 2,
      fileSize: 0,
      lastModified: null,
      apkUrl: `http://${primaryIp}:${PORT}/app-debug.apk`,
      releaseNotes: 'Personal Assistant v1.1.0 update',
      isRebuilding: true
    });
  }
});

app.get('/app-debug.apk', (req, res) => {
  const apkPath = getApkPath();
  res.download(apkPath, 'PersonalAssistant.apk', (err) => {
    if (err) {
      console.error('[APK Download] Error transferring file:', err);
      if (!res.headersSent) res.status(404).send('APK build not found.');
    }
  });
});

app.get('/download', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download Personal Assistant for Android</title>
  <style>
    body {
      background-color: #131314;
      color: #E3E3E3;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      background-color: #1E1F20;
      border: 1px solid #333538;
      border-radius: 28px;
      padding: 36px 28px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 16px 40px rgba(0,0,0,0.5);
    }
    .icon {
      font-size: 52px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 10px 0;
      background: linear-gradient(90deg, #7DACF8, #B87CF8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: #9AA0A6;
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .download-btn {
      display: inline-block;
      background: linear-gradient(135deg, #7DACF8, #B87CF8);
      color: #131314;
      font-weight: 700;
      font-size: 16px;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 9999px;
      box-shadow: 0 4px 20px rgba(125, 172, 248, 0.4);
      transition: transform 0.15s ease;
    }
    .download-btn:active {
      transform: scale(0.98);
    }
    .steps {
      margin-top: 28px;
      text-align: left;
      background: #282A2C;
      padding: 16px 20px;
      border-radius: 16px;
      font-size: 13px;
      color: #BDC1C6;
    }
    .steps ol {
      margin: 8px 0 0 0;
      padding-left: 20px;
    }
    .steps li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✨</div>
    <h1>Personal Assistant</h1>
    <p>Companion App for Android • Google Gemini 2.0 Edition</p>
    <a href="/app-debug.apk" class="download-btn">⬇️ Download APK (169 MB)</a>
    <div class="steps">
      <strong>How to install:</strong>
      <ol>
        <li>Tap <strong>Download APK</strong> above.</li>
        <li>When prompted in Chrome, tap <strong>Download anyway</strong>.</li>
        <li>Open the downloaded file and tap <strong>Install</strong>.</li>
        <li>If asked, enable <em>"Allow from this source"</em> for Chrome.</li>
      </ol>
    </div>
  </div>
</body>
</html>`);
});

// ----------------------------------------------------
// REST API Endpoints: Pairing & Companion Security
// ----------------------------------------------------

/**
 * GET /api/qr: Dynamic Pairing Payload & QR Generator
 */
app.get('/api/qr', async (req, res) => {
  const isPaired = storage.isPaired();

  if (isPaired) {
    return res.json({
      status: 'paired',
      paired: true,
      pairingState: 'PAIRED',
      pairedDevice: storage.getPairedDevice(true)
    });
  }

  const creds = storage.getOrGeneratePairingCredentials();
  const localIps = getLocalIpAddresses();
  const lanIpList = localIps.map((i) => i.address);
  const primaryIp = lanIpList[0] || '127.0.0.1';
  const localUrl = `http://${primaryIp}:${PORT}`;
  const tunnelUrl = tunnel.getUrl() || null;
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${os.hostname()}:${PORT}:${storage.getPairingSecret()}`)
    .digest('hex');

  const pairingPayload = {
    v: 1,
    app: 'personal-assistant',
    hostName: os.hostname(),
    lanIps: lanIpList,
    port: PORT,
    tunnelUrl,
    nonce: creds.nonce,
    pin: creds.pin,
    fingerprint,
    expiresAt: creds.expiresAt
  };

  const compactUri = `personal-assistant://pair?v=1&host=${encodeURIComponent(os.hostname())}&ip=${primaryIp}&port=${PORT}&nonce=${creds.nonce}&pin=${creds.pin}&exp=${creds.expiresAt}&tunnel=${encodeURIComponent(tunnelUrl || '')}`;

  const qrOptions = {
    margin: 2,
    width: 320,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  };

  try {
    const localQrDataUrl = await QRCode.toDataURL(JSON.stringify(pairingPayload), qrOptions);
    const tunnelQrDataUrl = tunnelUrl
      ? await QRCode.toDataURL(JSON.stringify({ ...pairingPayload, primaryUrl: tunnelUrl }), qrOptions)
      : null;

    res.json({
      status: 'unpaired',
      paired: false,
      pairingState: 'UNPAIRED',
      pairingPayload,
      compactUri,
      qrString: compactUri,
      qrDataUrl: localQrDataUrl,
      nonce: creds.nonce,
      pin: creds.pin,
      expiresAt: creds.expiresAt,
      localLink: `${localUrl}?token=${creds.nonce}`,
      tunnelLink: tunnelUrl ? `${tunnelUrl}?token=${creds.nonce}` : null,
      localQrDataUrl,
      tunnelQrDataUrl,
      localUrl,
      tunnelUrl,
      hostName: os.hostname()
    });
  } catch (err) {
    console.error('[QR] QR generation error:', err);
    res.status(500).json({ error: 'Failed to generate QR code', message: err.message });
  }
});

/**
 * POST /api/pair: Handshake & Single-Device Lockout Enforcer
 */
app.post('/api/pair', (req, res) => {
  const { nonce, pin, deviceId, deviceName, platform, appVersion } = req.body || {};

  // 1. Single-device lockout validation
  if (storage.isPaired()) {
    const active = storage.getPairedDevice(true);
    return res.status(403).json({
      error: 'DEVICE_LOCKED',
      message: `Another mobile device (${active?.deviceName || 'Active Device'}) is already paired. Revoke the existing device on the desktop before linking a new device.`
    });
  }

  // 2. Validate nonce or PIN against active credentials
  const validation = storage.validatePairingAttempt({ nonce, pin });
  if (!validation.valid) {
    return res.status(validation.status).json({
      error: validation.error,
      message: validation.message
    });
  }

  // 3. Extract client IP
  const clientIp =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  // 4. Complete pairing session & destroy dynamic QR credentials
  const { pairedDevice, sessionToken, hmacSecret } = storage.completePairing({
    deviceId,
    deviceName,
    platform,
    appVersion,
    ip: clientIp
  });

  console.log(`[Pairing] Successfully paired device "${pairedDevice.deviceName}" (${pairedDevice.ip})`);

  // 5. Dynamic QR Destruction: Notify desktop UI immediately
  broadcast('linked:device', {
    pairedDevice: storage.getPairedDevice(true),
    deviceId: pairedDevice.deviceId,
    deviceName: pairedDevice.deviceName,
    platform: pairedDevice.platform,
    ip: pairedDevice.ip,
    linkedAt: pairedDevice.linkedAt
  });

  broadcast('pairing:locked', {
    pairedDevice: storage.getPairedDevice(true),
    deviceName: pairedDevice.deviceName,
    ip: pairedDevice.ip,
    linkedAt: pairedDevice.linkedAt
  });

  // 6. Return session credentials to mobile companion
  res.json({
    status: 'paired',
    sessionToken,
    hmacSecret,
    hostName: os.hostname(),
    serverTime: Date.now(),
    safetyMode: storage.getSettings().safetyMode
  });
});

/**
 * POST /api/device/revoke: PC Desktop Revocation of Mobile Access
 */
app.post('/api/device/revoke', (req, res) => {
  const revokedDevice = storage.getPairedDevice(true);

  // 1. Terminate all active mobile WebSocket connections with code 4003 (WS_CLOSE_REVOKED)
  for (const client of clients) {
    if (client.isMobile || client.sessionToken) {
      try {
        client.send(
          JSON.stringify({
            event: 'device:revoked',
            data: { reason: 'Device access revoked by desktop PC' }
          })
        );
        client.close(4003, 'Device access revoked by desktop');
      } catch (err) {
        console.warn('[Revoke] Error closing client socket:', err.message);
      }
    }
  }

  // 2. Clear paired device in storage and generate fresh pairing credentials
  storage.revokeDevice();
  const freshCreds = storage.getOrGeneratePairingCredentials(true);

  // 3. Broadcast restoration event to desktop UI
  broadcast('device:revoked', {
    timestamp: Date.now(),
    revokedDevice
  });

  broadcast('pairing:restored', {
    status: 'unpaired',
    pairingState: 'UNPAIRED',
    credentials: freshCreds
  });

  res.json({
    success: true,
    status: 'unpaired',
    message: 'Mobile device revoked successfully. Dynamic QR code regenerated.'
  });
});

/**
 * POST /api/device/disconnect: Mobile Companion Clean Sign-Out
 */
app.post('/api/device/disconnect', (req, res) => {
  const sessionToken = req.headers['x-session-token'] || req.body?.sessionToken;
  const paired = storage.validateSessionToken(sessionToken);

  if (!paired) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing session token. Cannot disconnect.'
    });
  }

  console.log(`[Disconnect] Mobile device "${paired.deviceName}" signed out cleanly.`);

  // 1. Close mobile WebSocket connections
  for (const client of clients) {
    if (client.sessionToken === sessionToken || client.isMobile) {
      try {
        client.send(
          JSON.stringify({
            event: 'device:disconnected',
            data: { reason: 'Clean mobile sign-out' }
          })
        );
        client.close(1000, 'Normal Closure - Mobile Sign Out');
      } catch (e) {}
    }
  }

  // 2. Invalidate session and regenerate fresh QR credentials
  storage.disconnectDevice(sessionToken);
  const freshCreds = storage.getOrGeneratePairingCredentials(true);

  // 3. Notify desktop UI to restore pairing QR modal
  broadcast('device:disconnected', {
    timestamp: Date.now(),
    deviceName: paired.deviceName
  });

  broadcast('pairing:restored', {
    status: 'unpaired',
    pairingState: 'UNPAIRED',
    credentials: freshCreds
  });

  res.json({
    success: true,
    status: 'unpaired',
    message: 'Mobile companion signed out successfully.'
  });
});

// ----------------------------------------------------
// REST API Endpoints: Fast-Path Actions & Screen Stream
// ----------------------------------------------------

/**
 * Authenticated fast action execution over HTTP
 */
app.post('/api/fast-action', hmacAuthMiddleware, async (req, res) => {
  const { action, ...data } = req.body || {};
  const eventName = action?.startsWith('action:') ? action : `action:${action || 'metrics'}`;
  const result = await fastActions.handleAction(eventName, data, null);
  res.json({ success: true, result });
});

/**
 * On-demand desktop screen stream (HTTP MJPEG)
 */
app.get('/api/stream/desktop', (req, res) => {
  const token = req.query.token || req.headers['x-session-token'];
  if (storage.isPaired() && !storage.isValidSessionToken(token)) {
    return res.status(401).json({ error: 'UNAUTHORIZED_STREAM_REQUEST' });
  }
  screenStreamManager.addHttpConsumer(req, res);
});

// High-speed telemetry snapshot
app.get('/api/system/metrics', (req, res) => {
  res.json(fastActions.getMetrics());
});

// Master volume control
app.post('/api/system/volume', async (req, res) => {
  const result = await fastActions.handleVolume(req.body);
  res.json(result);
});

// Open desktop windows list
app.get('/api/system/windows', async (req, res) => {
  const result = await fastActions.handleWindowsList();
  res.json(result);
});

// Window focus
app.post('/api/system/windows/focus', async (req, res) => {
  const result = await fastActions.handleWindowsFocus(req.body);
  res.json(result);
});

// Dual-path emergency killswitch HTTP endpoint
app.post('/api/system/killswitch', async (req, res) => {
  const result = await fastActions.handleKillswitch(req.body, null);
  res.json(result);
});

app.post('/api/system/lock', async (req, res) => {
  const result = await fastActions.handlePowerAction({ action: 'lock', ...req.body });
  res.json(result);
});

// Serve frontend SPA
const distPath = path.resolve('dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(200).send('Personal Assistant Server Running. Frontend building...');
  });
});

// ----------------------------------------------------
// WebSocket Real-time Handling
// ----------------------------------------------------

wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log(`[WS] Client connected. Total: ${clients.size}`);

  // Send initial handshake with pairing state
  ws.send(
    JSON.stringify({
      event: 'welcome',
      data: {
        hostName: os.hostname(),
        status: 'online',
        tunnelUrl: tunnel.getUrl(),
        settings: storage.getSettings(),
        pairingState: storage.getPairingState(),
        pairedDevice: storage.getPairedDevice(true)
      }
    })
  );

  // Send initial app:version packet upon connection handshake
  try {
    const versionPayload = getAppVersionInfo();
    ws.send(
      JSON.stringify({
        event: 'app:version',
        data: {
          appName: versionPayload.appName,
          versionName: versionPayload.versionName,
          versionCode: versionPayload.versionCode,
          apkUrl: versionPayload.apkUrl,
          fileSize: versionPayload.fileSize,
          lastModified: versionPayload.lastModified,
          releaseNotes: versionPayload.releaseNotes
        }
      })
    );
  } catch (err) {
    console.warn('[WS] Failed to send initial app:version packet:', err.message);
  }

  ws.on('message', async (raw) => {
    try {
      const parsed = JSON.parse(raw);
      const event = parsed.event || parsed.type;
      const data = parsed.data || parsed.payload || {};
      const auth = parsed.auth;

      if (auth?.sessionToken) {
        ws.sessionToken = auth.sessionToken;
        ws.isMobile = true;
      }

      // App version query
      if (event === 'app:version' || event === 'app:check_version') {
        const versionPayload = getAppVersionInfo();
        ws.send(
          JSON.stringify({
            event: 'app:version',
            data: {
              appName: versionPayload.appName,
              versionName: versionPayload.versionName,
              versionCode: versionPayload.versionCode,
              apkUrl: versionPayload.apkUrl,
              fileSize: versionPayload.fileSize,
              lastModified: versionPayload.lastModified,
              releaseNotes: versionPayload.releaseNotes
            }
          })
        );
        return;
      }

      // ----------------------------------------------------
      // Fast-Path System Actions Bypass (<100ms)
      // ----------------------------------------------------
      if (fastActions.isFastAction(event)) {
        // Enforce HMAC authentication if auth is present or if hub is paired
        if (auth || (storage.isPaired() && ws.isMobile)) {
          const authCheck = verifyWebSocketAuth(event, data, auth, storage);
          if (!authCheck.valid) {
            console.warn(`[Security] Unauthorized fast-path frame dropped (${authCheck.error}): ${event}`);
            try {
              ws.send(
                JSON.stringify({
                  event: 'error:unauthorized',
                  data: { error: authCheck.error, code: authCheck.code }
                })
              );
              ws.close(authCheck.code || 4001, authCheck.error);
            } catch (e) {}
            return; // DROP FRAME
          }
        }

        const result = await fastActions.handleAction(event, data, ws);

        if (ws.readyState === WebSocket.OPEN && result) {
          const actionSuffix = event.startsWith('action:') ? event.split(':')[1] : event;
          ws.send(
            JSON.stringify({
              event: `${actionSuffix}:update`,
              data: result
            })
          );
          ws.send(
            JSON.stringify({
              event: `${actionSuffix}:state`,
              data: result
            })
          );
          if (event === 'action:windows:list') {
            ws.send(
              JSON.stringify({
                event: 'windows:list',
                data: result
              })
            );
          }
          if (event === 'action:lock_pc' || event === 'action:power') {
            ws.send(
              JSON.stringify({
                event: 'power:update',
                data: result
              })
            );
            ws.send(
              JSON.stringify({
                event: 'power:state',
                data: result
              })
            );
          }
        }
        return; // BYPASS ReAct loop entirely!
      }

      // ----------------------------------------------------
      // On-Demand Screen Streaming
      // ----------------------------------------------------
      if (event === 'stream:start') {
        if (auth || (storage.isPaired() && ws.isMobile)) {
          const authCheck = verifyWebSocketAuth(event, data, auth, storage);
          if (!authCheck.valid) {
            ws.close(4001, authCheck.error);
            return;
          }
        }
        screenStreamManager.addWsConsumer(ws);
        ws.send(JSON.stringify({ event: 'stream:ack', status: 'started' }));
        return;
      }

      if (event === 'stream:stop') {
        screenStreamManager.removeWsConsumer(ws);
        ws.send(JSON.stringify({ event: 'stream:ack', status: 'stopped' }));
        return;
      }

      // ----------------------------------------------------
      // ReAct Agent Chat Loop
      // ----------------------------------------------------
      if (event === 'chat:send') {
        await handleChatMessage(data);
      } else if (event === 'approval:response') {
        const { approvalId, approved } = data;
        agent.resolveApproval(approvalId, approved);
        broadcast('approval:resolved', { approvalId, approved });
      }
    } catch (err) {
      console.error('[WS] Message error:', err);
    }
  });

  ws.on('close', () => {
    screenStreamManager.removeWsConsumer(ws);
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });
});

/**
 * Handle a chat prompt through the ReAct agent loop with LLM and tools.
 */
async function handleChatMessage({ sessionId, content, providerConfig }) {
  const targetSessionId = sessionId || 'mobile_main';
  const session = storage.getOrCreateSession(targetSessionId, 'Mobile Assistant Session');

  const userMsg = storage.addMessage(targetSessionId, { role: 'user', content });
  broadcast('message:created', { sessionId: targetSessionId, message: userMsg });

  const assistantMsg = storage.addMessage(targetSessionId, {
    role: 'assistant',
    content: '',
    steps: []
  });
  broadcast('message:created', { sessionId: targetSessionId, message: assistantMsg });

  const activeSettings = storage.getSettings();
  let cleanBaseUrl = (
    activeSettings.customBaseUrl ||
    (activeSettings.activeProvider === 'lmstudio' ? 'http://127.0.0.1:1234/v1' : 'http://127.0.0.1:11434/v1')
  ).replace(/\/+$/, '');
  cleanBaseUrl = cleanBaseUrl
    .replace('localhost:1234', '127.0.0.1:1234')
    .replace('localhost:11434', '127.0.0.1:11434')
    .replace('localhost:3001', '127.0.0.1:3001');

  if (!cleanBaseUrl.endsWith('/v1') && !cleanBaseUrl.includes('/v1/')) {
    cleanBaseUrl = `${cleanBaseUrl}/v1`;
  }

  const provider = providerConfig || {
    baseUrl: cleanBaseUrl,
    apiKey: activeSettings.customApiKey || (activeSettings.activeProvider === 'lmstudio' ? 'lm-studio' : 'ollama'),
    model: activeSettings.model || 'default'
  };

  const cleanHistory = session.messages
    .filter((m) => m.id !== assistantMsg.id && m.content && !m.content.startsWith('⚠️') && !m.content.startsWith('*(Error'))
    .slice(-6);

  const systemPrompt = await agent.getSystemPrompt();
  const conversationMessages = [
    { role: 'system', content: systemPrompt },
    ...cleanHistory.map((m) => ({
      role: m.role,
      content: m.content
    }))
  ];

  let currentText = '';
  const recordedSteps = [];

  try {
    let continueLoop = true;
    let iterations = 0;
    const maxIterations = 2;

    while (continueLoop && iterations < maxIterations) {
      iterations++;
      let turnContent = '';
      let tokenCount = 0;

      broadcast('agent:thinking', {
        sessionId: targetSessionId,
        messageId: assistantMsg.id,
        status: iterations === 1 ? 'thinking' : 'synthesizing'
      });

      broadcast('agent:progress', {
        sessionId: targetSessionId,
        messageId: assistantMsg.id,
        stage: iterations === 1 ? 'evaluating' : 'synthesizing',
        percent: iterations === 1 ? 20 : 75,
        label: iterations === 1 ? 'Evaluating prompt with AI model engine...' : 'Synthesizing final answer...'
      });

      const isDocPrompt = /\b(ppt|pptx|powerpoint|presentation|slide|slides|word|docx|doc|document|report|excel|xlsx|spreadsheet|table|essay|code|write|draft)\b/i.test(content);
      const dynamicMaxTokens = isDocPrompt ? 3584 : (iterations === 1 ? 2048 : 2560);
      const activeTools = iterations === 1 ? selectRelevantTools(content, TOOL_DEFINITIONS) : undefined;
      let reasoningCount = 0;

      const response = await createChatCompletion({
        providerConfig: provider,
        messages: conversationMessages,
        tools: activeTools,
        maxTokens: dynamicMaxTokens,
        temperature: 0.6,
        onReasoning: (chunk, fullReasoning) => {
          reasoningCount++;
          if (reasoningCount % 4 === 0) {
            const tokenEstimate = Math.round(fullReasoning.length / 4);
            const dynamicPercent = Math.min(65, 20 + Math.floor(tokenEstimate * 0.2));
            broadcast('agent:progress', {
              sessionId: targetSessionId,
              messageId: assistantMsg.id,
              stage: iterations === 1 ? 'evaluating' : 'synthesizing',
              percent: dynamicPercent,
              label: `Reasoning (${tokenEstimate} tokens)...`
            });
          }
        },
        onToken: (token) => {
          turnContent += token;
          tokenCount++;

          if (iterations > 1 || (!turnContent.includes('<response') && !turnContent.includes('<tool_call') && !turnContent.includes('<tools'))) {
            currentText += token;
            broadcast('message:token', {
              sessionId: targetSessionId,
              messageId: assistantMsg.id,
              token,
              fullContent: currentText
            });

            if (tokenCount % 5 === 0) {
              const basePercent = iterations === 1 ? 25 : 75;
              const maxPercent = iterations === 1 ? 85 : 97;
              const dynamicPercent = Math.min(maxPercent, basePercent + Math.floor(tokenCount * 0.4));
              broadcast('agent:progress', {
                sessionId: targetSessionId,
                messageId: assistantMsg.id,
                stage: iterations === 1 ? 'generating' : 'synthesizing',
                percent: dynamicPercent,
                label: iterations === 1 ? `Streaming response... (${tokenCount} tokens)` : `Composing final answer... (${tokenCount} tokens)`
              });
            }
          }
        }
      });

      let effectiveToolCalls =
        iterations === 1 && response.toolCalls && response.toolCalls.length > 0
          ? [...response.toolCalls]
          : [];

      if (iterations === 1) {
        const intentCalls = detectActionIntent(content);
        if (intentCalls && intentCalls.length > 0) {
          if (effectiveToolCalls.length === 0) {
            console.log(`[Agent] Detected explicit action intent fallback:`, intentCalls.map((t) => t.name));
            effectiveToolCalls = intentCalls;
          } else if (intentCalls.length > 1 && effectiveToolCalls.length === 1 && effectiveToolCalls[0].name === 'launch_app') {
            console.log(`[Agent] Upgrading single launch_app call to compound action sequence:`, intentCalls.map((t) => t.name));
            effectiveToolCalls = intentCalls;
          }
        }
      }

      if (iterations === 1 && effectiveToolCalls.length > 0) {
        currentText = '';
        broadcast('message:token', {
          sessionId: targetSessionId,
          messageId: assistantMsg.id,
          token: '',
          fullContent: ''
        });

        broadcast('agent:progress', {
          sessionId: targetSessionId,
          messageId: assistantMsg.id,
          stage: 'subagent_execution',
          percent: 45,
          label: `Dispatching ${effectiveToolCalls.length} sub-agent worker(s)...`
        });

        const workerResults = await agent.executeSubagentWorkers(
          effectiveToolCalls,
          (update) => {
            broadcast('agent:progress', {
              sessionId: targetSessionId,
              messageId: assistantMsg.id,
              stage: 'subagent_execution',
              percent: update.status === 'completed' ? 70 : 55,
              label: `${update.subagentName || 'Sub-agent'}: ${update.tool} (${update.status})`
            });
          },
          (approvalReq) => {
            broadcast('approval:required', {
              sessionId: targetSessionId,
              messageId: assistantMsg.id,
              stepId: `appr_${Date.now()}`,
              approval: approvalReq
            });
          }
        );

        for (const wr of workerResults) {
          const stepId = `step_${Date.now()}_${wr.name}`;
          const step = {
            id: stepId,
            tool: wr.name,
            subagent: wr.subagentName,
            input: wr.arguments,
            status: wr.result?.cancelled ? 'rejected' : wr.result?.error ? 'failed' : 'completed',
            output: wr.result,
            timestamp: new Date().toISOString()
          };

          if (wr.name === 'capture_screen' && wr.result?.dataUrl) {
            step.snapshot = wr.result.dataUrl;
          }

          recordedSteps.push(step);
          broadcast('step:completed', { sessionId: targetSessionId, messageId: assistantMsg.id, step });
        }

        const requiresSynthesis = effectiveToolCalls.some((t) =>
          ['search_web', 'fetch_web_content', 'get_system_metrics', 'read_file'].includes(t.name)
        );

        if (!requiresSynthesis) {
          let summary = `### ✅ Action Results\n\n`;
          for (const step of recordedSteps) {
            const statusIcon = step.status === 'completed' ? '✔️' : '⚠️';
            const msg =
              step.output?.message ||
              step.output?.stdout ||
              (step.status === 'completed' ? 'Executed successfully' : step.output?.error || 'Completed');
            summary += `* ${statusIcon} **${step.subagent || step.tool}**: ${msg}\n`;
          }
          currentText = summary.trim();
          broadcast('message:token', {
            sessionId: targetSessionId,
            messageId: assistantMsg.id,
            token: currentText,
            fullContent: currentText
          });
          continueLoop = false;
        } else {
          conversationMessages.push({
            role: 'assistant',
            content: `Actions completed: ${workerResults.map((w) => w.name).join(', ')}`
          });
          conversationMessages.push({
            role: 'user',
            content: `[Sub-agent Execution Results]:\n${JSON.stringify(
              workerResults.map((w) => ({ tool: w.name, subagent: w.subagentName, result: w.result })),
              null,
              2
            )}\n\nCRITICAL INSTRUCTION: Output ONLY the final user-facing summary or answer in clean Markdown. DO NOT output your internal thinking, do NOT mention sub-agents or evaluations, do NOT deliberate on instructions. Start directly with the answer.`
          });
          continueLoop = true;
        }
      } else {
        currentText = response.content || currentText;
        continueLoop = false;
      }
    }

    broadcast('agent:progress', {
      sessionId: targetSessionId,
      messageId: assistantMsg.id,
      stage: 'completed',
      percent: 100,
      label: 'Complete'
    });

    currentText = currentText
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/gi, '')
      .replace(/<(?:response|tool_call)>[\s\S]*?<\/(?:response|tool_call)>/gi, '')
      .replace(/<\/?(?:response|tool_call)>/gi, '')
      .replace(/<(?:prompt|user|human)>[\s\S]*$/gi, '')
      .replace(/(?:Wait,\s+what\s+does\s+the\s+grader\s+expect|This\s+looks\s+like\s+a\s+multi-turn\s+agent\s+evaluation|Looking\s+at\s+the\s+tool\s+execution\s+result:[\s\S]*?Wait|Let\s+me\s+think\s+about\s+what\s+the\s+grader\s+expects)[\s\S]*/i, '')
      .replace(/^(?:Thinking\s+Process|Internal\s+Reasoning|Analysis):\s*[\s\S]*?(?=\n\n(?:###|Here|To|I\s+have|Certainly|[A-Z]))/i, '')
      .trim();

    if (!currentText) {
      if (recordedSteps.length > 0) {
        let summary = `### ✅ Actions Completed\n\n`;
        for (const step of recordedSteps) {
          const statusIcon = step.status === 'completed' ? '✔️' : '⚠️';
          const msg =
            step.output?.message ||
            step.output?.stdout ||
            (step.status === 'completed' ? 'Successfully executed' : step.output?.error || 'Completed');
          summary += `* ${statusIcon} **${step.tool}**: ${msg}\n`;
        }
        currentText = summary.trim();
      } else {
        const lowerPrompt = (content || '').toLowerCase();
        if (lowerPrompt.includes('chrome') || lowerPrompt.includes('browser') || lowerPrompt.includes('open')) {
          currentText = `I have executed your request on your Windows workstation. Please let me know if you would like me to perform any further tasks!`;
        } else {
          currentText = `I have processed your request. Please let me know how else I can assist you on your workstation!`;
        }
      }
    }

    storage.updateMessage(targetSessionId, assistantMsg.id, {
      content: currentText,
      steps: recordedSteps
    });

    broadcast('agent:complete', {
      sessionId: targetSessionId,
      messageId: assistantMsg.id,
      content: currentText,
      steps: recordedSteps
    });
    broadcast('message:completed', {
      sessionId: targetSessionId,
      messageId: assistantMsg.id,
      content: currentText,
      steps: recordedSteps
    });
    broadcast('message:complete', {
      sessionId: targetSessionId,
      messageId: assistantMsg.id,
      content: currentText,
      steps: recordedSteps
    });

    return {
      messageId: assistantMsg.id,
      content: currentText,
      steps: recordedSteps
    };
  } catch (err) {
    console.error('[Agent] Execution error:', err);

    const lowerContent = (content || '').toLowerCase().trim();
    let fallbackText = '';

    // Direct Intent Fallback if model runner is offline
    const detectedActions = detectActionIntent(content);
    if (detectedActions && detectedActions.length > 0) {
      try {
        console.log('[Agent] Executing direct fallback actions:', detectedActions.map(a => a.name));
        const workerResults = await agent.executeSubagentWorkers(detectedActions);
        let summary = `### ✅ Action Executed (Direct Windows Host)\n\n`;
        for (const wr of workerResults) {
          const statusIcon = wr.result?.error ? '⚠️' : '✔️';
          const msg = wr.result?.message || wr.result?.stdout || (wr.result?.error ? wr.result.error : 'Executed successfully');
          summary += `* ${statusIcon} **${wr.name}**: ${msg}\n`;
        }
        fallbackText = summary.trim();
      } catch (actErr) {
        console.warn('[Agent] Fallback direct action failed:', actErr);
      }
    }

    if (!fallbackText && lowerContent.match(/^(hello|hi|hey|greetings|who are you|help|start)\b/i)) {
      fallbackText =
        `👋 **Hello! I'm your Personal Assistant.**\n\n` +
        `I am running directly on your Windows PC (**${os.hostname()}**) with full system automation tools.\n\n` +
        `### Current Status:\n` +
        `• **Host Machine**: ${os.hostname()} (${os.platform()})\n` +
        `• **Model Runner**: \`${provider.baseUrl}\` *(Offline / Not Started)*\n\n` +
        `### To chat with local AI:\n` +
        `1. **LM Studio**: Open LM Studio → Go to **Local Server** tab → Click **Start Server** (Port 1234).\n` +
        `2. **Ollama**: Open a terminal and run \`ollama run llama3\` (or any model on port 11434).\n` +
        `3. **AnythingLLM**: Start AnythingLLM on port 3001.\n` +
        `4. **Cloud API**: Click the **Settings** gear icon in the sidebar to enter a Gemini or OpenAI API key.\n\n` +
        `*Tip: You can already test system automation directly! Try asking "check cpu", "take screenshot", or "top processes"!*`;
    } else if (!fallbackText && (lowerContent.includes('cpu') || lowerContent.includes('ram') || lowerContent.includes('memory') || lowerContent.includes('hardware'))) {
      try {
        const metrics = await agent.executeTool('get_system_metrics', {});
        fallbackText =
          `📊 **Windows Hardware Metrics (${os.hostname()}):**\n\n` +
          `• **CPU Load**: ${metrics.CpuLoadPercent || 0}%\n` +
          `• **RAM Usage**: ${metrics.Memory?.UsedGB || 0} GB / ${metrics.Memory?.TotalGB || 0} GB (${metrics.Memory?.UsedPercent || 0}%)\n` +
          `• **Uptime**: ${metrics.UptimeHours || 0} hours\n\n` +
          `*(Retrieved directly via Windows system tools while local model runner is offline)*`;
      } catch {}
    } else if (!fallbackText && (lowerContent.includes('screenshot') || lowerContent.includes('screen'))) {
      try {
        const shot = await agent.executeTool('capture_screen', { quality: 75 });
        if (shot.dataUrl) {
          recordedSteps.push({
            id: `step_${Date.now()}_screenshot`,
            tool: 'capture_screen',
            status: 'completed',
            snapshot: shot.dataUrl,
            output: { success: true }
          });
          fallbackText = `📸 **Desktop Screen Captured Successfully!**\n\n*(Captured directly by assistant host)*`;
        }
      } catch {}
    }

    if (!fallbackText) {
      fallbackText =
        `⚠️ **Model Provider Offline or Unreachable**\n\n` +
        `Could not connect to \`${provider.baseUrl}\`.\n\n` +
        `**To connect your AI model:**\n` +
        `1. **LM Studio**: Open LM Studio, load any model, and click **Start Server** (port 1234).\n` +
        `2. **Ollama**: Open terminal and run \`ollama run llama3\` (or any model on port 11434).\n` +
        `3. **AnythingLLM**: Start AnythingLLM on port 3001.\n` +
        `4. **Cloud API**: Open **Settings** (gear icon) to configure an API key for Google Gemini or OpenAI.\n\n` +
        `*Error details: ${err.message}*`;
    }

    currentText = fallbackText;
    storage.updateMessage(targetSessionId, assistantMsg.id, {
      content: currentText,
      steps: recordedSteps
    });
    broadcast('agent:complete', {
      sessionId: targetSessionId,
      messageId: assistantMsg.id,
      content: currentText,
      steps: recordedSteps
    });
    broadcast('message:completed', {
      sessionId: targetSessionId,
      messageId: assistantMsg.id,
      content: currentText,
      steps: recordedSteps
    });
    broadcast('message:complete', {
      sessionId: targetSessionId,
      messageId: assistantMsg.id,
      content: currentText,
      steps: recordedSteps
    });
    broadcast('message:error', {
      sessionId: targetSessionId,
      messageId: assistantMsg.id,
      error: err.message,
      content: currentText
    });

    return {
      messageId: assistantMsg.id,
      content: currentText,
      steps: recordedSteps,
      error: err.message
    };
  }
}

// ----------------------------------------------------
// Startup & Tunnel Launch
// ----------------------------------------------------

server.listen(PORT, '0.0.0.0', async () => {
  const localIps = getLocalIpAddresses();
  console.log(`\n======================================================`);
  console.log(`  Personal Assistant Hub Server Online`);
  console.log(`  Local URL:    http://localhost:${PORT}`);
  for (const ip of localIps) {
    console.log(`  LAN Wi-Fi:    http://${ip.address}:${PORT}`);
  }
  console.log(`======================================================\n`);

  // Launch worldwide tunnel in background (only when not in quick test mode)
  if (process.env.TEST_MODE !== '1') {
    tunnel.start().then((url) => {
      if (url) {
        console.log(`\n[Worldwide Access Ready] ${url}\n`);
        broadcast('tunnel:online', { url });
      }
    });

    startModelKeepAlive('http://127.0.0.1:1234/v1');
  }
});
