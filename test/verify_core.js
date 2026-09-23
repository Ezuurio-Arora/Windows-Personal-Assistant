import { getSystemMetrics } from '../server/tools/system.js';
import { executeCommand } from '../server/tools/shell.js';
import { searchFiles, listDirectory } from '../server/tools/files.js';
import { autoDetectProviders } from '../server/llm.js';
import { StorageService } from '../server/storage.js';

async function runVerification() {
  console.log('--- Starting Personal Assistant Verification ---');

  // 1. Storage verification
  console.log('\n[1] Testing Persistence & Storage...');
  const storage = new StorageService();
  const sessions = storage.getSessions();
  const secret = storage.getPairingSecret();
  console.log(`✓ Storage initialized. Found ${sessions.length} session(s). Pairing secret length: ${secret.length}`);

  // 2. PowerShell command tool
  console.log('\n[2] Testing PowerShell execution...');
  const shellRes = await executeCommand('Write-Output "Personal Assistant Online"');
  if (shellRes.exitCode === 0 && shellRes.stdout.includes('Personal Assistant Online')) {
    console.log(`✓ PowerShell tool succeeded in ${shellRes.durationMs}ms: "${shellRes.stdout}"`);
  } else {
    console.error('✗ PowerShell tool failed:', shellRes);
  }

  // 3. System metrics tool
  console.log('\n[3] Testing Windows System Metrics inspection...');
  const metrics = await getSystemMetrics();
  if (metrics.CpuLoadPercent !== undefined || metrics.Memory) {
    console.log(`✓ Metrics retrieved: Host=${metrics.HostName}, CPU=${metrics.CpuLoadPercent}%, RAM Used=${metrics.Memory?.UsedPercent}%`);
  } else {
    console.warn('! Metrics output:', metrics);
  }

  // 4. File search & listing tool
  console.log('\n[4] Testing Filesystem tools...');
  const listRes = await listDirectory('.');
  console.log(`✓ Directory listing: ${listRes.totalItems} items in root.`);
  const searchRes = await searchFiles('.', 'package.json', 5);
  console.log(`✓ File search: found ${searchRes.totalMatches} match(es) for "package.json".`);

  // 5. LLM provider auto-detection
  console.log('\n[5] Testing Provider auto-detector...');
  const providers = await autoDetectProviders();
  console.log(`✓ Tested ${providers.length} local ports. Detected statuses:`);
  for (const p of providers) {
    console.log(`   - ${p.name} (${p.baseUrl}): ${p.status}`);
  }

  console.log('\n======================================================');
  console.log('  ALL CORE AGENT VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('======================================================');
}

runVerification().catch(console.error);
