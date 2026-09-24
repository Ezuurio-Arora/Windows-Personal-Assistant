import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve('server/data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const DEFAULT_STORE = {
  settings: {
    activeProvider: 'lmstudio',
    model: 'default',
    customBaseUrl: '',
    customApiKey: '',
    safetyMode: 'tiered', // 'tiered' (confirm sensitive) | 'yolo' (auto-approve)
    theme: 'dark'
  },
  pairedDevice: null,
  pairingSecret: crypto.randomBytes(16).toString('hex'),
  sessions: [
    {
      id: 'default',
      title: 'General Assistant',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    }
  ]
};

export class StorageService {
  constructor() {
    this.data = this.load();

    // Ephemeral in-memory pairing state
    this.activeNonce = null;
    this.activePin = null;
    this.activeExpiresAt = 0;

    // Ephemeral replay protection cache (nonce -> expiryEpochMs)
    this.replayCache = new Map();
  }

  load() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        return { ...DEFAULT_STORE, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.warn('[Storage] Error reading store, using defaults:', err.message);
    }
    this.save(DEFAULT_STORE);
    return { ...DEFAULT_STORE };
  }

  save(data = this.data) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage] Error saving store:', err.message);
    }
  }

  // ----------------------------------------------------
  // Pairing State Machine & Device Management
  // ----------------------------------------------------

  /**
   * Get current pairing state machine status.
   * @returns {'PAIRED'|'UNPAIRED'}
   */
  getPairingState() {
    return this.data.pairedDevice ? 'PAIRED' : 'UNPAIRED';
  }

  /**
   * Check if a mobile companion device is currently active.
   * @returns {boolean}
   */
  isPaired() {
    return !!this.data.pairedDevice;
  }

  /**
   * Retrieve active paired device metadata.
   * @param {boolean} [publicOnly=true] - Exclude sessionToken and hmacSecret
   * @returns {Object|null}
   */
  getPairedDevice(publicOnly = true) {
    if (!this.data.pairedDevice) return null;
    if (publicOnly) {
      const { sessionToken, hmacSecret, ...publicInfo } = this.data.pairedDevice;
      return publicInfo;
    }
    return this.data.pairedDevice;
  }

  /**
   * Retrieve or dynamically generate 5-minute cryptographic nonce and 6-digit numeric PIN.
   * Returns null if device is already paired.
   * @param {boolean} [forceRefresh=false]
   * @returns {{ nonce: string, pin: string, expiresAt: number }|null}
   */
  getOrGeneratePairingCredentials(forceRefresh = false) {
    if (this.isPaired()) return null;

    const now = Date.now();
    if (forceRefresh || !this.activeNonce || now >= this.activeExpiresAt) {
      this.activeNonce = crypto.randomBytes(16).toString('hex');
      this.activePin = Math.floor(100000 + crypto.randomInt(900000)).toString();
      this.activeExpiresAt = now + 5 * 60 * 1000; // 5 minutes TTL
    }

    return {
      nonce: this.activeNonce,
      pin: this.activePin,
      expiresAt: this.activeExpiresAt
    };
  }

  /**
   * Validate incoming pairing handshake credentials.
   * Enforces single-device lockout, expiry checking, and nonce/PIN verification.
   * @param {{ nonce?: string, pin?: string }} credentials
   * @returns {{ valid: boolean, status?: number, error?: string, message?: string }}
   */
  validatePairingAttempt({ nonce, pin } = {}) {
    // 1. Single-device lockout
    if (this.isPaired()) {
      return {
        valid: false,
        status: 403,
        error: 'DEVICE_LOCKED',
        message: `Another mobile device (${this.data.pairedDevice.deviceName || 'Device'}) is already paired.`
      };
    }

    // 2. Expiration check
    const now = Date.now();
    if (!this.activeNonce || now >= this.activeExpiresAt) {
      this.getOrGeneratePairingCredentials(true);
      return {
        valid: false,
        status: 401,
        error: 'EXPIRED_CREDENTIALS',
        message: 'Pairing QR code or PIN has expired. Please scan the newly generated QR code.'
      };
    }

    // 3. Credential matching (either nonce or 6-digit PIN)
    const nonceMatches =
      typeof nonce === 'string' &&
      nonce.trim().toLowerCase() === this.activeNonce.toLowerCase();
    const pinMatches = typeof pin === 'string' && pin.trim() === this.activePin;

    if (!nonceMatches && !pinMatches) {
      return {
        valid: false,
        status: 401,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid pairing nonce or PIN. Please verify and try again.'
      };
    }

    return { valid: true };
  }

  /**
   * Complete pairing handshake: issue 256-bit session token and HMAC secret,
   * persist device metadata, destroy dynamic QR pairing credentials.
   * @param {Object} deviceDetails
   * @returns {{ pairedDevice: Object, sessionToken: string, hmacSecret: string }}
   */
  completePairing({ deviceId, deviceName, platform, appVersion, ip } = {}) {
    if (this.isPaired()) {
      throw new Error('DEVICE_LOCKED');
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const hmacSecret = crypto.randomBytes(32).toString('hex');

    const device = {
      deviceId: deviceId || `dev_${crypto.randomUUID()}`,
      deviceName: deviceName || 'Android Companion',
      platform: platform || 'android',
      appVersion: appVersion || '1.0.0',
      ip: ip || '127.0.0.1',
      linkedAt: new Date().toISOString(),
      pairedAt: new Date().toISOString(),
      lastSeen: Date.now(),
      sessionToken,
      hmacSecret
    };

    this.data.pairedDevice = device;
    this.save();

    // Dynamic QR Destruction: immediate wipe of active credentials
    this.activeNonce = null;
    this.activePin = null;
    this.activeExpiresAt = 0;

    return {
      pairedDevice: device,
      sessionToken,
      hmacSecret
    };
  }

  /**
   * Forcibly revoke paired mobile device access (called from PC desktop or emergency killswitch).
   * Restores pairing credentials immediately.
   * @returns {boolean}
   */
  revokeDevice() {
    this.data.pairedDevice = null;
    this.save();
    this.getOrGeneratePairingCredentials(true);
    return true;
  }

  /**
   * Alias for revokeDevice
   */
  revokeDeviceSession() {
    return this.revokeDevice();
  }

  /**
   * Disconnect mobile companion device (clean sign-out).
   * @param {string} [sessionToken]
   * @returns {boolean}
   */
  disconnectDevice(sessionToken) {
    if (!this.data.pairedDevice) return false;
    if (sessionToken && this.data.pairedDevice.sessionToken !== sessionToken) {
      return false;
    }
    return this.revokeDevice();
  }

  /**
   * Validate session token from mobile requests.
   * Updates lastSeen timestamp on success.
   * @param {string} token
   * @returns {Object|null}
   */
  validateSessionToken(token) {
    if (this.data.pairedDevice && token && this.data.pairedDevice.sessionToken === token) {
      this.data.pairedDevice.lastSeen = Date.now();
      return this.data.pairedDevice;
    }
    return null;
  }

  /**
   * Check if token is valid.
   * @param {string} token
   * @returns {boolean}
   */
  isValidSessionToken(token) {
    return !!this.validateSessionToken(token);
  }

  /**
   * Replay attack protection: records nonces with 60-second TTL.
   * @param {string} nonce
   * @param {number} clientTime
   * @returns {boolean} - true if nonce is fresh and accepted, false if duplicate/replayed
   */
  checkAndRecordNonce(nonce, clientTime) {
    if (!nonce) return false;
    const now = Date.now();

    // Purge expired nonces
    for (const [n, exp] of this.replayCache.entries()) {
      if (exp <= now) {
        this.replayCache.delete(n);
      }
    }

    if (this.replayCache.has(nonce)) {
      return false; // Replayed nonce detected!
    }

    this.replayCache.set(nonce, (clientTime || now) + 60000);
    return true;
  }

  // ----------------------------------------------------
  // Settings & Sessions Management
  // ----------------------------------------------------

  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }

  getPairingSecret() {
    return this.data.pairingSecret;
  }

  getSessions() {
    return (this.data.sessions || []).map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      isPinned: !!s.isPinned,
      messageCount: (s.messages || []).length
    }));
  }

  updateSession(id, updates) {
    const session = this.getSession(id);
    if (!session) return null;
    Object.assign(session, updates);
    session.updatedAt = new Date().toISOString();
    this.save();
    return session;
  }

  getSession(id) {
    return (this.data.sessions || []).find((s) => s.id === id) || null;
  }

  getOrCreateSession(id, title = 'Personal Assistant Session') {
    const existing = this.getSession(id);
    if (existing) return existing;
    const session = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    if (!this.data.sessions) this.data.sessions = [];
    this.data.sessions.unshift(session);
    this.save();
    return session;
  }

  createSession(title = 'New Conversation', customId = null) {
    const session = {
      id: customId || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    if (!this.data.sessions) this.data.sessions = [];
    this.data.sessions.unshift(session);
    this.save();
    return session;
  }

  deleteSession(id) {
    if (!this.data.sessions) this.data.sessions = [];
    this.data.sessions = this.data.sessions.filter((s) => s.id !== id);
    if (this.data.sessions.length === 0) {
      this.createSession('New Conversation');
    }
    this.save();
    return true;
  }

  addMessage(sessionId, message) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const msg = {
      id: message.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      role: message.role || 'user', // 'user' | 'assistant' | 'system'
      content: message.content || '',
      steps: message.steps || [],
      timestamp: new Date().toISOString()
    };

    if (!session.messages) session.messages = [];
    session.messages.push(msg);
    session.updatedAt = new Date().toISOString();
    this.save();
    return msg;
  }

  updateMessage(sessionId, messageId, updates) {
    const session = this.getSession(sessionId);
    if (!session || !session.messages) return null;

    const msg = session.messages.find((m) => m.id === messageId);
    if (!msg) return null;

    Object.assign(msg, updates);
    session.updatedAt = new Date().toISOString();
    this.save();
    return msg;
  }
}
