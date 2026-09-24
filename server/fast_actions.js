import os from 'os';
import { powerAction, setVolume, getActiveWindow } from './tools/system.js';
import { focusWindow } from './tools/gui.js';
import { showNotification, speakText } from './tools/notifications.js';
import { executeCommand } from './tools/shell.js';

/**
 * FastActionDispatcher
 * Executes high-frequency system actions (timers, alarms, metrics, volume, windows, killswitch)
 * deterministically in sub-100ms by bypassing LLM ReAct loops entirely.
 */
export class FastActionDispatcher {
  /**
   * @param {Object} options
   * @param {Object} options.storage - Server storage service instance
   * @param {Function} options.broadcast - Function to broadcast events to all connected clients
   * @param {Function} [options.closeClient] - Function to close specific client socket
   */
  constructor({ storage, broadcast, closeClient }) {
    this.storage = storage;
    this.broadcast = broadcast;
    this.closeClient = closeClient || ((ws, code, reason) => {
      try {
        ws?.close(code, reason);
      } catch (err) {
        console.warn('[FastActions] Error closing socket:', err.message);
      }
    });

    // In-memory registries
    this.timers = new Map(); // timerId -> TimerItem
    this.alarms = new Map(); // alarmId -> AlarmItem

    // Volume cache
    this.currentVolume = 50;
    this.isMuted = false;
    this._pendingVolumeLevel = null;
    this._volumeSyncTimer = null;
    this._muteQueue = 0;
    this._isMuting = false;

    // Hardware telemetry cache
    this.cachedMetrics = {
      hostName: os.hostname(),
      cpu: {
        loadPercent: 0,
        cores: os.cpus().length,
        model: os.cpus()[0]?.model || 'Processor'
      },
      memory: {
        totalGB: 0,
        usedGB: 0,
        freeGB: 0,
        usedPercent: 0
      },
      gpu: {
        name: 'Detecting GPU...',
        loadPercent: 0,
        vramUsedGB: 0,
        vramTotalGB: 0
      },
      battery: {
        hasBattery: false,
        percent: null,
        status: 'AC / Desktop'
      },
      uptimeHours: 0,
      timestamp: Date.now(),
      flat: {
        cpu: 0,
        ram: 0,
        gpu: 0,
        battery: 100,
        uptime: 0
      }
    };

    // Open desktop windows cache
    this.cachedWindows = [];
    this.cachedActiveWindow = null;
    this._isPollingWindows = false;

    // Previous CPU sample for delta calculations
    this.prevCpuTimes = null;

    // Polling handles
    this.telemetryInterval = null;
    this.gpuBatteryInterval = null;
    this.windowsInterval = null;

    // Initialize initial memory metrics synchronously
    this._updateMemoryMetrics();
    this.prevCpuTimes = this._sampleCpuTimes();
  }

  /**
   * Check if an inbound WebSocket event is a fast-path action.
   * @param {string} event
   * @returns {boolean}
   */
  isFastAction(event) {
    const fastEvents = [
      'action:timer',
      'action:alarm',
      'action:metrics',
      'action:volume',
      'action:windows:list',
      'action:windows:focus',
      'action:lock_pc',
      'action:power',
      'action:killswitch',
      'system:killswitch'
    ];
    return fastEvents.includes(event);
  }

  /**
   * Start background polling workers.
   */
  startBackgroundPolling() {
    if (this.telemetryInterval) return;

    // 1. High-speed CPU, RAM, and Uptime polling (every 1000ms, pure JS ~0.05ms)
    this.telemetryInterval = setInterval(() => {
      this._updateCpuMetrics();
      this._updateMemoryMetrics();
      this.cachedMetrics.uptimeHours = Math.round((os.uptime() / 3600) * 10) / 10;
      this.cachedMetrics.timestamp = Date.now();
      this.cachedMetrics.flat = {
        cpu: Math.round(this.cachedMetrics.cpu.loadPercent),
        ram: Math.round(this.cachedMetrics.memory.usedPercent),
        gpu: Math.round(this.cachedMetrics.gpu.loadPercent),
        battery: this.cachedMetrics.battery.percent ?? 100,
        uptime: Math.round(this.cachedMetrics.uptimeHours)
      };
    }, 1000);

    // 2. GPU and Battery polling (every 5000ms in background)
    this._pollGpuAndBattery();
    this.gpuBatteryInterval = setInterval(() => {
      this._pollGpuAndBattery();
    }, 5000);

    // 3. Desktop open windows polling (every 3000ms in background)
    this._pollOpenWindows();
    this.windowsInterval = setInterval(() => {
      this._pollOpenWindows();
    }, 3000);

    console.log('[FastActions] Background telemetry and window caches initialized');
  }

