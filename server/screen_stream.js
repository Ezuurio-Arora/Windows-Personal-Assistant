import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { executeCommand } from './tools/shell.js';

/**
 * High-performance on-demand desktop screen stream manager.
 * Captures frames only when active consumers exist; halts capture loop when zero consumers.
 */
export class ScreenStreamManager {
  constructor(options = {}) {
    this.targetFps = Math.max(1, Math.min(20, options.fps || 10));
    this.quality = options.quality || 60;
    this.maxWidth = options.maxWidth || 1024;

    this.activeWsConsumers = new Set();
    this.activeHttpConsumers = new Set();

    this.isRunning = false;
    this.isCapturing = false;
    this.timer = null;
    this.frameIndex = 0;
    this.lastFrameBuffer = null;

    // Pre-allocated temp paths for screen capture
    this.tempJpgPath = path.join(os.tmpdir(), `stream_frame_${process.pid}.jpg`);
    this.tempPsPath = path.join(os.tmpdir(), `stream_capture_${process.pid}.ps1`);
  }

  /**
   * Register a WebSocket subscriber for binary JPEG frames.
   */
  addWsConsumer(ws) {
    this.activeWsConsumers.add(ws);
    console.log(`[ScreenStream] WS consumer attached. Total consumers: ${this.getTotalConsumers()}`);

    ws.on('close', () => {
      this.removeWsConsumer(ws);
    });

    if (this.lastFrameBuffer && ws.readyState === 1) {
      try {
        ws.send(this.lastFrameBuffer, { binary: true });
      } catch {}
    }

    this.checkLifecycle();
  }

  /**
   * Remove a WebSocket subscriber.
   */
  removeWsConsumer(ws) {
    this.activeWsConsumers.delete(ws);
    console.log(`[ScreenStream] WS consumer detached. Total consumers: ${this.getTotalConsumers()}`);
    this.checkLifecycle();
  }

