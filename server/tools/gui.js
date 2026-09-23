import { executeCommand } from './shell.js';

/**
 * Bring an application window to the active foreground.
 * @param {string} target - Window title, partial title, or process name (e.g. 'Notepad', 'Word', 'Chrome').
 */
export async function focusWindow(target) {
  if (!target) return { error: 'Target window title or process name is required' };

  const safeTarget = target.replace(/'/g, "''");
  const psScript = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class WindowHelper {
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
      }
"@
    $targetName = '${safeTarget}'
    $found = $false

    # Try finding process by name
    $proc = Get-Process | Where-Object { 
      $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like "*$targetName*" -or $_.MainWindowTitle -like "*$targetName*") 
    } | Select-Object -First 1

    if ($proc) {
      [void][WindowHelper]::ShowWindowAsync($proc.MainWindowHandle, 9) # SW_RESTORE = 9
      [void][WindowHelper]::SetForegroundWindow($proc.MainWindowHandle)
      $found = $true
      $title = if ($proc.MainWindowTitle) { $proc.MainWindowTitle } else { $proc.ProcessName }
      "Focused window: " + $title
    } else {
      # Fallback to WScript.Shell AppActivate
      $wshell = New-Object -ComObject WScript.Shell
      $activated = $wshell.AppActivate($targetName)
      if ($activated) {
        $found = $true
        "Activated window matching: $targetName"
      } else {
        "Could not find active window matching: $targetName"
      }
    }
  `;

  const result = await executeCommand(psScript, 'powershell', 6000);
  return {
    success: result.exitCode === 0 && !result.stdout?.includes('Could not find'),
    message: result.stdout?.trim() || result.stderr
  };
}

/**
 * Move mouse cursor to specific screen coordinates.
 * @param {number} x
 * @param {number} y
 */
export async function mouseMove(x, y) {
  const px = parseInt(x ?? 0, 10) || 0;
  const py = parseInt(y ?? 0, 10) || 0;
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${px}, ${py})
    "Cursor moved to ${px}, ${py}"
  `;
  const result = await executeCommand(psScript, 'powershell', 4000);
  return { success: result.exitCode === 0, message: result.stdout?.trim() };
}

/**
 * Perform mouse click (left, right, double).
 * @param {'left'|'right'|'double'} [button='left']
 * @param {number} [x]
 * @param {number} [y]
 */
