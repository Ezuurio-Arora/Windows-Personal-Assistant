import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { WebSocket } from 'ws';

// Ensure test mode does not physically lock developer workstation
process.env.TEST_MODE = '1';
process.env.NODE_ENV = 'test';

const PORT = 42000;
const BASE_URL = process.env.TEST_HUB_URL || `http://127.0.0.1:${PORT}`;
const WS_URL = BASE_URL.replace(/^http/, 'ws');

let spawnedServerProcess = null;

// Helper: HMAC-SHA256 signature generator for HTTP
function signHttpRequest(method, pathUrl, timestamp, nonce, bodyString, hmacSecret) {
  const bodyHash = crypto.createHash('sha256').update(bodyString || '').digest('hex');
  const stringToSign = `${method.toUpperCase()}\n${pathUrl}\n${timestamp}\n${nonce}\n${bodyHash}`;
  return crypto.createHmac('sha256', hmacSecret).update(stringToSign).digest('hex');
}

// Helper: HMAC-SHA256 signature generator for WebSocket frames
function signWsFrame(event, timestamp, nonce, data, hmacSecret) {
  const dataString = JSON.stringify(data || {});
  const stringToSign = `${event}\n${timestamp}\n${nonce}\n${dataString}`;
  return crypto.createHmac('sha256', hmacSecret).update(stringToSign).digest('hex');
}

