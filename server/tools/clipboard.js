import { executeCommand } from './shell.js';

/**
 * Get current text from the Windows clipboard.
 */
export async function getClipboard() {
  const psScript = `Get-Clipboard -ErrorAction SilentlyContinue`;
  const res = await executeCommand(psScript, 'powershell', 5000);
  return {
    content: res.stdout || '',
    length: (res.stdout || '').length
  };
}

/**
 * Set text onto the Windows clipboard.
 * @param {string} text - Text to place on the clipboard.
 */
export async function setClipboard(text) {
  const escaped = text.replace(/'/g, "''");
  const psScript = `Set-Clipboard -Value '${escaped}'`;
  const res = await executeCommand(psScript, 'powershell', 5000);
  return {
    success: res.exitCode === 0,
    message: res.exitCode === 0 ? 'Clipboard updated successfully' : res.stderr
  };
}
