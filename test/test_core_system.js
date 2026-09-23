import { getHardwareProfile, getSystemMetrics } from '../server/tools/system.js';
import { executeCommand } from '../server/tools/shell.js';
import { listProcesses, getListeningPorts } from '../server/tools/apps.js';
import { pingHost, getNetworkConfig } from '../server/tools/network.js';

async function runExhaustiveTest() {
  console.log('================================================================');
  console.log('   CORE SYSTEM, HARDWARE & SHELL EXHAUSTIVE TEST SUITE');
  console.log(`   Started at: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const results = [];

  function recordResult(name, status, durationMs, details, rawOutput = null) {
    results.push({ name, status, durationMs, details, rawOutput });
    const mark = status === 'PASSED' ? '✓' : '✗';
    console.log(`[${new Date().toISOString()}] ${mark} [${status}] ${name} (${durationMs}ms)`);
    if (details) {
      console.log(`    Detail: ${details}`);
    }
  }

  // --- 1. Test getHardwareProfile() ---
  console.log('\n--- [1/7] Testing getHardwareProfile() ---');
  const t1Start = Date.now();
  try {
    const hw = await getHardwareProfile();
    const duration = Date.now() - t1Start;
    console.log('Detected Hardware:', JSON.stringify(hw, null, 2));

    const valid = hw &&
      typeof hw.os === 'string' && hw.os.length > 0 &&
      typeof hw.manufacturer === 'string' && hw.manufacturer.length > 0 &&
      typeof hw.model === 'string' && hw.model.length > 0 &&
      typeof hw.processor === 'string' && hw.processor.length > 0 &&
      typeof hw.totalRamGB === 'number' && hw.totalRamGB > 0 &&
      typeof hw.hostName === 'string' && hw.hostName.length > 0;

    if (valid) {
      recordResult(
        'getHardwareProfile()',
        'PASSED',
        duration,
        `OS: ${hw.os} | Host: ${hw.hostName} | CPU: ${hw.processor} | RAM: ${hw.totalRamGB} GB | Model: ${hw.manufacturer} ${hw.model}`,
        hw
      );
    } else {
      recordResult(
        'getHardwareProfile()',
        'FAILED',
        duration,
        'Profile missing required fields or non-numeric RAM: ' + JSON.stringify(hw),
        hw
      );
    }
  } catch (err) {
    recordResult('getHardwareProfile()', 'FAILED', Date.now() - t1Start, err.message);
  }

  // --- 2. Test getSystemMetrics() ---
  console.log('\n--- [2/7] Testing getSystemMetrics() ---');
  const t2Start = Date.now();
  try {
    const metrics = await getSystemMetrics();
    const duration = Date.now() - t2Start;
    console.log('System Metrics:', JSON.stringify(metrics, null, 2));

    const hasCpu = metrics.CpuLoadPercent !== undefined && metrics.CpuLoadPercent !== null;
    const hasRam = metrics.Memory && typeof metrics.Memory.TotalGB === 'number' && typeof metrics.Memory.UsedGB === 'number';
    const hasDisks = Array.isArray(metrics.Disks) ? metrics.Disks.length > 0 : !!metrics.Disks;
    const hasBattery = metrics.Battery !== undefined;
    const hasUptime = typeof metrics.UptimeHours === 'number' && metrics.UptimeHours >= 0;

    if (hasCpu && hasRam && hasDisks && hasBattery && hasUptime) {
      const diskSummary = Array.isArray(metrics.Disks)
        ? metrics.Disks.map(d => `${d.Drive} (${d.UsedPercent}% used of ${d.TotalGB}GB)`).join(', ')
        : `${metrics.Disks.Drive} (${metrics.Disks.UsedPercent}% used)`;
      const battSummary = metrics.Battery.EstimatedChargeRemaining !== undefined
        ? `${metrics.Battery.EstimatedChargeRemaining}%`
        : (metrics.Battery.Status || 'Desktop/No Battery');

      recordResult(
        'getSystemMetrics()',
        'PASSED',
        duration,
        `CPU: ${metrics.CpuLoadPercent}% | RAM: ${metrics.Memory.UsedPercent}% of ${metrics.Memory.TotalGB}GB | Disks: [${diskSummary}] | Battery: ${battSummary} | Uptime: ${metrics.UptimeHours}h`,
        metrics
      );
    } else {
      recordResult(
        'getSystemMetrics()',
        'FAILED',
        duration,
        `Validation failed: CPU=${hasCpu}, RAM=${hasRam}, Disks=${hasDisks}, Battery=${hasBattery}, Uptime=${hasUptime}`,
        metrics
      );
    }
  } catch (err) {
    recordResult('getSystemMetrics()', 'FAILED', Date.now() - t2Start, err.message);
  }

  // --- 3a. Test executeCommand(cmd, 'powershell') ---
  console.log('\n--- [3a/7] Testing executeCommand(command, "powershell") ---');
  const t3aStart = Date.now();
  try {
    const res = await executeCommand('Write-Output "PowerShell Core Subsystem Online"', 'powershell', 10000);
    const duration = Date.now() - t3aStart;
    console.log('PowerShell Output:', JSON.stringify(res, null, 2));

    if (res.exitCode === 0 && res.stdout.includes('PowerShell Core Subsystem Online')) {
      recordResult(
        'executeCommand(powershell)',
        'PASSED',
        duration,
        `Exit: 0, Output: "${res.stdout}", Duration: ${res.durationMs}ms`,
        res
      );
    } else {
      recordResult(
        'executeCommand(powershell)',
        'FAILED',
        duration,
        `Exit code: ${res.exitCode}, Stderr: ${res.stderr}, Stdout: ${res.stdout}`,
        res
      );
    }
  } catch (err) {
    recordResult('executeCommand(powershell)', 'FAILED', Date.now() - t3aStart, err.message);
  }

  // --- 3b. Test executeCommand(cmd, 'cmd') ---
  console.log('\n--- [3b/7] Testing executeCommand(command, "cmd") ---');
  const t3bStart = Date.now();
  try {
    const res = await executeCommand('echo CMD Core Subsystem Online', 'cmd', 10000);
    const duration = Date.now() - t3bStart;
    console.log('CMD Output:', JSON.stringify(res, null, 2));

    if (res.exitCode === 0 && res.stdout.includes('CMD Core Subsystem Online')) {
      recordResult(
        'executeCommand(cmd)',
        'PASSED',
        duration,
        `Exit: 0, Output: "${res.stdout}", Duration: ${res.durationMs}ms`,
        res
      );
    } else {
      recordResult(
        'executeCommand(cmd)',
        'FAILED',
        duration,
        `Exit code: ${res.exitCode}, Stderr: ${res.stderr}, Stdout: ${res.stdout}`,
        res
      );
    }
  } catch (err) {
    recordResult('executeCommand(cmd)', 'FAILED', Date.now() - t3bStart, err.message);
  }

  // --- 4. Test listProcesses(10, 'memory') ---
  console.log('\n--- [4/7] Testing listProcesses(10, "memory") ---');
  const t4Start = Date.now();
  try {
    const res = await listProcesses(10, 'memory');
    const duration = Date.now() - t4Start;
    console.log(`Processes listed (${res.processes?.length || 0} items):`, res.processes?.slice(0, 3));

    const validList = res && Array.isArray(res.processes) && res.processes.length > 0;
    const hasProps = validList && res.processes.every(p => p.Id !== undefined && p.ProcessName);

    if (validList && hasProps) {
      const top3 = res.processes.slice(0, 3).map(p => `${p.ProcessName}(PID:${p.Id}, ${p.MemoryMB}MB)`).join(', ');
      recordResult(
        'listProcesses(10, "memory")',
        'PASSED',
        duration,
        `Returned ${res.processes.length} processes. Top 3: ${top3}`,
        res.processes.slice(0, 5)
      );
    } else {
      recordResult(
        'listProcesses(10, "memory")',
        'FAILED',
        duration,
        `Invalid process list: ${JSON.stringify(res)}`,
        res
      );
    }
  } catch (err) {
    recordResult('listProcesses(10, "memory")', 'FAILED', Date.now() - t4Start, err.message);
  }

  // --- 5. Test getListeningPorts() ---
  console.log('\n--- [5/7] Testing getListeningPorts() ---');
  const t5Start = Date.now();
  try {
    const res = await getListeningPorts(15);
    const duration = Date.now() - t5Start;
    console.log(`Listening ports (${res.ports?.length || 0} items):`, res.ports?.slice(0, 3));

    const validPorts = res && Array.isArray(res.ports) && res.ports.length > 0;
    const hasProps = validPorts && res.ports.every(p => p.LocalPort !== undefined && p.LocalAddress !== undefined);

    if (validPorts && hasProps) {
      const sample = res.ports.slice(0, 4).map(p => `${p.LocalAddress}:${p.LocalPort} (${p.ProcessName})`).join(', ');
      recordResult(
        'getListeningPorts()',
        'PASSED',
        duration,
        `Found ${res.ports.length} listening ports. Sample: ${sample}`,
        res.ports.slice(0, 5)
      );
    } else {
      recordResult(
        'getListeningPorts()',
        'FAILED',
        duration,
        `Invalid port data returned: ${JSON.stringify(res)}`,
        res
      );
    }
  } catch (err) {
    recordResult('getListeningPorts()', 'FAILED', Date.now() - t5Start, err.message);
  }

  // --- 6. Test pingHost('127.0.0.1') ---
  console.log('\n--- [6/7] Testing pingHost("127.0.0.1") ---');
  const t6Start = Date.now();
  try {
    const res = await pingHost('127.0.0.1');
    const duration = Date.now() - t6Start;
    console.log('Ping Result:', JSON.stringify(res, null, 2));

    if (res && res.Online === true && res.PacketsReceived > 0) {
      recordResult(
        'pingHost("127.0.0.1")',
        'PASSED',
        duration,
        `Host: ${res.Host}, Latency: ${res.AvgLatencyMs}ms, Packets: ${res.PacketsReceived}/${res.PacketsSent}`,
        res
      );
    } else {
      recordResult(
        'pingHost("127.0.0.1")',
        'FAILED',
        duration,
        `Host ping unreachable or failed: ${JSON.stringify(res)}`,
        res
      );
    }
  } catch (err) {
    recordResult('pingHost("127.0.0.1")', 'FAILED', Date.now() - t6Start, err.message);
  }

  // --- 7. Test getNetworkConfig() ---
  console.log('\n--- [7/7] Testing getNetworkConfig() ---');
  const t7Start = Date.now();
  try {
    const res = await getNetworkConfig();
    const duration = Date.now() - t7Start;
    console.log('Network Config:', JSON.stringify(res, null, 2));

    const validNets = res && Array.isArray(res.interfaces) && res.interfaces.length > 0;
    if (validNets) {
      const summary = res.interfaces.map(i => `${i.InterfaceAlias} [IP: ${i.IPv4Address}, GW: ${i.IPv4Gateway}]`).join('; ');
      recordResult(
        'getNetworkConfig()',
        'PASSED',
        duration,
        `Interfaces: ${summary}`,
        res.interfaces
      );
    } else {
      recordResult(
        'getNetworkConfig()',
        'FAILED',
        duration,
        `No active interfaces with IPv4DefaultGateway: ${JSON.stringify(res)}`,
        res
      );
    }
  } catch (err) {
    recordResult('getNetworkConfig()', 'FAILED', Date.now() - t7Start, err.message);
  }

  // --- SUMMARY STATUS TABLE ---
  console.log('\n================================================================');
  console.log('                 FINAL TEST STATUS TABLE');
  console.log('================================================================');
  console.log('| # | Feature / Function | Status | Latency | Key Details |');
  console.log('|---|--------------------|--------|---------|-------------|');
  results.forEach((r, idx) => {
    const truncatedDetails = r.details.length > 60 ? r.details.slice(0, 57) + '...' : r.details;
    console.log(`| ${idx + 1} | ${r.name.padEnd(26)} | ${r.status.padEnd(6)} | ${(r.durationMs + 'ms').padEnd(7)} | ${truncatedDetails} |`);
  });
  console.log('================================================================');

  const allPassed = results.every(r => r.status === 'PASSED');
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);

  console.log(`\nResults: ${results.filter(r => r.status === 'PASSED').length}/${results.length} tests passed in ${totalDuration}ms total.`);

  if (!allPassed) {
    console.error('\n❌ Exhaustive test suite had failures!');
    process.exit(1);
  } else {
    console.log('\n✅ ALL CORE SYSTEM, HARDWARE & SHELL TESTS SUCCEEDED!');
    process.exit(0);
  }
}

runExhaustiveTest().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
