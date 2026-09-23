import { executeCommand } from './shell.js';

export const KNOWN_DESTINATIONS = {
  'apple store': 'https://www.apple.com/store',
  'apple': 'https://www.apple.com',
  'apple inc': 'https://www.apple.com',
  'google': 'https://www.google.com',
  'youtube': 'https://www.youtube.com',
  'amazon': 'https://www.amazon.com',
  'github': 'https://www.github.com',
  'reddit': 'https://www.reddit.com',
  'netflix': 'https://www.netflix.com',
  'spotify': 'https://open.spotify.com',
  'twitter': 'https://x.com',
  'x': 'https://x.com',
  'facebook': 'https://www.facebook.com',
  'instagram': 'https://www.instagram.com',
  'linkedin': 'https://www.linkedin.com',
  'wikipedia': 'https://www.wikipedia.org',
  'chatgpt': 'https://chatgpt.com',
  'openai': 'https://chatgpt.com',
  'gemini': 'https://gemini.google.com',
  'claude': 'https://claude.ai',
  'gmail': 'https://mail.google.com',
  'maps': 'https://maps.google.com'
};

/**
 * Resolve a query or keyword into a canonical HTTPS URL.
 */
export function resolveWebDestination(queryOrSite = '') {
  if (!queryOrSite) return '';
  const trimmed = queryOrSite.trim();
  const lower = trimmed.toLowerCase();

  // 1. Direct match in dictionary
  if (KNOWN_DESTINATIONS[lower]) {
    return KNOWN_DESTINATIONS[lower];
  }

  // 2. Keyword match in dictionary (e.g. "the apple store" or "navigate to apple store")
  for (const [key, url] of Object.entries(KNOWN_DESTINATIONS)) {
    if (lower === key || lower.includes(key)) {
      return url;
    }
  }

  // 3. Already a full URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // 4. Starts with www.
  if (trimmed.startsWith('www.')) {
    return `https://${trimmed}`;
  }

  // 5. Domain name pattern (e.g. apple.com, google.com, github.io)
  if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // 6. Search query fallback
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

/**
 * Launch an installed application, file, or URL on Windows.
 * @param {string} appOrPath - e.g. "notepad", "calc", "chrome", "code", "spotify", or a file path / URL
 * @param {string} [args=""] - Optional CLI arguments or destination URL
 */
export async function launchApp(appOrPath, args = '') {
  if (!appOrPath) return { error: 'Application name, path, or URL is required' };

  let target = appOrPath.trim();
  let argList = (args || '').trim();

  // If appOrPath itself is a web URL or domain
  if (
    target.startsWith('http://') ||
    target.startsWith('https://') ||
    target.startsWith('www.') ||
    /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(target)
  ) {
    const url = resolveWebDestination(target);
    const psScript = `
      # Check if default browser processes are stuck in headless background mode
      $chromeProcs = Get-Process -Name chrome -ErrorAction SilentlyContinue
      $chromeWin = $chromeProcs | Where-Object { $_.MainWindowHandle -ne 0 }
      if ($chromeProcs -and -not $chromeWin) {
        Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 400
      }
      Start-Process "${url.replace(/"/g, '`"')}"
      Start-Sleep -Milliseconds 600
      $wshell = New-Object -ComObject WScript.Shell
      $wshell.AppActivate("Google Chrome") | Out-Null
    `;
    const res = await executeCommand(psScript, 'powershell', 8000);
    return {
      success: res.exitCode === 0,
      message: `Navigated to ${url} in default browser.`
    };
  }

  // Check if target is a browser (chrome, msedge, edge, firefox, brave, opera)
  const isBrowser = /^(chrome|msedge|edge|firefox|brave|opera)$/i.test(target);
  if (isBrowser) {
    const targetUrl = argList ? resolveWebDestination(argList) : 'https://www.google.com';
    const psScript = `
      $targetName = "${target.replace(/"/g, '`"')}"
      $targetUrl = "${targetUrl.replace(/"/g, '`"')}"
      
      # Check if this browser has only windowless zombie background processes
      $procs = Get-Process -Name $targetName -ErrorAction SilentlyContinue
      $hasWindow = $procs | Where-Object { $_.MainWindowHandle -ne 0 }
      if ($procs -and -not $hasWindow) {
        Stop-Process -Name $targetName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 400
      }
      
      Start-Process -FilePath $targetName -ArgumentList "--new-window \`"$targetUrl\`"" -ErrorAction Stop
      Start-Sleep -Milliseconds 600
      $wshell = New-Object -ComObject WScript.Shell
      $wshell.AppActivate($targetName) | Out-Null
      "Application '$targetName' launched and navigated to $targetUrl."
    `;
    const res = await executeCommand(psScript, 'powershell', 8000);
    return {
      success: res.exitCode === 0,
      message: res.stdout?.trim() || `Application '${target}' launched and navigated to ${targetUrl}.`
    };
  }

  // Standard desktop application launch
  const psScript = `
    $target = "${target.replace(/"/g, '`"')}"
    $argsStr = "${argList.replace(/"/g, '`"')}"
    if ($argsStr) {
      Start-Process -FilePath $target -ArgumentList $argsStr -ErrorAction Stop
    } else {
      Start-Process -FilePath $target -ErrorAction Stop
    }
    Start-Sleep -Milliseconds 500
    $wshell = New-Object -ComObject WScript.Shell
    $wshell.AppActivate($target) | Out-Null
    "Application '$target' launched successfully."
  `;
  const res = await executeCommand(psScript, 'powershell', 8000);
  return {
    success: res.exitCode === 0,
    message: res.stdout?.trim() || res.stderr || `Attempted to launch ${appOrPath}`
  };
}

/**
 * List running processes sorted by memory or CPU usage.
 * @param {number} [limit=15]
 * @param {'memory'|'cpu'} [sortBy='memory']
 */
export async function listProcesses(limit = 15, sortBy = 'memory') {
  const sortProperty = sortBy === 'cpu' ? 'CPU' : 'WorkingSet64';
  const psScript = `
    Get-Process | Sort-Object -Property ${sortProperty} -Descending | Select-Object -First ${limit} | ForEach-Object {
      [PSCustomObject]@{
        Id = $_.Id
        ProcessName = $_.ProcessName
        CpuSeconds = [math]::Round($_.CPU, 2)
        MemoryMB = [math]::Round($_.WorkingSet64 / 1MB, 1)
        Responding = $_.Responding
        MainWindowTitle = $_.MainWindowTitle
      }
    } | ConvertTo-Json -Depth 2
  `;
  const res = await executeCommand(psScript, 'powershell', 10000);
  if (res.exitCode === 0 && res.stdout) {
    try {
      const data = JSON.parse(res.stdout);
      return {
        totalReturned: Array.isArray(data) ? data.length : 1,
        processes: Array.isArray(data) ? data : [data]
      };
    } catch {
      return { raw: res.stdout };
    }
  }
  return { error: res.stderr || 'Failed to list processes' };
}

/**
 * Terminate a process by ID or Name.
 * @param {number|string} processIdOrName - PID (number) or process name string (e.g. "notepad")
 */
export async function killProcess(processIdOrName) {
  const isNumeric = /^\d+$/.test(String(processIdOrName));
  const psScript = isNumeric
    ? `Stop-Process -Id ${processIdOrName} -Force -ErrorAction Stop; "Process ID ${processIdOrName} terminated."`
    : `Stop-Process -Name "${processIdOrName}" -Force -ErrorAction Stop; "Process '${processIdOrName}' terminated."`;

  const res = await executeCommand(psScript, 'powershell', 8000);
  return {
    success: res.exitCode === 0,
    message: res.stdout || res.stderr || `Executed kill on ${processIdOrName}`
  };
}

/**
 * Inspect active network listening ports and established connections.
 * @param {number} [limit=20]
 */
export async function getListeningPorts(limit = 20) {
  const psScript = `
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Select-Object -First ${limit} | ForEach-Object {
      $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
      [PSCustomObject]@{
        LocalAddress = $_.LocalAddress
        LocalPort = $_.LocalPort
        ProcessId = $_.OwningProcess
        ProcessName = if ($proc) { $proc.ProcessName } else { "Unknown" }
      }
    } | ConvertTo-Json -Depth 2
  `;
  const res = await executeCommand(psScript, 'powershell', 10000);
  if (res.exitCode === 0 && res.stdout) {
    try {
      const data = JSON.parse(res.stdout);
      return { ports: Array.isArray(data) ? data : [data] };
    } catch {
      return { raw: res.stdout };
    }
  }
  return { error: res.stderr || 'Failed to inspect network ports' };
}
