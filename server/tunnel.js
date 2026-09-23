import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';

export class TunnelManager {
  constructor(port = 42000) {
    this.port = port;
    this.tunnelUrl = null;
    this.process = null;
    this.status = 'stopped';
    this.binDir = path.resolve('server/bin');
    this.cloudflaredPath = path.join(this.binDir, 'cloudflared.exe');
  }

  /**
   * Ensure cloudflared binary is available.
   */
  async ensureBinary() {
    if (fs.existsSync(this.cloudflaredPath)) {
      return this.cloudflaredPath;
    }

    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }

    console.log('[Tunnel] Downloading portable cloudflared for Windows...');
    const downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

    const targetPath = this.cloudflaredPath;

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(targetPath);
      
      const get = (url) => {
        https.get(url, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return get(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Download failed with status ${res.statusCode}`));
          }
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => {
              console.log('[Tunnel] cloudflared downloaded successfully.');
              resolve(targetPath);
            });
          });
        }).on('error', (err) => {
          fs.unlink(targetPath, () => {});
          reject(err);
        });
      };

      get(downloadUrl);
    });
  }

  /**
   * Start the worldwide tunnel.
   */
  async start() {
    if (this.process) return this.tunnelUrl;

    this.status = 'starting';
    let exePath = 'cloudflared';

    try {
      exePath = await this.ensureBinary();
    } catch (err) {
      console.warn('[Tunnel] Could not download cloudflared:', err.message);
      // Fallback: try PATH
    }

    return new Promise((resolve) => {
      try {
        console.log(`[Tunnel] Launching Cloudflare Tunnel on port ${this.port}...`);
        this.process = spawn(exePath, ['tunnel', '--url', `http://127.0.0.1:${this.port}`], {
          windowsHide: true
        });

        const timeout = setTimeout(() => {
          if (!this.tunnelUrl) {
            console.log('[Tunnel] Tunnel initialization timed out or waiting in background.');
            resolve(null);
          }
        }, 15000);

        const onData = (data) => {
          const str = data.toString();
          // Regex for Cloudflare quick tunnel URL (ignoring api.trycloudflare.com)
          const match = str.match(/https:\/\/(?!api\b)[a-zA-Z0-9-]+\.trycloudflare\.com/i);
          if (match && !this.tunnelUrl) {
            this.tunnelUrl = match[0];
            this.status = 'online';
            clearTimeout(timeout);
            console.log(`[Tunnel] Worldwide URL online: ${this.tunnelUrl}`);
            resolve(this.tunnelUrl);
          }
        };

        this.process.stdout.on('data', onData);
        this.process.stderr.on('data', onData);

        this.process.on('close', () => {
          this.status = 'stopped';
          this.tunnelUrl = null;
          this.process = null;
        });

        this.process.on('error', (err) => {
          console.warn('[Tunnel] Cloudflared process error:', err.message);
          this.status = 'error';
          clearTimeout(timeout);
          resolve(null);
        });
      } catch (err) {
        console.warn('[Tunnel] Failed to spawn tunnel process:', err.message);
        this.status = 'error';
        resolve(null);
      }
    });
  }

  /**
   * Stop the tunnel.
   */
  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.tunnelUrl = null;
      this.status = 'stopped';
    }
  }

  getUrl() {
    return this.tunnelUrl;
  }
}
