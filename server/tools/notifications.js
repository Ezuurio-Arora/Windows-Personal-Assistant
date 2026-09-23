import { executeCommand } from './shell.js';

/**
 * Display a native Windows notification toast or popup.
 * @param {string} title - Notification title
 * @param {string} message - Notification body
 */
export async function showNotification(title, message) {
  const safeTitle = title.replace(/'/g, "''");
  const safeMsg = message.replace(/'/g, "''");

  const psScript = `
    [void] [System.Reflection.Assembly]::LoadWithPartialName("System.Windows.Forms")
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.BalloonTipTitle = '${safeTitle}'
    $notify.BalloonTipText = '${safeMsg}'
    $notify.Visible = $True
    $notify.ShowBalloonTip(5000)
    Start-Sleep -Seconds 1
    $notify.Dispose()
    "Notification displayed"
  `;

  const res = await executeCommand(psScript, 'powershell', 8000);
  return {
    success: res.exitCode === 0,
    message: res.stdout || 'Notification sent'
  };
}

/**
 * Speak text out loud through the Windows PC speakers using SAPI TTS.
 * @param {string} text - The text to speak out loud
 * @param {number} [rate=0] - Speech rate from -10 (slow) to 10 (fast)
 */
export async function speakText(text, rate = 0) {
  const safeText = text.replace(/'/g, "''").replace(/[\r\n]+/g, ' ');
  const psScript = `
    $voice = New-Object -ComObject SAPI.SpVoice
    $voice.Rate = ${rate}
    $voice.Speak('${safeText}')
    "Spoken successfully"
  `;

  const res = await executeCommand(psScript, 'powershell', 25000);
  return {
    success: res.exitCode === 0,
    message: res.stdout || 'Speech completed'
  };
}
