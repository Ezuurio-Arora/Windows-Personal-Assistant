import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Globe,
  Wifi,
  Copy,
  Check,
  ShieldCheck,
  Smartphone,
  AlertTriangle,
  Key,
  Clock,
  Trash2,
  RefreshCw
} from 'lucide-react';

export function PairingModal({ isOpen, onClose }) {
  const [qrData, setQrData] = useState(null);
  const [mode, setMode] = useState('local'); // 'local' | 'tunnel'
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [pairedDevice, setPairedDevice] = useState(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  const [pinTimeLeft, setPinTimeLeft] = useState('');

  const pollTimerRef = useRef(null);
  const durationTimerRef = useRef(null);

  // Fetch current pairing / device status from server
  const loadPairingStatus = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/qr');
      const data = await res.json();
      setQrData(data);

      if (data.status === 'paired' && data.pairedDevice) {
        setPairedDevice(data.pairedDevice);
      } else {
        setPairedDevice(null);
      }
    } catch (err) {
      console.error('[PairingModal] Failed to load pairing data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and periodic polling when modal is open
  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      return;
    }

    loadPairingStatus(true);

    // Poll every 2.5 seconds to catch status transitions reliably
    pollTimerRef.current = setInterval(() => {
      loadPairingStatus(false);
    }, 2500);

    const handleWsEvent = (e) => {
      const { event, data } = e.detail || {};
      if (event === 'pairing:locked' || event === 'linked:device') {
        setPairedDevice(data?.pairedDevice || data);
      } else if (event === 'device:revoked' || event === 'device:disconnected') {
        setPairedDevice(null);
        loadPairingStatus(false);
      }
    };

    window.addEventListener('companion:ws_event', handleWsEvent);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      window.removeEventListener('companion:ws_event', handleWsEvent);
    };
  }, [isOpen]);

  // Live session duration ticker for paired device
  useEffect(() => {
    const pairedTimestamp = pairedDevice?.pairedAt || pairedDevice?.linkedAt;
    if (!pairedDevice || !pairedTimestamp) {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setSessionDuration('00:00:00');
      return;
    }

    const startMs = new Date(pairedTimestamp).getTime();

    const updateTicker = () => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const hrs = String(Math.floor(elapsedSec / 3600)).padStart(2, '0');
      const mins = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      setSessionDuration(`${hrs}:${mins}:${secs}`);
    };

    updateTicker();
    durationTimerRef.current = setInterval(updateTicker, 1000);

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [pairedDevice]);

  // PIN countdown timer (5-minute TTL)
  useEffect(() => {
    if (!qrData?.expiresAt || pairedDevice) return;

    const updatePinTimer = () => {
      const remainingMs = qrData.expiresAt - Date.now();
      if (remainingMs <= 0) {
        setPinTimeLeft('Expired');
        loadPairingStatus(false); // Auto-regenerate on expiry
      } else {
        const totalSec = Math.floor(remainingMs / 1000);
        const m = Math.floor(totalSec / 60);
        const s = String(totalSec % 60).padStart(2, '0');
        setPinTimeLeft(`${m}:${s}`);
      }
    };

    updatePinTimer();
    const interval = setInterval(updatePinTimer, 1000);
    return () => clearInterval(interval);
  }, [qrData?.expiresAt, pairedDevice]);

  if (!isOpen) return null;

  const handleCopyLink = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPin = (pin) => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleRevokeDevice = async () => {
    setRevoking(true);
    try {
      const res = await fetch('/api/device/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setPairedDevice(null);
        await loadPairingStatus(true);
      } else {
        const err = await res.json();
        alert(`Failed to revoke device: ${err.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('[PairingModal] Error revoking device:', err);
      alert('Network error while revoking device.');
    } finally {
      setRevoking(false);
    }
  };

  const currentQr = mode === 'local' ? qrData?.localQrDataUrl : qrData?.tunnelQrDataUrl;
  const currentLink = mode === 'local' ? qrData?.localLink : qrData?.tunnelLink;
  const currentPin = qrData?.pin ? String(qrData.pin) : '------';
  const formattedPin =
    currentPin.length === 6 ? `${currentPin.slice(0, 3)} ${currentPin.slice(3)}` : currentPin;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-gemini-surface border border-gemini-border shadow-2xl p-6 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gemini-elevated">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-2xl bg-gemini-sparkle1/10 text-gemini-sparkle1">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-gemini-text">
                {pairedDevice ? 'Linked Companion Device' : 'Connect Android Companion'}
              </h3>
              <p className="text-xs text-gemini-muted">
                {pairedDevice ? 'Active authenticated control session' : 'Pair your phone for mobile PC control'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VIEW A: PAIRED / LINKED DEVICE VIEW (DYNAMIC QR DESTRUCTION) */}
        {pairedDevice ? (
          <div className="py-5 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Status Indicator Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div>
                  <div className="text-xs font-semibold text-emerald-400">Device Connected & Active</div>
                  <div className="text-[11px] text-gemini-muted">Single-device security lockout enforced</div>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-medium">
                PAIRED
              </div>
            </div>

            {/* Device Details Card */}
            <div className="p-4 rounded-2xl bg-gemini-bg border border-gemini-elevated space-y-3.5">
              <div className="flex items-center justify-between text-xs pb-3 border-b border-gemini-elevated">
                <span className="text-gemini-muted flex items-center space-x-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-gemini-sparkle1" />
                  <span>Device Name</span>
                </span>
                <span className="font-semibold text-gemini-text">
                  {pairedDevice.deviceName || 'Android Companion'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pb-3 border-b border-gemini-elevated">
                <span className="text-gemini-muted flex items-center space-x-1.5">
                  <Wifi className="w-3.5 h-3.5 text-gemini-sparkle1" />
                  <span>Client IP Address</span>
                </span>
                <span className="font-mono text-gemini-text">{pairedDevice.ip || '192.168.x.x'}</span>
              </div>

              <div className="flex items-center justify-between text-xs pb-3 border-b border-gemini-elevated">
                <span className="text-gemini-muted flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-gemini-sparkle1" />
                  <span>Connected At</span>
                </span>
                <span className="text-gemini-text">
                  {pairedDevice.pairedAt || pairedDevice.linkedAt
                    ? new Date(pairedDevice.pairedAt || pairedDevice.linkedAt).toLocaleTimeString()
                    : 'Just now'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gemini-muted flex items-center space-x-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-gemini-sparkle1 animate-spin-slow" />
                  <span>Session Duration</span>
                </span>
                <span className="font-mono font-semibold text-gemini-sparkle1 text-sm">{sessionDuration}</span>
              </div>
            </div>

            {/* Security Guarantee Note */}
            <div className="p-3 rounded-xl bg-gemini-elevated/40 border border-gemini-border/40 flex items-center space-x-2 text-[11px] text-gemini-muted">
              <ShieldCheck className="w-4 h-4 text-gemini-sparkle1 shrink-0" />
              <span>All commands and screen frames are cryptographically signed with HMAC-SHA256.</span>
            </div>

            {/* Revoke Device Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRevokeDevice}
                disabled={revoking}
                className="w-full py-3 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-medium text-xs flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {revoking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Revoking Mobile Access...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Revoke Device & Reset Pairing QR</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-gemini-muted text-center mt-2">
                Revoking disconnects the active phone and regenerates a fresh pairing QR code immediately.
              </p>
            </div>
          </div>
        ) : (
          /* VIEW B: UNPAIRED VIEW (QR CODE + 6-DIGIT PIN FALLBACK) */
          <>
            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-2xl bg-gemini-bg border border-gemini-elevated">
              <button
                type="button"
                onClick={() => setMode('local')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  mode === 'local'
                    ? 'bg-gemini-elevated text-gemini-text shadow-sm border border-gemini-border/60'
                    : 'text-gemini-muted hover:text-gemini-text'
                }`}
              >
                <Wifi className="w-3.5 h-3.5 text-gemini-sparkle1" />
                <span>Local Wi-Fi (Home)</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('tunnel')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  mode === 'tunnel'
                    ? 'bg-gemini-elevated text-gemini-text shadow-sm border border-gemini-border/60'
                    : 'text-gemini-muted hover:text-gemini-text'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Worldwide (4G/5G)</span>
              </button>
            </div>

            {/* Body */}
            <div className="py-4 text-center flex flex-col items-center">
              {/* QR Code Container */}
              <div className="p-3 bg-gemini-bg rounded-2xl border border-gemini-elevated shadow-inner inline-block mb-3">
                {loading ? (
                  <div className="w-52 h-52 flex flex-col items-center justify-center text-gemini-muted text-xs space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-gemini-sparkle1" />
                    <span>Generating Secure QR Code...</span>
                  </div>
                ) : currentQr ? (
                  <div className="bg-white p-3 rounded-2xl shadow-xl inline-block">
                    <img src={currentQr} alt="Pairing QR" className="w-52 h-52 rounded-xl" />
                  </div>
                ) : (
                  <div className="w-52 h-52 flex flex-col items-center justify-center text-rose-400 text-xs p-4">
                    <span>Tunnel not available yet.</span>
                    <span className="text-gemini-muted text-[11px] mt-1">Try the Local Wi-Fi tab.</span>
                  </div>
                )}
              </div>

              {/* 6-DIGIT NUMERIC PIN FALLBACK */}
              <div className="w-full mb-3.5">
                <div className="p-3 rounded-2xl bg-gemini-bg border border-gemini-elevated flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-gemini-sparkle1/10 text-gemini-sparkle1">
                      <Key className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] uppercase tracking-wider text-gemini-muted flex items-center space-x-1.5">
                        <span>Pairing PIN (Manual Fallback)</span>
                        {pinTimeLeft && (
                          <span className="text-[10px] text-amber-400 font-mono">({pinTimeLeft})</span>
                        )}
                      </div>
                      <div className="text-xl font-mono font-bold tracking-[0.25em] text-gemini-sparkle1">
                        {loading ? '--- ---' : formattedPin}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyPin(currentPin)}
                    disabled={loading || !qrData?.pin}
                    className="p-2.5 rounded-xl bg-gemini-elevated hover:bg-gemini-hover text-gemini-muted hover:text-gemini-text transition-colors"
                    title="Copy PIN"
                  >
                    {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-gemini-muted mt-1.5 text-center">
                  Enter this 6-digit PIN on your phone if your camera is unavailable.
                </p>
              </div>

              <p className="text-xs text-gemini-text/90 max-w-xs leading-relaxed mb-3">
                {mode === 'local' ? (
                  <span>
                    <strong className="text-gemini-sparkle1">Recommended at home:</strong> Direct LAN connection
                    bypassing external DNS filters and parental controls.
                  </span>
                ) : (
                  <span>
                    <strong className="text-emerald-400">Worldwide Remote Access:</strong> Connect away from home over
                    cellular data or external Wi-Fi networks.
                  </span>
                )}
              </p>

              {/* Connection Link Box */}
              <div className="w-full space-y-2 text-left">
                <div className="p-3 rounded-xl bg-gemini-bg border border-gemini-elevated flex items-center justify-between text-xs">
                  <div className="truncate mr-2">
                    <span className="text-[10px] uppercase tracking-wider block text-gemini-muted">
                      {mode === 'local' ? 'Local Direct Endpoint' : 'Remote Tunnel Endpoint'}
                    </span>
                    <span className="font-mono text-gemini-text truncate block">{currentLink || 'Generating...'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(currentLink)}
                    disabled={!currentLink}
                    className="p-2 rounded-lg bg-gemini-elevated hover:bg-gemini-hover text-gemini-muted hover:text-gemini-text transition-colors shrink-0"
                    title="Copy Link"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* DNS Help Banner for Worldwide Mode */}
                {mode === 'tunnel' && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left text-xs space-y-2">
                    <div className="flex items-start space-x-2 text-amber-300 font-medium">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Cellular provider blocking trycloudflare.com?</span>
                    </div>
                    <p className="text-[11px] text-gemini-muted leading-relaxed">
                      Enable Secure DNS (Google or Cloudflare) in Chrome on Android to resolve tunnel domains.
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-1.5 text-[11px] text-gemini-muted justify-center pt-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-gemini-sparkle1" />
                  <span>Single-device lockout & HMAC-SHA256 authenticated</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