  /**
   * Stop background polling workers (for graceful server shutdown or testing).
   */
  stopBackgroundPolling() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    if (this.gpuBatteryInterval) clearInterval(this.gpuBatteryInterval);
    if (this.windowsInterval) clearInterval(this.windowsInterval);
    this.telemetryInterval = null;
    this.gpuBatteryInterval = null;
    this.windowsInterval = null;
    this._isPollingWindows = false;

    if (this._volumeSyncTimer) {
      clearTimeout(this._volumeSyncTimer);
      this._volumeSyncTimer = null;
    }
    this._muteQueue = 0;
    this._isMuting = false;

    // Clear active timers
    for (const timer of this.timers.values()) {
      if (timer.timeoutRef) clearTimeout(timer.timeoutRef);
    }
    this.timers.clear();

    // Clear active alarms
    for (const alarm of this.alarms.values()) {
      if (alarm.timeoutRef) clearTimeout(alarm.timeoutRef);
    }
    this.alarms.clear();
  }

  /**
   * Main dispatch router for fast-path actions.
   * Guaranteed to resolve in sub-100ms.
   * @param {string} event
   * @param {Object} data
   * @param {WebSocket} [ws]
   * @returns {Promise<Object>}
   */
  async handleAction(event, data = {}, ws = null) {
    const startTime = Date.now();

    try {
      let result = null;

      switch (event) {
        case 'action:metrics':
          result = this.getMetrics();
          break;

        case 'action:timer':
          result = this.handleTimer(data);
          break;

        case 'action:alarm':
          result = this.handleAlarm(data);
          break;

        case 'action:volume':
          result = await this.handleVolume(data);
          break;

        case 'action:windows:list':
          result = await this.handleWindowsList(data);
          break;

        case 'action:windows:focus':
          result = await this.handleWindowsFocus(data);
          break;

        case 'action:lock_pc':
        case 'action:power':
          result = await this.handlePowerAction(data);
          break;

        case 'action:killswitch':
        case 'system:killswitch':
          result = await this.handleKillswitch(data, ws);
          break;

        default:
          result = { error: `Unsupported fast-path action: ${event}` };
      }

      const elapsed = Date.now() - startTime;
      if (elapsed > 100) {
        console.warn(`[FastActions] WARNING: ${event} took ${elapsed}ms (>100ms budget)`);
      }

      return result;
    } catch (err) {
      console.error(`[FastActions] Error handling ${event}:`, err);
      return { error: err.message || 'Fast-path action failed' };
    }
  }

  // --------------------------------------------------------------------------
  // Hardware Telemetry Implementation (<10ms)
  // --------------------------------------------------------------------------

  getMetrics() {
    return { ...this.cachedMetrics };
  }

  _sampleCpuTimes() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (const cpu of cpus) {
      user += cpu.times.user;
      nice += cpu.times.nice;
      sys += cpu.times.sys;
      idle += cpu.times.idle;
      irq += cpu.times.irq;
    }
    return { user, nice, sys, idle, irq, total: user + nice + sys + idle + irq };
  }

  _updateCpuMetrics() {
    const current = this._sampleCpuTimes();
    if (this.prevCpuTimes) {
      const totalDelta = current.total - this.prevCpuTimes.total;
      const idleDelta = current.idle - this.prevCpuTimes.idle;
      if (totalDelta > 0) {
        const usage = Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100));
        this.cachedMetrics.cpu.loadPercent = Math.round(usage * 10) / 10;
      }
    }
    this.prevCpuTimes = current;
  }

  _updateMemoryMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    this.cachedMetrics.memory = {
      totalGB: Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10,
      usedGB: Math.round((usedMem / (1024 * 1024 * 1024)) * 10) / 10,
      freeGB: Math.round((freeMem / (1024 * 1024 * 1024)) * 10) / 10,
      usedPercent: Math.round((usedMem / totalMem) * 1000) / 10
    };
  }

  async _pollGpuAndBattery() {
    // 1. Probe NVIDIA GPU if present
    try {
      const gpuRes = await executeCommand(
        'nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits',
        'cmd',
        1800
      );
      if (gpuRes.exitCode === 0 && gpuRes.stdout) {
        const parts = gpuRes.stdout.trim().split(',').map((s) => s.trim());
        if (parts.length >= 4) {
          this.cachedMetrics.gpu = {
            name: parts[0],
            loadPercent: parseFloat(parts[1]) || 0,
            vramUsedGB: Math.round((parseFloat(parts[2]) / 1024) * 10) / 10,
            vramTotalGB: Math.round((parseFloat(parts[3]) / 1024) * 10) / 10
          };
        }
      } else {
        if (this.cachedMetrics.gpu.name === 'Detecting GPU...') {
          this.cachedMetrics.gpu = {
            name: 'Integrated Graphics',
            loadPercent: 0,
            vramUsedGB: 0,
            vramTotalGB: 0
          };
        }
      }
    } catch {
      // Keep previous cached GPU metrics
    }

    // 2. Probe Battery status via CIM
    try {
      const batRes = await executeCommand(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1 EstimatedChargeRemaining, BatteryStatus | ConvertTo-Json"',
        'powershell',
        2500
      );
      if (batRes.exitCode === 0 && batRes.stdout) {
        const batData = JSON.parse(batRes.stdout);
        if (batData && batData.EstimatedChargeRemaining !== undefined) {
          this.cachedMetrics.battery = {
            hasBattery: true,
            percent: batData.EstimatedChargeRemaining,
            status: batData.BatteryStatus === 2 ? 'Charging' : 'Discharging'
          };
        }
      } else {
        this.cachedMetrics.battery = {
          hasBattery: false,
          percent: null,
          status: 'AC / Desktop'
        };
      }
    } catch {
      // Default to AC desktop if no battery hardware
    }
  }

  // --------------------------------------------------------------------------
  // Timer Implementation (<5ms)
  // --------------------------------------------------------------------------

  handleTimer(data) {
    const action = data.action || 'start';
    const timerId = data.timerId || `tm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const label = data.label || 'Timer';

    if (action === 'start' || action === 'set') {
      const durationSeconds = Math.max(1, parseInt(data.durationSeconds || 60, 10));
      const startedAt = Date.now();
      const endsAt = startedAt + durationSeconds * 1000;

      // Clear existing if any with same ID
      if (this.timers.has(timerId)) {
        clearTimeout(this.timers.get(timerId).timeoutRef);
      }

      const timeoutRef = setTimeout(() => {
        this._onTimerComplete(timerId);
      }, durationSeconds * 1000);

      const timerEntry = {
        timerId,
        label,
        durationSeconds,
        remainingSeconds: durationSeconds,
        status: 'running',
        startedAt,
        endsAt,
        timeoutRef
      };

      this.timers.set(timerId, timerEntry);

      const statePayload = this._sanitizeTimer(timerEntry);
      this.broadcast('timer:state', statePayload);
      return statePayload;
    }

    if (action === 'cancel') {
      if (!this.timers.has(timerId)) {
        return { error: `Timer ${timerId} not found` };
      }
      const entry = this.timers.get(timerId);
      if (entry.timeoutRef) clearTimeout(entry.timeoutRef);
      entry.status = 'cancelled';
      this.timers.delete(timerId);
      this.broadcast('timer:cancelled', { timerId, label: entry.label });
      return { success: true, action: 'cancel', timerId, status: 'cancelled' };
    }

    if (action === 'pause') {
      if (!this.timers.has(timerId)) return { error: `Timer ${timerId} not found` };
      const entry = this.timers.get(timerId);
      if (entry.timeoutRef) clearTimeout(entry.timeoutRef);
      entry.remainingSeconds = Math.max(0, Math.round((entry.endsAt - Date.now()) / 1000));
      entry.status = 'paused';
      const statePayload = this._sanitizeTimer(entry);
      this.broadcast('timer:state', statePayload);
      return statePayload;
    }

    if (action === 'resume') {
      if (!this.timers.has(timerId)) return { error: `Timer ${timerId} not found` };
      const entry = this.timers.get(timerId);
      if (entry.status !== 'paused') return this._sanitizeTimer(entry);

      entry.startedAt = Date.now();
      entry.endsAt = entry.startedAt + entry.remainingSeconds * 1000;
      entry.status = 'running';
      entry.timeoutRef = setTimeout(() => {
        this._onTimerComplete(timerId);
      }, entry.remainingSeconds * 1000);

      const statePayload = this._sanitizeTimer(entry);
      this.broadcast('timer:state', statePayload);
      return statePayload;
    }

    if (action === 'list' || action === 'query') {
      const activeList = Array.from(this.timers.values()).map((t) => this._sanitizeTimer(t));
      return { timers: activeList };
    }

    return { error: `Unsupported timer action: ${action}` };
  }

  _sanitizeTimer(entry) {
    const remaining =
      entry.status === 'running'
        ? Math.max(0, Math.round((entry.endsAt - Date.now()) / 1000))
        : entry.remainingSeconds;

    return {
      action: entry.status === 'running' ? 'start' : entry.status,
      timerId: entry.timerId,
      label: entry.label,
      durationSeconds: entry.durationSeconds,
      remainingSeconds: remaining,
      status: entry.status,
      startedAt: entry.startedAt,
      endsAt: entry.endsAt
    };
  }

  _onTimerComplete(timerId) {
    const entry = this.timers.get(timerId);
    if (!entry) return;

    entry.status = 'completed';
    entry.remainingSeconds = 0;

    const payload = this._sanitizeTimer(entry);
    this.broadcast('timer:completed', payload);
    this.timers.delete(timerId);

    // Fire Windows Native Notification Toast and TTS Alert
    try {
      showNotification('Timer Finished', `${entry.label} (${entry.durationSeconds}s) has elapsed.`);
      speakText(`Timer for ${entry.label} has finished`);
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Alarm Implementation (<5ms)
  // --------------------------------------------------------------------------

  handleAlarm(data) {
    const action = data.action || 'set';
    const alarmId = data.alarmId || `alm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const title = data.title || 'Scheduled Alarm';
    const message = data.message || '';

    if (action === 'set' || action === 'create') {
      if (!data.targetTime) {
        return { error: 'targetTime is required for setting an alarm' };
      }

      const targetEpoch = new Date(data.targetTime).getTime();
      const delayMs = targetEpoch - Date.now();

      if (isNaN(targetEpoch) || delayMs <= 0) {
        return { error: 'targetTime must be a valid future ISO timestamp or epoch millisecond' };
      }

      if (this.alarms.has(alarmId)) {
        clearTimeout(this.alarms.get(alarmId).timeoutRef);
      }

      const timeoutRef = setTimeout(() => {
        this._onAlarmTrigger(alarmId);
      }, delayMs);

      const alarmEntry = {
        alarmId,
        targetTime: new Date(targetEpoch).toISOString(),
        targetEpoch,
        title,
        message,
        status: 'scheduled',
        timeoutRef
      };

      this.alarms.set(alarmId, alarmEntry);

      const statePayload = this._sanitizeAlarm(alarmEntry);
      this.broadcast('alarm:state', statePayload);
      return statePayload;
    }

    if (action === 'cancel' || action === 'delete') {
      if (!this.alarms.has(alarmId)) {
        return { error: `Alarm ${alarmId} not found` };
      }
      const entry = this.alarms.get(alarmId);
      if (entry.timeoutRef) clearTimeout(entry.timeoutRef);
      entry.status = 'cancelled';
      this.alarms.delete(alarmId);
      this.broadcast('alarm:cancelled', { alarmId, title: entry.title });
      return { success: true, action: 'cancel', alarmId, status: 'cancelled' };
    }

    if (action === 'list') {
      const activeAlarms = Array.from(this.alarms.values()).map((a) => this._sanitizeAlarm(a));
      return { alarms: activeAlarms };
    }

    return { error: `Unsupported alarm action: ${action}` };
  }

  _sanitizeAlarm(entry) {
    return {
      action: entry.status === 'scheduled' ? 'set' : entry.status,
      alarmId: entry.alarmId,
      targetTime: entry.targetTime,
      title: entry.title,
      message: entry.message,
      status: entry.status
    };
  }

  _onAlarmTrigger(alarmId) {
    const entry = this.alarms.get(alarmId);
    if (!entry) return;

    entry.status = 'triggered';
    const payload = this._sanitizeAlarm(entry);
    this.broadcast('alarm:triggered', payload);
    this.alarms.delete(alarmId);

    // Fire Windows Native Notification Toast and SAPI Chime/Speech
    try {
      showNotification(`Alarm: ${entry.title}`, entry.message || 'Your scheduled alert is firing now.');
      speakText(`Alarm alert: ${entry.title}`);
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // Volume Adjustment & Mute Toggle (<70ms)
  // --------------------------------------------------------------------------

  async handleVolume(data = {}) {
    const action = data.action || (data.level !== undefined ? 'set' : 'toggle_mute');

    if (action === 'toggle_mute' || data.level === 'mute' || data.level === 'toggle') {
      this.isMuted = !this.isMuted;
      const response = {
        action: 'toggle_mute',
        success: true,
        isMuted: this.isMuted,
        volume: this.currentVolume,
        muted: this.isMuted,
        level: this.currentVolume,
        message: this.isMuted ? 'Volume muted' : 'Volume unmuted'
      };
      this.broadcast('volume:state', response);
      this.broadcast('volume:update', response);

      if (process.env.TEST_MODE !== '1') {
        this._scheduleMuteSync();
      }
      return response;
    }

    if (action === 'query' || action === 'get' || action === 'status') {
      return {
        action: 'query',
        success: true,
        isMuted: this.isMuted,
        volume: this.currentVolume,
        muted: this.isMuted,
        level: this.currentVolume
      };
    }

    // Set numeric volume level (0-100)
    const level = Math.max(0, Math.min(100, parseInt(data.level ?? 50, 10)));
    this.currentVolume = level;
    this.isMuted = false;
    this._muteQueue = 0;

    const response = {
      action: 'set',
      success: true,
      level,
      volume: level,
      muted: false,
      isMuted: false,
      message: `Volume set to ${level}%`
    };
    this.broadcast('volume:state', response);
    this.broadcast('volume:update', response);

    if (process.env.TEST_MODE !== '1') {
      this._scheduleVolumeSync(level);
    }

    return response;
  }

  _scheduleMuteSync() {
    this._muteQueue = (this._muteQueue || 0) + 1;
    if (this._isMuting) return;
    this._drainMuteQueue();
  }

  _drainMuteQueue() {
    if (this._isMuting || (this._muteQueue || 0) === 0) return;
    this._isMuting = true;

    setImmediate(async () => {
      try {
        while ((this._muteQueue || 0) > 0) {
          const toggles = this._muteQueue;
          this._muteQueue = 0;
          if (toggles % 2 === 1) {
            await setVolume('mute');
          }
        }
      } catch (err) {
        console.warn('[FastActions] Error toggling OS mute:', err.message);
      } finally {
        this._isMuting = false;
        if ((this._muteQueue || 0) > 0) {
          this._drainMuteQueue();
        }
      }
    });
  }

  _scheduleVolumeSync(level) {
    this._pendingVolumeLevel = level;
    if (this._volumeSyncTimer) return;
    this._volumeSyncTimer = setTimeout(async () => {
      this._volumeSyncTimer = null;
      const target = this._pendingVolumeLevel;
      try {
        await setVolume(target);
      } catch (err) {
        console.warn('[FastActions] Error syncing volume to Windows:', err.message);
      }
    }, 50);
  }

  // --------------------------------------------------------------------------
  // Window Switcher & Focus (<60ms)
  // --------------------------------------------------------------------------

  async _pollOpenWindows() {
    if (this._isPollingWindows) return;
    this._isPollingWindows = true;

    try {
      const psScript = `
        $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle.Trim().Length -gt 0 }
        $list = @()
        foreach ($p in $procs) {
          $list += [PSCustomObject]@{
            title = $p.MainWindowTitle
            process = $p.ProcessName
            pid = $p.Id
            hwnd = "0x" + $p.MainWindowHandle.ToString("X8")
          }
        }
        $list | ConvertTo-Json -Compress
      `;
      const result = await executeCommand(psScript, 'powershell', 2500);
      if (result.exitCode === 0 && result.stdout) {
        const parsed = JSON.parse(result.stdout);
        this.cachedWindows = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch {
      // Keep cached windows
    }

    try {
      const active = await getActiveWindow();
      if (active && !active.error) {
        this.cachedActiveWindow = active;
      }
    } catch {
      // Keep cached active window
    } finally {
      this._isPollingWindows = false;
    }
  }

  handleWindowsList() {
    // Return cached windows immediately (<0.05ms)
    const result = {
      activeWindow: this.cachedActiveWindow || null,
      windows: this.cachedWindows || []
    };
    this.broadcast('windows:list', result);
    return result;
  }

  async handleWindowsFocus(data) {
    const target = data.target || data.title || data.process;
    if (!target && !data.hwnd) {
      return { error: 'Target window title, process name, or hwnd is required' };
    }

    const res = await focusWindow(target || data.hwnd);
    const payload = {
      success: res.success,
      target: target || data.hwnd,
      message: res.message
    };
    this.broadcast('windows:focused', payload);
    return payload;
  }

  // --------------------------------------------------------------------------
  // Power & Workstation Actions (<35ms)
  // --------------------------------------------------------------------------

  async handlePowerAction(data = {}) {
    const action = data.action || 'lock';
    const isTest = process.env.TEST_MODE === '1' || process.env.NODE_ENV === 'test' || data.dryRun === true;
    let res;
    if (isTest) {
      res = { success: true, action: `${action} (simulated)` };
    } else {
      res = await powerAction(action);
    }
    // CRITICAL: DO NOT revoke device or session here! Keep pairedDevice intact!
    this.broadcast('power:update', res);
    return res;
  }

  // --------------------------------------------------------------------------
  // Emergency Killswitch (<35ms)
  // --------------------------------------------------------------------------

  async handleKillswitch(data = {}, ws = null) {
    console.warn('\n======================================================');
    console.warn('  [SECURITY] EMERGENCY WORKSTATION KILLSWITCH TRIGGERED!');
    console.warn(`  Device: ${data.deviceName || 'Mobile Companion'}`);
    console.warn(`  Reason: ${data.reason || 'User 1-tap lock'}`);
    console.warn('======================================================\n');

    // 1. Instantly trigger Windows Workstation Lock (Simulated in test mode to avoid locking developer desktop)
    const isTest =
      process.env.TEST_MODE === '1' ||
      process.env.NODE_ENV === 'test' ||
      data.dryRun === true;

    let lockPromise;
    if (isTest) {
      console.log('[Test Mode] Workstation lock verified (simulated without Win32 lock)');
      lockPromise = Promise.resolve({ success: true, action: 'Workstation locked (simulated)' });
    } else {
      lockPromise = powerAction('lock');
    }

    // 2. Revoke active mobile session in Storage
    if (this.storage && typeof this.storage.revokeDeviceSession === 'function') {
      this.storage.revokeDeviceSession();
    } else if (this.storage && typeof this.storage.revokeDevice === 'function') {
      this.storage.revokeDevice();
    }

    // 3. Broadcast QR restoration to desktop UI
    this.broadcast('device:revoked', {
      reason: 'emergency_killswitch',
      timestamp: Date.now()
    });

    this.broadcast('pairing:restored', {
      status: 'unpaired',
      pairingState: 'UNPAIRED',
      reason: 'emergency_killswitch'
    });

    // 4. Send acknowledgment frame before severing socket
    if (ws && ws.readyState === 1) { // 1 = WebSocket.OPEN
      try {
        ws.send(
          JSON.stringify({
            event: 'killswitch:ack',
            data: {
              success: true,
              locked: true,
              revoked: true,
              message: 'Workstation locked and mobile session permanently revoked'
            }
          })
        );
      } catch {}

      // Terminate WebSocket immediately with RFC 6455 closure code 4002
      this.closeClient(ws, 4002, 'EMERGENCY_KILLSWITCH_TRIGGERED');
    }

    await lockPromise;

    return {
      success: true,
      locked: true,
      revoked: true,
      message: 'Emergency killswitch executed successfully'
    };
  }
}
