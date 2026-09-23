# Original User Request

## 2026-09-23T09:31:04Z

# Teamwork Project Prompt

Build a hardened, production-grade Flutter Android companion application for Personal Assistant that pairs directly over local Wi-Fi (with an encrypted worldwide connection mode), enforces strict single-device lockout with dynamic QR code destruction on connection and restoration on sign-out, features an on-demand live desktop screen streaming tab, executes zero-lag built-in system actions (alarms, timers, PC performance), protects PC control via hardware-backed Biometric Keystore authentication and an emergency killswitch, and features a pixel-perfect Google Gemini 2.0 aesthetic.

Working directory: C:\Users\Ezan\.gemini\antigravity\scratch\personal_assistant\mobile
Integrity mode: development

## Requirements

### R1. Flutter Android Companion Application with Gemini 2.0 Aesthetic
Build a cross-platform Flutter Android application providing real-time chat, streaming responses, subagent progress indicators, and PC automation control. The mobile UI must faithfully implement the Google Gemini 2.0 dark aesthetic: deep canvas (#131314), surface containers (#1E1F20), elevated cards (#282A2C), Google Sans/Inter typography, animated Gemini gradient status bars, and floating pill-shaped input fields.

### R2. Direct LAN Discovery, Auto-Reconnection & Worldwide Access
- **Parental DNS Safe Local Mode**: Direct local Wi-Fi pairing between the Android app and the Windows desktop Hub. The desktop pairing modal generates a local QR code encoding direct LAN IP coordinates (http://192.168.x.x:42000), port, and a cryptographically secure one-time pairing nonce, with a 6-digit PIN fallback.
- **Auto-Reconnection**: The mobile app persists the host endpoint in secure storage and automatically reconnects using the cached LAN IP and local mDNS (personal-assistant.local), with zero dependence on external tunneling domains or secure DNS filters blocked by Google Parental / Family Link accounts.
- **Worldwide Remote Access**: Provide an optional secure remote tunnel endpoint that allows full control when away from home over mobile data or external networks.
- **Offline Desktop Resilience**: All core PC functions, local AI model execution, system metrics, and automation tools must operate completely offline on the host PC without requiring an active internet connection.

### R3. Strict Single-Device Lockout & Dynamic QR Code Lifecycle
- **Strict Single-Device Policy**: The desktop Hub permits only ONE active paired mobile device at any time.
- **Immediate QR Destruction**: The instant the Android app completes the pairing handshake, the desktop UI destroys the QR code, shuts down the pairing listener, and transitions to a secure "Linked Device" view displaying device model, IP, and session duration.
- **Dynamic Reappearance on Sign-Out**: When the user taps "Sign Out" or "Disconnect" on the mobile app, or clicks "Revoke Device" on the PC, the active session token is immediately revoked, all active sockets are closed, and the desktop UI automatically re-enables the pairing listener and regenerates a fresh pairing QR code.

### R4. Hardened Security, Biometric Keystore & Remote Killswitch
- **Biometric App Lock**: Store session tokens in hardware-backed Android Keystore (flutter_secure_storage with biometric authentication). Opening the mobile app or resuming from background requires fingerprint, face unlock, or device PIN.
- **HMAC-SHA256 Mutual Authentication**: Every WebSocket command packet and HTTP API request from mobile must carry a cryptographically signed HMAC token. Any request with missing, expired, or invalid signatures must be dropped immediately (HTTP 401 / WebSocket closure 4001).
- **Synchronized Safety Mode & Emergency Killswitch**: Mobile actions mirror the desktop's active safety setting (Autonomous YOLO or Interactive Tiered). The mobile top bar must feature an instant 1-tap "Emergency Lock PC & Disconnect" killswitch that immediately triggers power_action('lock') on Windows and severs the mobile session.

### R5. On-Demand Live Desktop Screen Streaming Tab
Provide a dedicated "Live Desktop" tab in the Android app:
- **On-Demand Activation**: Screen streaming is strictly on-demand (toggled ON/OFF by the user) and never runs continuously in the background to save battery and network bandwidth.
- **Stream Performance**: Stream desktop frames with low latency, supporting pinch-to-zoom, pan, and a full-screen toggle.

### R6. Zero-Lag Built-in System Actions
Implement client/server instant action dispatchers for high-frequency daily commands:
- Set timer / countdown
- Set alarm / schedule notification
- Inspect PC performance (real-time CPU, GPU, RAM, battery metrics)
- Volume and mute toggle
- Desktop window switcher
These actions must execute deterministically with sub-100ms latency directly via system hooks without waiting for LLM reasoning loops or multi-turn generation.

### R7. Native Voice Dictation & Audio Waveform
Implement native Speech-to-Text on Android with an animated Gemini audio waveform pill while listening, along with a Read Aloud speaker button on every assistant message to synthesize audio responses through the phone speakers.

## Acceptance Criteria

### Local Connectivity & DNS-Bypass
- [ ] Android companion app connects directly to the desktop server over local Wi-Fi without attempting external DNS lookups.
- [ ] Mobile app automatically reconnects when the app is resumed or when switching Wi-Fi access points using cached IP / mDNS.
- [ ] QR code scanner links the device within 2 seconds.
- [ ] Host PC operates all local tools and system commands without an active internet connection.

### Single-Device Lockout & QR Lifecycle
- [ ] On successful pairing, desktop immediately removes the QR code and disables the pairing endpoint.
- [ ] Attempting to pair a second phone while a device is active returns HTTP 403 Forbidden.
- [ ] Tapping "Sign Out" on mobile immediately revokes the session on both PC and phone, and restores the QR code on desktop.
- [ ] Clicking "Revoke Device" on desktop immediately terminates mobile authorization and returns mobile to the scan screen.

### Security, Biometrics & Emergency Killswitch
- [ ] Auth tokens stored on Android are encrypted via Android Keystore; app prompts for biometric/PIN unlock on launch.
- [ ] Any unsigned WebSocket frame sent to the PC is rejected and logged.
- [ ] Tapping the mobile "Emergency Lock PC" button successfully locks the Windows workstation (rundll32.exe user32.dll,LockWorkStation) and revokes the active connection.

### Live Screen Streaming & Zero-Lag Actions
- [ ] Dedicated "Screen" tab starts live desktop streaming only when opened or toggled, and cleanly halts when closed.
- [ ] System actions (timers, alarms, hardware metrics, volume) execute in under 100ms with verified visual feedback.

### UI & Audio Experience
- [ ] Android app matches the Google Gemini 2.0 dark aesthetic, including custom chat bubbles, suggestion cards, and progress bar.
- [ ] Speech dictation streams text in real-time with an animated waveform, and message audio playback operates reliably.

## Verification Resources
- Run server integration test suite verifying single-device lockout, token revocation, unauthenticated packet rejection, QR state transitions, and instant action latency (<100ms).
- Run Flutter static analysis (flutter analyze) and widget tests to verify biometric lock gating, QR scanner flow, screen streaming tab toggle, and Gemini UI rendering.
