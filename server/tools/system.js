import { executeCommand } from './shell.js';

let cachedHardwareProfile = null;

/**
 * Dynamically queries and caches the machine's true hardware profile (OS, Manufacturer, Model, CPU).
 * Works universally on ANY Windows PC without hardcoding.
 */
export async function getHardwareProfile() {
  if (cachedHardwareProfile) {
    return cachedHardwareProfile;
  }

  const psScript = `
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    $proc = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1

    [PSCustomObject]@{
      os = if ($os.Caption) { $os.Caption.Trim() } else { "Windows (Unknown Version)" }
      osVersion = $os.Version
      manufacturer = if ($cs.Manufacturer) { $cs.Manufacturer.Trim() } else { "Unknown" }
      model = if ($cs.Model) { $cs.Model.Trim() } else { "Generic PC" }
      processor = if ($proc.Name) { $proc.Name.Trim() } else { "Intel/AMD Processor" }
      totalRamGB = if ($cs.TotalPhysicalMemory) { [math]::Round($cs.TotalPhysicalMemory / 1GB, 1) } else { 0 }
      hostName = if ($cs.Name) { $cs.Name } else { $env:COMPUTERNAME }
    } | ConvertTo-Json
  `;

  try {
    const result = await executeCommand(psScript, 'powershell', 8000);
    if (result.exitCode === 0 && result.stdout) {
      cachedHardwareProfile = JSON.parse(result.stdout);
      return cachedHardwareProfile;
    }
  } catch (err) {
    console.error('[System] Error querying hardware profile:', err);
  }

  // Graceful dynamic fallback using standard Node os module if PowerShell fails
  const osModule = await import('os');
  cachedHardwareProfile = {
    os: `Windows (${osModule.release()})`,
    osVersion: osModule.release(),
    manufacturer: 'PC Manufacturer',
    model: 'Personal Computer',
    processor: osModule.cpus()[0]?.model || 'Multi-Core Processor',
    totalRamGB: Math.round(osModule.totalmem() / (1024 * 1024 * 1024)),
    hostName: osModule.hostname()
  };
  return cachedHardwareProfile;
}

/**
 * Get comprehensive Windows system metrics: CPU, RAM, Disks, Battery, and Verified Hardware.
 */
export async function getSystemMetrics() {
  const hw = await getHardwareProfile();

  const psScript = `
    $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
    $os = Get-CimInstance Win32_OperatingSystem
    $totalRam = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
    $freeRam = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    $usedRam = [math]::Round($totalRam - $freeRam, 2)
    $ramPercent = [math]::Round(($usedRam / $totalRam) * 100, 1)

    $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
      [PSCustomObject]@{
        Drive = $_.DeviceID
        TotalGB = [math]::Round($_.Size / 1GB, 1)
        FreeGB = [math]::Round($_.FreeSpace / 1GB, 1)
        UsedPercent = [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 1)
      }
    }

    $battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1
    $batteryInfo = if ($battery) {
      @{
        EstimatedChargeRemaining = $battery.EstimatedChargeRemaining
        BatteryStatus = $battery.BatteryStatus
        EstimatedRunTimeMinutes = $battery.EstimatedRunTime
      }
    } else {
      @{ Status = "Desktop / No Battery" }
    }

    [PSCustomObject]@{
      Hardware = @{
        OperatingSystem = "${hw.os}"
        OSVersion = "${hw.osVersion}"
        Manufacturer = "${hw.manufacturer}"
        Model = "${hw.model}"
        Processor = "${hw.processor}"
      }
      CpuLoadPercent = $cpu
      Memory = @{
        TotalGB = $totalRam
        UsedGB = $usedRam
        FreeGB = $freeRam
        UsedPercent = $ramPercent
      }
      Disks = $disks
      Battery = $batteryInfo
      HostName = $env:COMPUTERNAME
      UptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
    } | ConvertTo-Json -Depth 4
  `;

  const result = await executeCommand(psScript, 'powershell', 15000);
  if (result.exitCode === 0 && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return { raw: result.stdout };
    }
  }
  return { error: result.stderr || 'Failed to retrieve system metrics' };
}

/**
 * Set Windows system audio master volume or mute.
 * @param {number|string} level - 0 to 100, or 'mute', 'unmute'.
 */
export async function setVolume(level) {
  let psCommand = '';
  if (level === 'mute' || level === 'unmute') {
    psCommand = `
      $wshShell = New-Object -ComObject WScript.Shell
      $wshShell.SendKeys([char]173) # 0xAD = Volume Mute toggle
      "Volume toggle executed"
    `;
  } else {
    // Clamp 0-100
    const vol = Math.max(0, Math.min(100, parseInt(level, 10) || 50));
    psCommand = `
      # Use Windows CoreAudio API via PowerShell type definition
      $code = @'
      using System.Runtime.InteropServices;
      [ComImport]
      [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IAudioEndpointVolume {
        int f(); int g(); int h(); int i();
        int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
        int j();
        int GetMasterVolumeLevelScalar(out float pfLevel);
      }
      [ComImport]
      [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IMMDevice {
        int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
      }
      [ComImport]
      [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IMMDeviceEnumerator {
        int f();
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
      }
      [ComImport]
      [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject {}
      public class AudioHelper {
        public static void SetVolume(float level) {
          var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
          IMMDevice dev = null;
          enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
          var iid = typeof(IAudioEndpointVolume).GUID;
          IAudioEndpointVolume aev = null;
          dev.Activate(ref iid, 23, 0, out aev);
          aev.SetMasterVolumeLevelScalar(level, System.Guid.Empty);
        }
      }
'@
      Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
      [AudioHelper]::SetVolume(${vol / 100})
      "Volume set to ${vol}%"
    `;
  }

  const result = await executeCommand(psCommand, 'powershell', 10000);
  return {
    success: result.exitCode === 0,
    message: result.stdout || result.stderr || `Volume adjusted to ${level}`
  };
}

/**
 * Perform Windows power actions: lock workstation or sleep.
 * @param {'lock'|'sleep'} action
 */
export async function powerAction(action) {
  if (action === 'lock') {
    const result = await executeCommand('rundll32.exe user32.dll,LockWorkStation', 'cmd', 5000);
    return { success: result.exitCode === 0, action: 'Workstation locked' };
  } else if (action === 'sleep') {
    const result = await executeCommand('rundll32.exe powrprof.dll,SetSuspendState 0,1,0', 'cmd', 5000);
    return { success: result.exitCode === 0, action: 'Computer placed to sleep' };
  }
  return { error: `Unsupported power action: ${action}` };
}

/**
 * Get the currently focused active window on Windows.
 */
export async function getActiveWindow() {
  const psScript = `
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      using System.Text;
      public class Win32 {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
      }
"@
    $hwnd = [Win32]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 256
    [void][Win32]::GetWindowText($hwnd, $sb, 256)
    $pid = 0
    [void][Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid)
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue

    [PSCustomObject]@{
      WindowTitle = $sb.ToString()
      ProcessName = if ($proc) { $proc.ProcessName } else { "Unknown" }
      ProcessId = $pid
    } | ConvertTo-Json
  `;

  const result = await executeCommand(psScript, 'powershell', 8000);
  if (result.exitCode === 0 && result.stdout) {
    try {
      return JSON.parse(result.stdout);
    } catch {
      return { raw: result.stdout };
    }
  }
  return { error: 'Could not determine active window' };
}
