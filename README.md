# Personal Assistant 🌟

An agentic AI desktop application for Windows inspired by the Google Gemini visual language (dark `#131314` charcoal theme, glowing sparkle animations, collapsible thought & tool execution chips, floating pill input bar). 

The Windows app functions as a **Local Autonomous Hub** capable of automating your PC, executing PowerShell scripts, inspecting hardware stats, and capturing live desktop screenshots—while giving you **worldwide remote access from your Android phone** through zero-config Cloudflare tunneling and instant QR code pairing.

---

## 🚀 Key Features

* **Google Gemini Design System**:
  * Dark charcoal palette (`#131314` background, `#1E1F20` surfaces, `#7DACF8` Google Blue accents).
  * Collapsible agent step chips showing live reasoning, tool executions, and duration.
  * Floating rounded input pill with voice dictation, provider badges, and animated send button.
  * Inline desktop screenshot previews and Markdown code highlighting with copy buttons.

* **Universal Model Provider Integration**:
  * **LM Studio**: Preset for `http://localhost:1234/v1`.
  * **Ollama**: Preset for `http://localhost:11434/v1`.
  * **AnythingLLM**: Preset for `http://localhost:3001/api/v1/openai`.
  * **Custom OpenAI Endpoints**: Any local or remote URL with optional API key.
  * **Google Gemini & OpenAI APIs**: Native cloud fallback.
  * **One-Click Auto-Detect**: Automatically scans local ports (1234, 11434, 3001) to discover active runners and list loaded models.

* **Full Windows PC Automation Agent Tools**:
  * **Command Runner**: Execute PowerShell and CMD commands with real-time stdout/stderr capture.
  * **File System**: Recursively search files, read documents with line limits, and create/edit files.
  * **Hardware & Status**: Live CPU load, RAM usage, storage drives, battery status, and uptime.
  * **Desktop Vision**: Capture full-screen Windows desktop screenshots and stream them as inline preview cards to desktop and phone.
  * **GUI Automation**: Mouse clicks, cursor movement, and keyboard typing (`SendKeys`).
  * **Web Intelligence**: Search the web via DuckDuckGo and scrape text from web URLs without API keys.

* **Worldwide Mobile Remote Access (Android)**:
  * **Zero-Config Cloudflare Quick Tunnel**: Automatically spins up an encrypted `https://*.trycloudflare.com` tunnel. Connect from anywhere on Earth (cellular 4G/5G, hotel Wi-Fi) with no router port forwarding.
  * **Smart Failover**: Uses ultra-low-latency local Wi-Fi when at home, and seamlessly switches to the global tunnel when away.
  * **Instant QR Code Pairing**: Scan the desktop QR code with your Android camera to immediately open and install the assistant.
  * **Interactive Safeguard Approvals**: Sensitive actions (PowerShell scripts, file modifications, GUI clicks) show an interactive **"Approve & Run" / "Reject"** confirmation card on both PC and phone.

---

## 📂 Project Structure

```
personal_assistant/
├── start.bat                   # One-click Windows desktop launcher
├── package.json                # Dependencies (Electron, React, Express, ws, Vite, Tailwind)
├── dist/                       # Production compiled UI bundle
├── electron/
│   └── main.cjs                # Electron desktop wrapper with system tray support
├── server/
│   ├── index.js                # Express & WebSocket hub server (port 42000)
│   ├── agent.js                # ReAct orchestrator & approval queue
│   ├── llm.js                  # Universal model provider adapter & port scanner
│   ├── tunnel.js               # Cloudflare worldwide tunnel manager
│   ├── storage.js              # Persistence store (sessions, messages, settings)
│   ├── bin/                    # Portable cloudflared binary
│   └── tools/
│       ├── shell.js            # PowerShell / CMD runner
│       ├── files.js            # Recursive search, read, write, list
│       ├── system.js           # CPU, RAM, battery, volume, sleep, lock
│       ├── vision.js           # Full-screen screenshot capture
│       ├── gui.js              # Mouse & keyboard automation
│       └── web.js              # DuckDuckGo search & URL scraper
└── src/
    ├── App.jsx                 # Main orchestrator & WebSocket client
    ├── index.css               # Gemini dark theme styling & custom scrollbars
    └── components/
        ├── Sidebar.jsx         # Collapsible Gemini navigation & chat history
        ├── ChatCanvas.jsx      # Message stream, suggestion cards, markdown
        ├── InputBar.jsx        # Floating rounded pill with voice & model badge
        ├── AgentStepCard.jsx   # Expandable tool execution chips
        ├── ApprovalCard.jsx    # Interactive Approve / Reject confirmation card
        ├── PairingModal.jsx    # QR code pairing for Android phone
        └── SettingsModal.jsx   # Model provider switcher & safety toggles
```

---

## 🏁 Getting Started

### 1. Launch the Application
Simply double-click `start.bat` in the `personal_assistant` directory:
```powershell
cd C:\Users\Ezan\.gemini\antigravity\scratch\personal_assistant
.\start.bat
```
Or start via npm:
```powershell
# Run backend hub server & tunnel:
npm run start:hub

# Run in browser or desktop window:
npm run start:app
```
The application will open on port `42000` (e.g. `http://localhost:42000`).

---

### 2. Connect Your Local Model (LM Studio / Ollama / AnythingLLM)
1. In the app, click the **Settings** button in the sidebar or the **Model Badge** in the floating input bar.
2. Click **"Auto-detect Local Ports"**.
3. The app will detect:
   * **LM Studio** (`http://localhost:1234`)
   * **Ollama** (`http://localhost:11434`)
   * **AnythingLLM** (`http://localhost:3001`)
4. Select your loaded model from the dropdown and click **Save Changes**.

---

### 3. Connect from Your Android Phone (Worldwide Access)
1. In the desktop app sidebar, click **"Pair Android App"**.
2. A modal will appear displaying your **Pairing QR Code**.
3. Open your camera app on your Android phone and point it at the screen.
4. Tap the link to open Personal Assistant in Google Chrome on your phone.
5. In Chrome on Android, tap the three dots menu (⋮) and choose **"Add to Home screen"** / **"Install app"** to install it as a full-screen, native-feeling mobile app.
6. You can now command your PC from anywhere in the world as long as your computer is on and connected to the internet!

---

## 📜 License

This project is licensed under the **GNU General Public License v3.0** (GPLv3) - see the [LICENSE](LICENSE) file for details.

