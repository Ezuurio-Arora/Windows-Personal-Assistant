import { executeCommand } from './shell.js';

/**
 * Ping a host or domain to test latency and connectivity.
 * @param {string} [host='8.8.8.8']
 * @param {number} [count=4]
 */
export async function pingHost(host = '8.8.8.8', count = 4) {
  const safeHost = host.replace(/[^a-zA-Z0-9.-]/g, '');
  const psScript = `
    $res = Test-Connection -ComputerName "${safeHost}" -Count ${count} -ErrorAction SilentlyContinue
    if ($res) {
      $avg = ($res | Measure-Object -Property ResponseTime -Average).Average
      [PSCustomObject]@{
        Host = "${safeHost}"
        Online = $True
        AvgLatencyMs = [math]::Round($avg, 1)
        PacketsSent = ${count}
        PacketsReceived = $res.Count
      } | ConvertTo-Json
    } else {
      [PSCustomObject]@{
        Host = "${safeHost}"
        Online = $False
        Error = "Host unreachable"
      } | ConvertTo-Json
    }
  `;
  const res = await executeCommand(psScript, 'powershell', 10000);
  if (res.exitCode === 0 && res.stdout) {
    try {
      return JSON.parse(res.stdout);
    } catch {
      return { raw: res.stdout };
    }
  }
  return { error: 'Ping check failed' };
}

/**
 * Inspect active network adapter connections and IP configuration.
 */
export async function getNetworkConfig() {
  const psScript = `
    Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null } | ForEach-Object {
      [PSCustomObject]@{
        InterfaceAlias = $_.InterfaceAlias
        IPv4Address = $_.IPv4Address.IPAddress
        IPv4Gateway = $_.IPv4DefaultGateway.NextHop
        DNSServers = ($_.DNSServer.ServerAddresses -join ", ")
      }
    } | ConvertTo-Json -Depth 2
  `;
  const res = await executeCommand(psScript, 'powershell', 20000);
  if (res.exitCode === 0 && res.stdout) {
    try {
      const data = JSON.parse(res.stdout);
      return { interfaces: Array.isArray(data) ? data : [data] };
    } catch {
      return { raw: res.stdout };
    }
  }

  // Fallback to WMI/CIM if Get-NetIPConfiguration timed out or failed
  const fallbackScript = `
    Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=True" | ForEach-Object {
      $ip = ($_.IPAddress | Where-Object { $_ -match '^\\d+\\.\\d+\\.\\d+\\.\\d+$' } | Select-Object -First 1)
      $gw = ($_.DefaultIPGateway | Where-Object { $_ -match '^\\d+\\.\\d+\\.\\d+\\.\\d+$' } | Select-Object -First 1)
      if ($gw) {
        [PSCustomObject]@{
          InterfaceAlias = $_.Description
          IPv4Address = $ip
          IPv4Gateway = $gw
          DNSServers = if ($_.DNSServerSearchOrder) { $_.DNSServerSearchOrder -join ", " } else { "" }
        }
      }
    } | ConvertTo-Json -Depth 2
  `;
  const fbRes = await executeCommand(fallbackScript, 'powershell', 10000);
  if (fbRes.exitCode === 0 && fbRes.stdout) {
    try {
      const data = JSON.parse(fbRes.stdout);
      return { interfaces: Array.isArray(data) ? data : [data] };
    } catch {
      return { raw: fbRes.stdout };
    }
  }

  return { error: 'Could not fetch network configuration' };
}
