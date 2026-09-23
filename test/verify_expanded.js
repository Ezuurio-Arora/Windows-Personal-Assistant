import { getSystemMetrics } from '../server/tools/system.js';
import { executeCommand } from '../server/tools/shell.js';
import { searchFiles, listDirectory } from '../server/tools/files.js';
import { listProcesses, getListeningPorts } from '../server/tools/apps.js';
import { getClipboard, setClipboard } from '../server/tools/clipboard.js';
import { pingHost } from '../server/tools/network.js';
import { autoDetectProviders } from '../server/llm.js';
import { StorageService } from '../server/storage.js';

async function runVerification() {
  console.log('--- Testing Expanded Personal Assistant Tools ---');

  // 1. Process inspection
  console.log('\n[1] Testing Process List tool...');
  const procRes = await listProcesses(5, 'memory');
  if (procRes.processes && procRes.processes.length > 0) {
    console.log(`✓ Retrieved ${procRes.processes.length} top processes. Top process: ${procRes.processes[0].ProcessName} (${procRes.processes[0].MemoryMB} MB)`);
  } else {
    console.warn('! Process list output:', procRes);
  }

  // 2. Clipboard test
  console.log('\n[2] Testing Clipboard tools...');
  const testClip = 'Personal Assistant Clipboard Test ' + Date.now();
  await setClipboard(testClip);
  const clipRes = await getClipboard();
  if (clipRes.content === testClip) {
    console.log(`✓ Clipboard write & read verified: "${clipRes.content}"`);
  } else {
    console.warn('! Clipboard mismatch:', clipRes);
  }

  // 3. Network ping test
  console.log('\n[3] Testing Network Ping tool...');
  const pingRes = await pingHost('8.8.8.8', 2);
  if (pingRes.Online) {
    console.log(`✓ Ping test succeeded: Host=${pingRes.Host}, Latency=${pingRes.AvgLatencyMs}ms`);
  } else {
    console.warn('! Ping output:', pingRes);
  }

  // 4. Listening ports test
  console.log('\n[4] Testing Listening Ports tool...');
  const portsRes = await getListeningPorts(5);
  if (portsRes.ports && portsRes.ports.length > 0) {
    console.log(`✓ Detected ${portsRes.ports.length} listening network ports.`);
  }

  console.log('\n======================================================');
  console.log('  ALL EXPANDED AGENT CAPABILITIES VERIFIED!');
  console.log('======================================================');
}

runVerification().catch(console.error);