  /**
   * Register an Express HTTP multipart/x-mixed-replace subscriber.
   */
  addHttpConsumer(req, res) {
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Connection': 'close'
    });

    this.activeHttpConsumers.add(res);
    console.log(`[ScreenStream] HTTP consumer attached. Total consumers: ${this.getTotalConsumers()}`);

    req.on('close', () => {
      this.activeHttpConsumers.delete(res);
      console.log(`[ScreenStream] HTTP consumer closed. Total consumers: ${this.getTotalConsumers()}`);
      this.checkLifecycle();
    });

    if (this.lastFrameBuffer) {
      this.sendHttpFrame(res, this.lastFrameBuffer);
    }

    this.checkLifecycle();
  }

  getTotalConsumers() {
    return this.activeWsConsumers.size + this.activeHttpConsumers.size;
  }

  /**
   * Evaluate whether to start or halt the capture loop based on consumer count.
   */
  checkLifecycle() {
    const total = this.getTotalConsumers();
    if (total > 0 && !this.isRunning) {
      this.startCaptureLoop();
    } else if (total === 0 && this.isRunning) {
      this.stopCaptureLoop();
    }
  }

  startCaptureLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[ScreenStream] Starting on-demand capture loop @ ${this.targetFps} FPS`);

    const intervalMs = Math.round(1000 / this.targetFps);

    const loop = async () => {
      if (!this.isRunning) return;

      if (this.getTotalConsumers() === 0) {
        this.stopCaptureLoop();
        return;
      }

      if (!this.isCapturing) {
        this.isCapturing = true;
        try {
          const frameBuffer = await this.captureFrame();
          if (frameBuffer && this.isRunning) {
            this.broadcastFrame(frameBuffer);
          }
        } catch (err) {
          console.error('[ScreenStream] Capture tick error:', err.message);
        } finally {
          this.isCapturing = false;
        }
      }

      if (this.isRunning) {
        this.timer = setTimeout(loop, intervalMs);
      }
    };

    loop();
  }

  stopCaptureLoop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isCapturing = false;
    console.log('[ScreenStream] Halting capture loop. Zero consumers active (0% CPU/GPU overhead).');
  }

  /**
   * Capture a single desktop frame to a JPEG Buffer.
   * Handles locked workstation or headless display by rendering a clean status canvas.
   */
  async captureFrame() {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try {
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen
  $bounds = if ($screen) { $screen.Bounds } else { New-Object System.Drawing.Rectangle 0, 0, 1920, 1080 }
  if ($bounds.Width -le 0 -or $bounds.Height -le 0) {
    $bounds = New-Object System.Drawing.Rectangle 0, 0, 1920, 1080
  }

  $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)

  try {
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  } catch {
    # Workstation locked or display session inactive
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(19, 19, 20))
    $graphics.FillRectangle($bgBrush, 0, 0, $bounds.Width, $bounds.Height)
    $bgBrush.Dispose()

    $fontTitle = New-Object System.Drawing.Font 'Segoe UI', 24, [System.Drawing.FontStyle]::Bold
    $fontSubtitle = New-Object System.Drawing.Font 'Segoe UI', 14
    $textBrushBlue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(125, 172, 248))
    $textBrushWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(227, 227, 227))

    $graphics.DrawString("Desktop Vision Stream", $fontTitle, $textBrushBlue, 60, 60)
    $msg = "Workstation Locked / Inactive Display Session\`nTimestamp: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    $graphics.DrawString($msg, $fontSubtitle, $textBrushWhite, 60, 110)

    $fontTitle.Dispose()
    $fontSubtitle.Dispose()
    $textBrushBlue.Dispose()
    $textBrushWhite.Dispose()
  }

  $finalBmp = $bmp
  if ($bounds.Width -gt ${this.maxWidth}) {
    $newHeight = [int]($bounds.Height * (${this.maxWidth} / $bounds.Width))
    $resized = New-Object System.Drawing.Bitmap ${this.maxWidth}, $newHeight
    $gResized = [System.Drawing.Graphics]::FromImage($resized)
    $gResized.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Bilinear
    $gResized.DrawImage($bmp, 0, 0, ${this.maxWidth}, $newHeight)
    $gResized.Dispose()
    $bmp.Dispose()
    $finalBmp = $resized
  }

  $finalBmp.Save("${this.tempJpgPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $graphics.Dispose()
  $finalBmp.Dispose()
  Write-Output "OK"
} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
}
`;

    try {
      await fs.writeFile(this.tempPsPath, psScript, 'utf8');
      const result = await executeCommand(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${this.tempPsPath}"`,
        'cmd',
        5000
      );

      if (result.exitCode === 0 && result.stdout.includes('OK')) {
        const buffer = await fs.readFile(this.tempJpgPath);
        this.frameIndex++;
        this.lastFrameBuffer = buffer;
        return buffer;
      }
    } catch (err) {
      console.error('[ScreenStream] Frame capture execution failed:', err.message);
    } finally {
      await fs.unlink(this.tempJpgPath).catch(() => {});
      await fs.unlink(this.tempPsPath).catch(() => {});
    }

    return this.lastFrameBuffer;
  }

  /**
   * Broadcast captured frame to all active WS and HTTP subscribers with backpressure protection.
   */
  broadcastFrame(jpegBuffer) {
    if (!jpegBuffer) return;

    // 1. WebSocket binary broadcast
    for (const ws of this.activeWsConsumers) {
      if (ws.readyState === 1) { // WebSocket.OPEN
        // Slow-consumer drop-frame protection: skip if socket buffer is congested (>64KB)
        if (ws.bufferedAmount && ws.bufferedAmount > 65536) {
          continue;
        }
        try {
          ws.send(jpegBuffer, { binary: true });
        } catch {}
      } else {
        this.activeWsConsumers.delete(ws);
      }
    }

    // 2. HTTP multipart/x-mixed-replace broadcast
    for (const res of this.activeHttpConsumers) {
      if (!res.writableEnded && !res.destroyed) {
        if (res.writableNeedDrain) {
          continue; // Drop frame on slow HTTP connection
        }
        this.sendHttpFrame(res, jpegBuffer);
      } else {
        this.activeHttpConsumers.delete(res);
      }
    }

    this.checkLifecycle();
  }

  sendHttpFrame(res, jpegBuffer) {
    try {
      res.write(`--frame\r\n`);
      res.write(`Content-Type: image/jpeg\r\n`);
      res.write(`Content-Length: ${jpegBuffer.length}\r\n\r\n`);
      res.write(jpegBuffer);
      res.write(`\r\n`);
    } catch (err) {
      this.activeHttpConsumers.delete(res);
    }
  }
}

// Export singleton instance
export const screenStreamManager = new ScreenStreamManager({ fps: 10, quality: 60, maxWidth: 1024 });
