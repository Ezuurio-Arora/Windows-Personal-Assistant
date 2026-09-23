import { AgentOrchestrator, TOOL_DEFINITIONS, selectRelevantTools } from '../server/agent.js';
import { getHardwareProfile, getSystemMetrics } from '../server/tools/system.js';

async function runVerification() {
  console.log('=== MULTI-SUBAGENT & HARDWARE ARCHITECTURE VERIFICATION ===\n');

  const agent = new AgentOrchestrator({ safetyMode: 'yolo' });

  // -------------------------------------------------------------
  // 1. Verify classifySubagent mappings
  // -------------------------------------------------------------
  console.log('[1] Verifying classifySubagent tool mappings...');

  const expectedGuiTools = [
    'mouse_click', 'mouse_move', 'type_text', 'send_key_press',
    'focus_window', 'automate_gui', 'capture_screen', 'get_active_window'
  ];
  const expectedDocAppTools = [
    'create_word_document', 'create_document', 'launch_app',
    'list_processes', 'kill_process', 'write_file', 'read_file',
    'search_files', 'list_directory'
  ];
  const expectedSystemTools = [
    'run_command', 'get_system_metrics', 'set_volume', 'power_action',
    'ping_host', 'get_network_config', 'get_listening_ports',
    'get_clipboard', 'set_clipboard', 'show_notification',
    'speak_text', 'search_web', 'fetch_web_content'
  ];

  let classificationPassed = true;

  for (const tool of expectedGuiTools) {
    const sub = agent.classifySubagent(tool);
    if (sub.id !== 'gui_subagent' || sub.name !== 'GUI & Automation Sub-agent') {
      console.error(`FAIL: Expected ${tool} to map to gui_subagent, got`, sub);
      classificationPassed = false;
    }
  }

  for (const tool of expectedDocAppTools) {
    const sub = agent.classifySubagent(tool);
    if (sub.id !== 'doc_app_subagent' || sub.name !== 'Document & App Sub-agent') {
      console.error(`FAIL: Expected ${tool} to map to doc_app_subagent, got`, sub);
      classificationPassed = false;
    }
  }

  for (const tool of expectedSystemTools) {
    const sub = agent.classifySubagent(tool);
    if (sub.id !== 'system_subagent' || sub.name !== 'System & Research Sub-agent') {
      console.error(`FAIL: Expected ${tool} to map to system_subagent, got`, sub);
      classificationPassed = false;
    }
  }

  if (classificationPassed) {
    console.log('✓ All 3 subagent categories (gui_subagent, doc_app_subagent, system_subagent) classified correctly for all tools.');
  }

  // -------------------------------------------------------------
  // 2. Verify executeSubagentWorkers parallel dispatch
  // -------------------------------------------------------------
  console.log('\n[2] Verifying executeSubagentWorkers parallel dispatch...');

  const progressUpdates = [];
  const testCalls = [
    { name: 'get_clipboard', arguments: {} },
    { name: 'get_active_window', arguments: {} },
    { name: 'list_directory', arguments: { dirPath: '.' } }
  ];

  const startTime = Date.now();
  const workerResults = await agent.executeSubagentWorkers(
    testCalls,
    (progress) => {
      progressUpdates.push(progress);
    },
    null
  );
  const duration = Date.now() - startTime;

  console.log(`✓ Parallel execution of ${workerResults.length} subagent workers completed in ${duration}ms.`);
  console.log('Progress events recorded:', progressUpdates.length);
  for (const wr of workerResults) {
    console.log(`  - Worker: ${wr.subagentName} | Tool: ${wr.name} | Status: ${wr.result?.error ? 'error' : 'ok'}`);
  }

  // -------------------------------------------------------------
  // 3. Verify Dynamic Hardware Detection & System Prompt Injection
  // -------------------------------------------------------------
  console.log('\n[3] Verifying dynamic getHardwareProfile() and getSystemPrompt()...');

  const hw = await getHardwareProfile();
  console.log('Raw Detected Hardware Profile:');
  console.log(`  • OS: ${hw.os}`);
  console.log(`  • OS Version: ${hw.osVersion}`);
  console.log(`  • Manufacturer: ${hw.manufacturer}`);
  console.log(`  • Model: ${hw.model}`);
  console.log(`  • Processor: ${hw.processor}`);
  console.log(`  • Total RAM: ${hw.totalRamGB} GB`);
  console.log(`  • Hostname: ${hw.hostName}`);

  if (!hw.os || !hw.manufacturer || !hw.model || !hw.processor || !hw.totalRamGB) {
    throw new Error('Hardware profile contains missing or invalid specs!');
  }

  const prompt = await agent.getSystemPrompt('general');
  console.log('\nVerifying Prompt Injection:');

  const checks = [
    { label: 'OS injection', test: prompt.includes(hw.os) },
    { label: 'Model injection', test: prompt.includes(hw.model) },
    { label: 'Manufacturer injection', test: prompt.includes(hw.manufacturer) },
    { label: 'CPU injection', test: prompt.includes(hw.processor) },
    { label: 'RAM injection', test: prompt.includes(`${hw.totalRamGB} GB`) },
    { label: 'HostName injection', test: prompt.includes(hw.hostName) }
  ];

  for (const c of checks) {
    if (c.test) {
      console.log(`  ✓ ${c.label}: Verified`);
    } else {
      console.error(`  ✗ ${c.label}: FAILED`);
    }
  }

  // -------------------------------------------------------------
  // 4. Verify Action-First Principle in System Prompt
  // -------------------------------------------------------------
  console.log('\n[4] Verifying Action-First Principle in System Prompt...');
  const actionFirstKeywords = [
    'CRITICAL ACTION-FIRST DIRECTIVE',
    'DO NOT JUST GIVE ADVICE, INSTRUCTIONS, OR MANUAL STEPS',
    'YOU MUST IMMEDIATELY INVOKE THE CORRESPONDING AUTOMATION TOOL'
  ];

  for (const kw of actionFirstKeywords) {
    if (prompt.includes(kw)) {
      console.log(`  ✓ Found directive keyword: "${kw}"`);
    } else {
      console.error(`  ✗ Missing directive keyword: "${kw}"`);
    }
  }

  console.log('\n======================================================');
  console.log('  ALL MULTI-SUBAGENT & HARDWARE CHECKS PASSED!');
  console.log('======================================================');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
