import { spawn } from 'child_process';

/**
 * Executes a PowerShell or CMD command safely on Windows.
 * @param {string} command - The command string to execute.
 * @param {string} [shellType='powershell'] - 'powershell' or 'cmd'.
 * @param {number} [timeoutMs=60000] - Execution timeout in ms.
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number, durationMs: number}>}
 */
export async function executeCommand(command, shellType = 'powershell', timeoutMs = 60000) {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const isPowershell = shellType.toLowerCase() === 'powershell';
    const binary = isPowershell ? 'powershell.exe' : 'cmd.exe';
    const args = isPowershell 
      ? ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command]
      : ['/c', command];

    const child = spawn(binary, args, {
      windowsHide: true,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill();
      resolve({
        stdout,
        stderr: stderr + '\n[Command execution timed out after ' + timeoutMs + 'ms]',
        exitCode: -1,
        durationMs: Date.now() - startTime
      });
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 0,
        durationMs: Date.now() - startTime
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: `Failed to start process: ${err.message}`,
        exitCode: -1,
        durationMs: Date.now() - startTime
      });
    });
  });
}