describe('Personal Assistant Mobile Companion Server Integration Suite', () => {
  let activeNonce = null;
  let activePin = null;
  let sessionToken = null;
  let hmacSecret = null;

  before(async () => {
    // Check if server is already running
    let online = false;
    try {
      const res = await fetch(`${BASE_URL}/api/status`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        online = true;
      }
    } catch {}

    if (!online) {
      console.log('[Test Setup] Spawning background Hub server on port 42000...');
      spawnedServerProcess = spawn('node', ['server/index.js'], {
        env: { ...process.env, TEST_MODE: '1', NODE_ENV: 'test', PORT: String(PORT) },
        stdio: 'pipe'
      });

      // Poll until server is ready
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          const res = await fetch(`${BASE_URL}/api/status`, { signal: AbortSignal.timeout(500) });
          if (res.ok) {
            online = true;
            break;
          }
        } catch {}
      }

      if (!online) {
        throw new Error('Hub server failed to start within 10 seconds for integration testing.');
      }
      console.log('[Test Setup] Hub server is online and ready for testing.');
    }
  });

  after(async () => {
    // Cleanup paired device after tests complete
    try {
      await fetch(`${BASE_URL}/api/device/revoke`, { method: 'POST' });
    } catch {}

    if (spawnedServerProcess) {
      console.log('[Test Teardown] Terminating spawned test server process...');
      spawnedServerProcess.kill();
    }
  });

  // ----------------------------------------------------
  // TEST 1: QR Generation with 6-Digit PIN and Nonce
  // ----------------------------------------------------
  test('Test 1: QR generation returns 6-digit numeric PIN, nonce, and valid TTL', async () => {
    // Reset pairing state to clean baseline
    await fetch(`${BASE_URL}/api/device/revoke`, { method: 'POST' }).catch(() => {});

    const res = await fetch(`${BASE_URL}/api/qr`);
    assert.strictEqual(res.status, 200, 'GET /api/qr must return 200 OK');

    const data = await res.json();

    // Verify 6-digit PIN
    assert.ok(data.pin, 'QR response must contain a pin field');
    assert.match(String(data.pin), /^\d{6}$/, 'PIN must be exactly 6 numeric digits');
    activePin = String(data.pin);

    // Verify cryptographic nonce
    assert.ok(data.nonce, 'QR response must contain a nonce');
    assert.match(data.nonce, /^[a-f0-9]{32}$/i, 'Nonce must be a 32-character hexadecimal string');
    activeNonce = data.nonce;

    // Verify expiration timestamp
    assert.ok(data.expiresAt, 'QR response must contain expiresAt');
    assert.ok(data.expiresAt > Date.now(), 'expiresAt must be in the future');

    // Verify unpaired status
    assert.strictEqual(data.status, 'unpaired', 'Initial status must be unpaired');
    assert.ok(data.localQrDataUrl?.startsWith('data:image/'), 'Must provide base64 QR DataURL');
  });

  // ----------------------------------------------------
  // TEST 2: Pairing Handshake POST /api/pair
  // ----------------------------------------------------
  test('Test 2: Pairing handshake returns sessionToken and hmacSecret', async () => {
    const pairPayload = {
      nonce: activeNonce,
      pin: activePin,
      deviceId: 'test-device-pixel8-001',
      deviceName: 'Google Pixel 8 Pro (Test Harness)',
      platform: 'android',
      timestamp: Date.now()
    };

    const res = await fetch(`${BASE_URL}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pairPayload)
    });

    assert.strictEqual(res.status, 200, 'Handshake must return 200 OK');
    const data = await res.json();

    assert.strictEqual(data.status, 'paired', 'Status must be paired');
    assert.ok(data.sessionToken, 'Must issue sessionToken');
    assert.ok(data.hmacSecret, 'Must issue hmacSecret');
    assert.strictEqual(data.sessionToken.length, 64, 'sessionToken must be 256-bit hex (64 chars)');
    assert.strictEqual(data.hmacSecret.length, 64, 'hmacSecret must be 256-bit hex (64 chars)');
    assert.ok(data.serverTime, 'Must provide serverTime for clock synchronization');

    // Store for subsequent authenticated tests
    sessionToken = data.sessionToken;
    hmacSecret = data.hmacSecret;

    // Verify QR code is now destroyed
    const qrRes = await fetch(`${BASE_URL}/api/qr`);
    const qrData = await qrRes.json();
    assert.strictEqual(qrData.status, 'paired', 'Subsequent /api/qr must report paired status');
  });

  // ----------------------------------------------------
  // TEST 3: Single-Device Lockout (Duplicate Pairing)
  // ----------------------------------------------------
  test('Test 3: Single-device lockout rejects secondary device pairing with HTTP 403', async () => {
    const secondPhonePayload = {
      nonce: 'invalid_or_stale_nonce',
      pin: '999999',
      deviceId: 'test-device-samsung-002',
      deviceName: 'Samsung Galaxy S24 (Attacker Phone)',
      platform: 'android',
      timestamp: Date.now()
    };

    const res = await fetch(`${BASE_URL}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(secondPhonePayload)
    });

    assert.strictEqual(res.status, 403, 'Secondary device attempt must return HTTP 403 Forbidden');
    const data = await res.json();
    assert.strictEqual(data.error, 'DEVICE_LOCKED', 'Must report DEVICE_LOCKED error');
  });

  // ----------------------------------------------------
  // TEST 4: HMAC-SHA256 Mutual Authentication & Rejection
  // ----------------------------------------------------
  test('Test 4: HMAC authentication accepts valid signatures and rejects invalid/tampered requests', async () => {
    const testPath = '/api/fast-action';
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const bodyObj = { action: 'action:metrics' };
    const bodyStr = JSON.stringify(bodyObj);

    // 4A: Valid Signature
    const validSignature = signHttpRequest('POST', testPath, timestamp, nonce, bodyStr, hmacSecret);
    const validRes = await fetch(`${BASE_URL}${testPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
        'X-Timestamp': String(timestamp),
        'X-Nonce': nonce,
        'X-Signature': validSignature
      },
      body: bodyStr
    });
    assert.strictEqual(validRes.status, 200, 'Valid signature must return 200 OK');
    const validData = await validRes.json();
    assert.strictEqual(validData.success, true, 'Valid request must succeed');

    // 4B: Missing Auth Headers -> 401
    const missingRes = await fetch(`${BASE_URL}${testPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr
    });
    assert.strictEqual(missingRes.status, 401, 'Missing signature must return 401 Unauthorized');
    const missingData = await missingRes.json();
    assert.strictEqual(missingData.error, 'MISSING_AUTH_HEADERS');

    // 4C: Tampered / Invalid Signature -> 401
    const badRes = await fetch(`${BASE_URL}${testPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
        'X-Timestamp': String(timestamp),
        'X-Nonce': crypto.randomUUID(),
        'X-Signature': 'deadbeef00000000000000000000000000000000000000000000000000000000'
      },
      body: bodyStr
    });
    assert.strictEqual(badRes.status, 401, 'Tampered signature must return 401');
    const badData = await badRes.json();
    assert.strictEqual(badData.error, 'INVALID_HMAC_SIGNATURE');

    // 4D: Clock Skew Expired Timestamp (>60s) -> 401
    const staleTimestamp = Date.now() - 75000;
    const staleNonce = crypto.randomUUID();
    const staleSig = signHttpRequest('POST', testPath, staleTimestamp, staleNonce, bodyStr, hmacSecret);
    const staleRes = await fetch(`${BASE_URL}${testPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
        'X-Timestamp': String(staleTimestamp),
        'X-Nonce': staleNonce,
        'X-Signature': staleSig
      },
      body: bodyStr
    });
    assert.strictEqual(staleRes.status, 401, 'Expired timestamp must return 401');
    const staleData = await staleRes.json();
    assert.strictEqual(staleData.error, 'TIMESTAMP_OUT_OF_BOUNDS');

    // 4E: Replay Attack (Duplicate Nonce) -> 401
    const replayNonce = crypto.randomUUID();
    const replaySig = signHttpRequest('POST', testPath, timestamp, replayNonce, bodyStr, hmacSecret);
    const req1 = await fetch(`${BASE_URL}${testPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
        'X-Timestamp': String(timestamp),
        'X-Nonce': replayNonce,
        'X-Signature': replaySig
      },
      body: bodyStr
    });
    assert.strictEqual(req1.status, 200, 'First request with fresh nonce must succeed');

    const req2 = await fetch(`${BASE_URL}${testPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': sessionToken,
        'X-Timestamp': String(timestamp),
        'X-Nonce': replayNonce,
        'X-Signature': replaySig
      },
      body: bodyStr
    });
    assert.strictEqual(req2.status, 401, 'Duplicate nonce must be rejected as replay attack');
    const req2Data = await req2.json();
    assert.strictEqual(req2Data.error, 'REPLAY_ATTACK_DETECTED');

    // 4F: WebSocket Unauthorized Frame Dropped (WS Closure 4001)
    await new Promise((resolve) => {
      const ws = new WebSocket(`${WS_URL}/ws`);
      ws.on('open', () => {
        // Send unsigned / bad frame while server is paired
        ws.send(JSON.stringify({ event: 'action:timer', data: {}, auth: { sessionToken: 'bad' } }));
      });
      ws.on('close', (code) => {
        assert.strictEqual(code, 4001, 'Unauthorized frame must sever socket with code 4001');
        resolve();
      });
    });
  });

  // ----------------------------------------------------
  // TEST 5: Fast-Path System Actions (<100ms Execution)
  // ----------------------------------------------------
  test('Test 5: Fast-path system actions execute deterministically in sub-100ms', async () => {
    const ws = new WebSocket(`${WS_URL}/ws`);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    const sendTimedAction = (event, data, validator = null) => {
      return new Promise((resolve) => {
        const timestamp = Date.now();
        const nonce = crypto.randomUUID();
        const sig = signWsFrame(event, timestamp, nonce, data, hmacSecret);

        const packet = {
          event,
          data,
          auth: { sessionToken, timestamp, nonce, signature: sig }
        };

        const t0 = performance.now();

        const messageHandler = (raw) => {
          try {
            const msg = JSON.parse(raw);
            const expectedSuffix = event.startsWith('action:') ? event.split(':')[1] : event;
            if (msg.event && (msg.event.includes(expectedSuffix) || msg.event.includes(event))) {
              if (validator && !validator(msg)) {
                return; // Discard unmatching broadcast or stale frame from prior actions
              }
              const elapsed = performance.now() - t0;
              ws.off('message', messageHandler);
              resolve({ elapsed, data: msg.data, event: msg.event, timeout: false });
            }
          } catch {}
        };

        ws.on('message', messageHandler);
        ws.send(JSON.stringify(packet));

        // Timeout guard at 500ms
        setTimeout(() => {
          ws.off('message', messageHandler);
          resolve({ elapsed: performance.now() - t0, timeout: true });
        }, 500);
      });
    };

    const benchmarkLog = [];

    // Benchmark 5A: action:metrics (<10ms target, <100ms budget)
    const metricsResult = await sendTimedAction('action:metrics', {}, (m) => m.data?.cpu !== undefined);
    assert.ok(!metricsResult.timeout, 'action:metrics must respond before timeout');
    assert.ok(
      metricsResult.elapsed < 100,
      `action:metrics must execute under 100ms (took ${metricsResult.elapsed.toFixed(1)}ms)`
    );
    assert.ok(metricsResult.data?.cpu, 'action:metrics must return cpu telemetry');
    assert.ok(metricsResult.data?.memory, 'action:metrics must return memory telemetry');
    benchmarkLog.push({ action: 'action:metrics', elapsed: metricsResult.elapsed });

    // Benchmark 5B: action:volume (percentage level adjustment, <100ms budget)
    const volumeLevel = 65;
    const volumeResult = await sendTimedAction(
      'action:volume',
      { level: volumeLevel },
      (m) => m.data?.action === 'set' && m.data?.level === volumeLevel
    );
    assert.ok(!volumeResult.timeout, 'action:volume must respond before timeout');
    assert.ok(
      volumeResult.elapsed < 100,
      `action:volume (set level) must execute under 100ms (took ${volumeResult.elapsed.toFixed(1)}ms)`
    );
    assert.strictEqual(volumeResult.data?.action, 'set', 'Volume action must be "set"');
    assert.strictEqual(volumeResult.data?.level, volumeLevel, 'Volume level must match set value');
    assert.strictEqual(volumeResult.data?.muted, false, 'Volume must not be muted after numeric set');
    benchmarkLog.push({ action: 'action:volume (level: 65)', elapsed: volumeResult.elapsed });

    // Benchmark 5C: action:volume (mute toggle: Mute ON, <100ms budget)
    const muteOnResult = await sendTimedAction(
      'action:volume',
      { action: 'toggle_mute' },
      (m) => m.data?.action === 'toggle_mute' && m.data?.muted === true
    );
    assert.ok(!muteOnResult.timeout, 'action:volume (mute ON) must respond before timeout');
    assert.ok(
      muteOnResult.elapsed < 100,
      `action:volume (mute ON) must execute under 100ms (took ${muteOnResult.elapsed.toFixed(1)}ms)`
    );
    assert.strictEqual(muteOnResult.data?.action, 'toggle_mute', 'Volume action must be "toggle_mute"');
    assert.strictEqual(muteOnResult.data?.muted, true, 'Volume must be muted');
    benchmarkLog.push({ action: 'action:volume (mute ON)', elapsed: muteOnResult.elapsed });

    // Benchmark 5D: action:volume (mute toggle: Mute OFF / Unmute, <100ms budget)
    const muteOffResult = await sendTimedAction(
      'action:volume',
      { action: 'toggle_mute' },
      (m) => m.data?.action === 'toggle_mute' && m.data?.muted === false
    );
    assert.ok(!muteOffResult.timeout, 'action:volume (mute OFF) must respond before timeout');
    assert.ok(
      muteOffResult.elapsed < 100,
      `action:volume (mute OFF) must execute under 100ms (took ${muteOffResult.elapsed.toFixed(1)}ms)`
    );
    assert.strictEqual(muteOffResult.data?.action, 'toggle_mute', 'Volume action must be "toggle_mute"');
    assert.strictEqual(muteOffResult.data?.muted, false, 'Volume must be unmuted');
    benchmarkLog.push({ action: 'action:volume (mute OFF)', elapsed: muteOffResult.elapsed });

    // Benchmark 5E: action:windows:list (Desktop Window Switcher, <100ms budget)
    const windowsResult = await sendTimedAction(
      'action:windows:list',
      {},
      (m) => Array.isArray(m.data?.windows)
    );
    assert.ok(!windowsResult.timeout, 'action:windows:list must respond before timeout');
    assert.ok(
      windowsResult.elapsed < 100,
      `action:windows:list must execute under 100ms (took ${windowsResult.elapsed.toFixed(1)}ms)`
    );
    assert.ok(Array.isArray(windowsResult.data?.windows), 'action:windows:list must return windows array');
    assert.notStrictEqual(windowsResult.data?.activeWindow, undefined, 'action:windows:list must provide activeWindow');
    benchmarkLog.push({ action: 'action:windows:list', elapsed: windowsResult.elapsed });

    // Benchmark 5F: action:timer (start and cancel, <100ms budget)
    const timerResult = await sendTimedAction(
      'action:timer',
      { action: 'start', durationSeconds: 60, label: 'Integration Test' },
      (m) => m.data?.action === 'start' || m.data?.status === 'running' || m.data?.timerId
    );
    assert.ok(!timerResult.timeout, 'action:timer must respond before timeout');
    assert.ok(
      timerResult.elapsed < 100,
      `action:timer must execute under 100ms (took ${timerResult.elapsed.toFixed(1)}ms)`
    );
    assert.ok(timerResult.data?.timerId, 'action:timer (start) must return timerId');
    benchmarkLog.push({ action: 'action:timer (start)', elapsed: timerResult.elapsed });

    const timerCancelResult = await sendTimedAction(
      'action:timer',
      { action: 'cancel', timerId: timerResult.data.timerId },
      (m) => m.data?.action === 'cancel' || m.data?.status === 'cancelled'
    );
    assert.ok(!timerCancelResult.timeout, 'action:timer (cancel) must respond before timeout');
    assert.ok(
      timerCancelResult.elapsed < 100,
      `action:timer (cancel) must execute under 100ms (took ${timerCancelResult.elapsed.toFixed(1)}ms)`
    );
    benchmarkLog.push({ action: 'action:timer (cancel)', elapsed: timerCancelResult.elapsed });

    // Benchmark 5G: action:alarm (set and cancel, <100ms budget)
    const alarmResult = await sendTimedAction(
      'action:alarm',
      {
        action: 'set',
        targetTime: new Date(Date.now() + 600000).toISOString(),
        title: 'Integration Test Alarm'
      },
      (m) => m.data?.action === 'set' || m.data?.status === 'scheduled' || m.data?.alarmId
    );
    assert.ok(!alarmResult.timeout, 'action:alarm must respond before timeout');
    assert.ok(
      alarmResult.elapsed < 100,
      `action:alarm (set) must execute under 100ms (took ${alarmResult.elapsed.toFixed(1)}ms)`
    );
    assert.ok(alarmResult.data?.alarmId, 'action:alarm (set) must return alarmId');
    benchmarkLog.push({ action: 'action:alarm (set)', elapsed: alarmResult.elapsed });

    const alarmCancelResult = await sendTimedAction(
      'action:alarm',
      { action: 'cancel', alarmId: alarmResult.data.alarmId },
      (m) => m.data?.action === 'cancel' || m.data?.status === 'cancelled'
    );
    assert.ok(!alarmCancelResult.timeout, 'action:alarm (cancel) must respond before timeout');
    assert.ok(
      alarmCancelResult.elapsed < 100,
      `action:alarm (cancel) must execute under 100ms (took ${alarmCancelResult.elapsed.toFixed(1)}ms)`
    );
    benchmarkLog.push({ action: 'action:alarm (cancel)', elapsed: alarmCancelResult.elapsed });

    // Print latency benchmark log for integration audit visibility
    console.log('\n--- Fast-Path Action Latency Benchmark Summary ---');
    for (const b of benchmarkLog) {
      console.log(`  ${b.action.padEnd(30)}: ${b.elapsed.toFixed(2)} ms (budget: <100ms)`);
    }

    ws.close();
  });

  // ----------------------------------------------------
  // TEST 6: Emergency Killswitch Packet
  // ----------------------------------------------------
  test('Test 6: Emergency killswitch severs session and triggers lock', async () => {
    const ws = new WebSocket(`${WS_URL}/ws`);

    await new Promise((resolve) => ws.on('open', resolve));

    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const killswitchData = { action: 'emergency_lock_and_sever', dryRun: true };
    const sig = signWsFrame('action:killswitch', timestamp, nonce, killswitchData, hmacSecret);

    const killPacket = {
      event: 'action:killswitch',
      data: killswitchData,
      auth: { sessionToken, timestamp, nonce, signature: sig }
    };

    const closeCodePromise = new Promise((resolve) => {
      ws.on('close', (code) => resolve(code));
    });

    ws.send(JSON.stringify(killPacket));

    const code = await closeCodePromise;
    assert.ok(
      code === 4002 || code === 1000,
      `Socket must be closed on killswitch with code 4002 or 1000 (received ${code})`
    );

    // Verify session token is invalidated and QR state restored
    const qrRes = await fetch(`${BASE_URL}/api/qr`);
    const qrData = await qrRes.json();
    assert.strictEqual(qrData.status, 'unpaired', 'Killswitch must restore pairing QR state');
  });

  // ----------------------------------------------------
  // TEST 7: Device Revocation and Disconnect Lifecycles
  // ----------------------------------------------------
  test('Test 7A: Mobile disconnect (POST /api/device/disconnect) cleans up session', async () => {
    // Re-pair a fresh session for this test
    const qrRes = await fetch(`${BASE_URL}/api/qr`);
    const qrData = await qrRes.json();

    const pairRes = await fetch(`${BASE_URL}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce: qrData.nonce,
        pin: qrData.pin,
        deviceId: 'test-device-disconnect-003',
        deviceName: 'Disconnect Test Phone'
      })
    });
    const pairData = await pairRes.json();
    assert.strictEqual(pairData.status, 'paired');

    // Mobile sends disconnect
    const disRes = await fetch(`${BASE_URL}/api/device/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': pairData.sessionToken
      }
    });

    assert.strictEqual(disRes.status, 200, 'Disconnect must return 200');

    // Confirm QR state restored
    const afterQrRes = await fetch(`${BASE_URL}/api/qr`);
    const afterQr = await afterQrRes.json();
    assert.strictEqual(afterQr.status, 'unpaired', 'QR code must be restored after mobile disconnect');
  });

  test('Test 7B: Desktop revoke (POST /api/device/revoke) severs client and restores QR', async () => {
    // Re-pair once more
    const qrRes = await fetch(`${BASE_URL}/api/qr`);
    const qrData = await qrRes.json();

    const pairRes = await fetch(`${BASE_URL}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nonce: qrData.nonce,
        pin: qrData.pin,
        deviceId: 'test-device-revoke-004',
        deviceName: 'Revoke Test Phone'
      })
    });
    assert.strictEqual(pairRes.status, 200);

    // Desktop UI invokes revoke
    const revokeRes = await fetch(`${BASE_URL}/api/device/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    assert.strictEqual(revokeRes.status, 200, 'Revoke must return 200');
    const revokeData = await revokeRes.json();
    assert.strictEqual(revokeData.status, 'unpaired', 'Revoke must return status unpaired');

    // Confirm fresh PIN and nonce generated
    const freshQrRes = await fetch(`${BASE_URL}/api/qr`);
    const freshQr = await freshQrRes.json();
    assert.strictEqual(freshQr.status, 'unpaired');
    assert.match(String(freshQr.pin), /^\d{6}$/, 'Fresh 6-digit PIN must be generated');
    assert.notStrictEqual(freshQr.nonce, qrData.nonce, 'New nonce must differ from previous');
  });

  // ----------------------------------------------------
  // TEST 8: System lock, power actions, windows list, and dual volume updates
  // ----------------------------------------------------
  test('Test 8: System lock endpoint, power actions, and dual updates', async () => {
    // 1. Test POST /api/system/lock
    const lockRes = await fetch(`${BASE_URL}/api/system/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert.strictEqual(lockRes.status, 200, 'POST /api/system/lock must return 200');
    const lockData = await lockRes.json();
    assert.strictEqual(lockData.success, true, 'Lock action must succeed');
    assert.match(lockData.action, /lock.*simulated/i, 'Lock action must be simulated in test mode');

    // 2. Test WS fast actions: action:lock_pc, action:power, action:windows:list, and action:volume
    const ws = new WebSocket(`${WS_URL}/ws`);
    await new Promise((resolve) => ws.on('open', resolve));

    const receivedEvents = [];
    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        receivedEvents.push(parsed);
      } catch {}
    });

    // Test action:lock_pc
    ws.send(JSON.stringify({
      event: 'action:lock_pc',
      data: { dryRun: true }
    }));

    await new Promise((r) => setTimeout(r, 200));
    assert.ok(
      receivedEvents.some((e) => e.event === 'power:update' || e.event === 'lock_pc:update'),
      'action:lock_pc must receive power:update or lock_pc:update'
    );

    // Test action:power
    ws.send(JSON.stringify({
      event: 'action:power',
      data: { action: 'lock', dryRun: true }
    }));

    await new Promise((r) => setTimeout(r, 200));
    assert.ok(
      receivedEvents.some((e) => e.event === 'power:update'),
      'action:power must receive power:update'
    );

    // Test action:windows:list
    ws.send(JSON.stringify({
      event: 'action:windows:list',
      data: {}
    }));

    await new Promise((r) => setTimeout(r, 200));
    assert.ok(
      receivedEvents.some((e) => e.event === 'windows:list'),
      'action:windows:list must receive windows:list event'
    );

    // Test action:volume dual update
    ws.send(JSON.stringify({
      event: 'action:volume',
      data: { action: 'set', level: 50 }
    }));

    await new Promise((r) => setTimeout(r, 200));
    assert.ok(
      receivedEvents.some((e) => e.event === 'volume:state'),
      'action:volume must receive volume:state'
    );
    assert.ok(
      receivedEvents.some((e) => e.event === 'volume:update'),
      'action:volume must receive volume:update'
    );

    ws.close();
  });
});