export async function mouseClick(button = 'left', x, y) {
  let movePart = '';
  if (x !== undefined && y !== undefined) {
    movePart = `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${parseInt(x, 10)}, ${parseInt(y, 10)})`;
  }

  const psScript = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class MouseSimulator {
        [DllImport("user32.dll", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);
        
        public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
        public const uint MOUSEEVENTF_LEFTUP = 0x04;
        public const uint MOUSEEVENTF_RIGHTDOWN = 0x08;
        public const uint MOUSEEVENTF_RIGHTUP = 0x10;
        
        public static void ClickLeft() {
          mouse_event(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        }
        public static void ClickRight() {
          mouse_event(MOUSEEVENTF_RIGHTDOWN | MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
        }
        public static void DoubleClick() {
          mouse_event(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
          System.Threading.Thread.Sleep(50);
          mouse_event(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        }
      }
"@
    Add-Type -AssemblyName System.Windows.Forms
    ${movePart}
    ${
      button === 'right'
        ? '[MouseSimulator]::ClickRight()'
        : button === 'double'
        ? '[MouseSimulator]::DoubleClick()'
        : '[MouseSimulator]::ClickLeft()'
    }
    "Click '${button}' executed"
  `;

  const result = await executeCommand(psScript, 'powershell', 5000);
  return { success: result.exitCode === 0, message: result.stdout?.trim() };
}

/**
 * Type text with super-human speed.
 * For long text or multi-line content, uses high-speed clipboard paste (Ctrl+V) which operates in milliseconds.
 * For short text, uses SendKeys.
 * @param {string} text - Text to type.
 * @param {boolean} [forceKeystrokes=false] - Force key-by-key SendKeys.
 */
export async function typeText(text, forceKeystrokes = false) {
  if (!text) return { error: 'Text is required' };

  // Use ultra-fast clipboard injection for text longer than 8 characters or containing newlines
  if (!forceKeystrokes && (text.length > 8 || text.includes('\n'))) {
    const safeText = text.replace(/\r?\n'@/g, "\n '@");
    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      # Backup previous clipboard
      $prev = Get-Clipboard -ErrorAction SilentlyContinue
      Set-Clipboard -Value @'
${safeText}
'@
      # Instant paste via Ctrl+V
      [System.Windows.Forms.SendKeys]::SendWait('^v')
      Start-Sleep -Milliseconds 50
      "Fast-typed ${text.length} characters via instant injection"
    `;
    const result = await executeCommand(psScript, 'powershell', 6000);
    return { success: result.exitCode === 0, message: result.stdout?.trim() };
  }

  // Escape special SendKeys characters: +, ^, %, ~, (, ), {, } in a single regex pass
  const escaped = text
    .replace(/([+^%~(){}])/g, '{$1}')
    .replace(/'/g, "''");

  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait('${escaped}')
    "Typed text successfully"
  `;

  const result = await executeCommand(psScript, 'powershell', 5000);
  return { success: result.exitCode === 0, message: result.stdout?.trim() };
}

/**
 * Send hotkey combinations or special keys (e.g. ^c, ^v, ^s, {ENTER}, {ESC}, %{F4}, %{TAB}).
 * @param {string} keyString - Hotkey syntax.
 */
export async function sendKeyPress(keyString) {
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait('${keyString.replace(/'/g, "''")}')
    "Sent key: ${keyString}"
  `;
  const result = await executeCommand(psScript, 'powershell', 4000);
  return { success: result.exitCode === 0, message: result.stdout?.trim() };
}

/**
 * Execute an atomic composite sequence of GUI actions (focus, move, click, type, hotkeys)
 * in a single PowerShell script run at maximum speed with zero inter-process overhead.
 * @param {Array<{ action: 'focus'|'move'|'click'|'type'|'press'|'wait', target?: string, x?: number, y?: number, button?: string, text?: string, key?: string, ms?: number }>} steps
 */
export async function automateGui(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { error: 'Steps array is required' };
  }

  const scriptParts = [
    `Add-Type -AssemblyName System.Windows.Forms`,
    `Add-Type -AssemblyName System.Drawing`,
    `Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class NativeGui {
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll", CharSet = CharSet.Auto, CallingConvention = CallingConvention.StdCall)]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);

        public const uint MOUSEEVENTF_LEFTDOWN = 0x02;
        public const uint MOUSEEVENTF_LEFTUP = 0x04;
        public const uint MOUSEEVENTF_RIGHTDOWN = 0x08;
        public const uint MOUSEEVENTF_RIGHTUP = 0x10;

        public static void ClickLeft() {
          mouse_event(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        }
        public static void ClickRight() {
          mouse_event(MOUSEEVENTF_RIGHTDOWN | MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
        }
        public static void DoubleClick() {
          mouse_event(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
          System.Threading.Thread.Sleep(40);
          mouse_event(MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        }
      }
"@`,
    `$wshell = New-Object -ComObject WScript.Shell`
  ];

  for (const step of steps) {
    switch (step.action) {
      case 'focus': {
        const target = (step.target || '').replace(/'/g, "''");
        scriptParts.push(`
          $proc = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like "*${target}*" -or $_.MainWindowTitle -like "*${target}*") } | Select-Object -First 1
          if ($proc) {
            [void][NativeGui]::ShowWindowAsync($proc.MainWindowHandle, 9)
            [void][NativeGui]::SetForegroundWindow($proc.MainWindowHandle)
          } else {
            $wshell.AppActivate('${target}') | Out-Null
          }
          Start-Sleep -Milliseconds 150
        `);
        break;
      }
      case 'move': {
        scriptParts.push(`[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${parseInt(step.x || 0, 10)}, ${parseInt(step.y || 0, 10)})`);
        break;
      }
      case 'click': {
        const btn = step.button || 'left';
        if (step.x !== undefined && step.y !== undefined) {
          scriptParts.push(`[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${parseInt(step.x, 10)}, ${parseInt(step.y, 10)})`);
        }
        if (btn === 'right') {
          scriptParts.push(`[NativeGui]::ClickRight()`);
        } else if (btn === 'double') {
          scriptParts.push(`[NativeGui]::DoubleClick()`);
        } else {
          scriptParts.push(`[NativeGui]::ClickLeft()`);
        }
        break;
      }
      case 'type': {
        const text = step.text || '';
        if (text.length > 8 || text.includes('\n')) {
          const safeText = text.replace(/\r?\n'@/g, "\n '@");
          scriptParts.push(`
            Set-Clipboard -Value @'
${safeText}
'@
            [System.Windows.Forms.SendKeys]::SendWait('^v')
            Start-Sleep -Milliseconds 40
          `);
        } else {
          const escaped = text.replace(/([+^%~(){}])/g, '{$1}').replace(/'/g, "''");
          scriptParts.push(`[System.Windows.Forms.SendKeys]::SendWait('${escaped}')`);
        }
        break;
      }
      case 'press': {
        const key = (step.key || '').replace(/'/g, "''");
        scriptParts.push(`[System.Windows.Forms.SendKeys]::SendWait('${key}')`);
        break;
      }
      case 'wait': {
        const ms = Math.min(5000, parseInt(step.ms || 100, 10));
        scriptParts.push(`Start-Sleep -Milliseconds ${ms}`);
        break;
      }
    }
  }

  scriptParts.push(`"Executed ${steps.length} GUI automation steps successfully"`);

  const fullScript = scriptParts.join('\n');
  const result = await executeCommand(fullScript, 'powershell', 15000);
  return {
    success: result.exitCode === 0,
    stepsExecuted: steps.length,
    message: result.stdout?.trim() || result.stderr
  };
}
