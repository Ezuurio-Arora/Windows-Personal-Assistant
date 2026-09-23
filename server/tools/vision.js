import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { executeCommand } from './shell.js';

/**
 * Capture full Windows desktop screenshot and return as base64 JPEG data URL.
 * @param {number} [quality=75] - JPEG quality (1-100).
 * @param {number} [maxWidth=1280] - Optional downscale width to reduce transmission bandwidth.
 */
export async function captureDesktopScreenshot(quality = 75, maxWidth = 1280) {
  const timestamp = Date.now();
  const tempPath = path.join(os.tmpdir(), `gemini_screen_${timestamp}.jpg`);
  const psPath = path.join(os.tmpdir(), `gemini_screen_${timestamp}.ps1`);
  
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try {
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen
  $bounds = $screen.Bounds
  if ($bounds.Width -le 0 -or $bounds.Height -le 0) {
    $bounds = New-Object System.Drawing.Rectangle 0, 0, 1920, 1080
  }

  $bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)

  try {
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  } catch {
    # If workstation is locked or display session is inactive, render informative status canvas
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 32, 40))
    $graphics.FillRectangle($bgBrush, 0, 0, $bounds.Width, $bounds.Height)
    $bgBrush.Dispose()

    $font = New-Object System.Drawing.Font 'Segoe UI', 18
    $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $msg = "Desktop Vision Feed (Locked / Inactive Display Session)\`nTimestamp: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    $graphics.DrawString($msg, $font, $textBrush, 50, 50)
    $font.Dispose()
    $textBrush.Dispose()
  }

  # Optional resize if wider than maxWidth
  $finalBmp = $bmp
  if ($bounds.Width -gt ${maxWidth}) {
    $newHeight = [int]($bounds.Height * (${maxWidth} / $bounds.Width))
    $resized = New-Object System.Drawing.Bitmap ${maxWidth}, $newHeight
    $gResized = [System.Drawing.Graphics]::FromImage($resized)
    $gResized.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gResized.DrawImage($bmp, 0, 0, ${maxWidth}, $newHeight)
    $gResized.Dispose()
    $bmp.Dispose()
    $finalBmp = $resized
  }

  $finalBmp.Save("${tempPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $graphics.Dispose()
  $finalBmp.Dispose()

  Write-Output "OK"
} catch {
  Write-Output "ERROR: $($_.Exception.Message)"
}
`;

  try {
    await fs.writeFile(psPath, psScript, 'utf8');
    const result = await executeCommand(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${psPath}`, 'cmd', 20000);

    if (result.exitCode === 0 && result.stdout.includes('OK')) {
      try {
        const buffer = await fs.readFile(tempPath);
        const base64 = buffer.toString('base64');

        return {
          success: true,
          mimeType: 'image/jpeg',
          dataUrl: `data:image/jpeg;base64,${base64}`,
          sizeBytes: buffer.length
        };
      } catch (err) {
        return { success: false, error: `Failed to read captured image: ${err.message}` };
      }
    }

    return { success: false, error: result.stderr || result.stdout || 'Failed to capture screenshot via PowerShell' };
  } finally {
    await fs.unlink(tempPath).catch(() => {});
    await fs.unlink(psPath).catch(() => {});
  }
}
