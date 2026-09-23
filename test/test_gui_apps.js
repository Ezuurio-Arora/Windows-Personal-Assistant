/**
 * test/test_gui_apps.js
 * Standalone verification test for GUI, Cursor, Keyboard, and Third-Party App features.
 */

import { performance } from 'perf_hooks';
import { launchApp, killProcess } from '../server/tools/apps.js';
import {
  focusWindow,
  mouseMove,
  mouseClick,
  typeText,
  sendKeyPress,
  automateGui
} from '../server/tools/gui.js';
import { getActiveWindow } from '../server/tools/system.js';

const results = [];

function recordResult(stepNumber, feature, success, durationMs, details) {
  results.push({
    step: stepNumber,
    feature,
    status: success ? 'PASSED' : 'FAILED',
    durationMs: Math.round(durationMs),
    details: typeof details === 'object' ? JSON.stringify(details) : String(details || '')
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGuiAppsTestSuite() {
  console.log('======================================================================');
  console.log('  STARTING GUI, CURSOR, KEYBOARD & THIRD-PARTY APPS TEST SUITE');
  console.log('======================================================================\n');

  try {
    // -----------------------------------------------------------------
    // Step 1: launchApp('notepad')
    // -----------------------------------------------------------------
    console.log('[Step 1] Testing launchApp(\'notepad\')...');
    const tStart1 = performance.now();
    const launchRes = await launchApp('notepad');
    const tLaunch = performance.now() - tStart1;
    console.log('  Result:', launchRes, `(${Math.round(tLaunch)}ms)`);
    const launchSuccess = launchRes.success === true;
    recordResult(1, "launchApp('notepad')", launchSuccess, tLaunch, launchRes.message);

    // Wait for the window manager to initialize and map the Notepad window
    await sleep(1500);

    // -----------------------------------------------------------------
    // Step 2: focusWindow('notepad')
    // -----------------------------------------------------------------
    console.log('\n[Step 2] Testing focusWindow(\'notepad\')...');
    const tStart2 = performance.now();
    const focusRes = await focusWindow('notepad');
    const tFocus = performance.now() - tStart2;
    console.log('  Result:', focusRes, `(${Math.round(tFocus)}ms)`);
    const focusSuccess = focusRes.success === true;
    recordResult(2, "focusWindow('notepad')", focusSuccess, tFocus, focusRes.message);

    // Short stabilization delay
    await sleep(300);

    // -----------------------------------------------------------------
    // Step 3: mouseMove(400, 300) and mouseClick('left')
    // -----------------------------------------------------------------
    console.log('\n[Step 3] Testing mouseMove(400, 300) and mouseClick(\'left\')...');
    const tStart3a = performance.now();
    const moveRes = await mouseMove(400, 300);
    const tMove = performance.now() - tStart3a;
    console.log('  mouseMove Result:', moveRes, `(${Math.round(tMove)}ms)`);

    const tStart3b = performance.now();
    const clickRes = await mouseClick('left');
    const tClick = performance.now() - tStart3b;
    console.log('  mouseClick Result:', clickRes, `(${Math.round(tClick)}ms)`);

    const mouseSuccess = moveRes.success === true && clickRes.success === true;
    recordResult(
      3,
      "mouseMove(400, 300) & mouseClick('left')",
      mouseSuccess,
      tMove + tClick,
      `Move: ${moveRes.message} | Click: ${clickRes.message}`
    );

    // -----------------------------------------------------------------
    // Step 4: typeText('Hello Automated World', false)
    // -----------------------------------------------------------------
    console.log('\n[Step 4] Testing typeText(\'Hello Automated World\', false)...');
    const tStart4 = performance.now();
    const typeRes = await typeText('Hello Automated World', false);
    const tType = performance.now() - tStart4;
    console.log('  Result:', typeRes, `(${Math.round(tType)}ms)`);
    const typeSuccess = typeRes.success === true;
    recordResult(4, "typeText('Hello Automated World', false)", typeSuccess, tType, typeRes.message);

    await sleep(300);

    // -----------------------------------------------------------------
    // Step 5: sendKeyPress('^a')
    // -----------------------------------------------------------------
    console.log('\n[Step 5] Testing sendKeyPress(\'^a\')...');
    const tStart5 = performance.now();
    const keyRes = await sendKeyPress('^a');
    const tKey = performance.now() - tStart5;
    console.log('  Result:', keyRes, `(${Math.round(tKey)}ms)`);
    const keySuccess = keyRes.success === true;
    recordResult(5, "sendKeyPress('^a')", keySuccess, tKey, keyRes.message);

    await sleep(300);

    // -----------------------------------------------------------------
    // Step 6: getActiveWindow()
    // -----------------------------------------------------------------
    console.log('\n[Step 6] Testing getActiveWindow()...');
    const tStart6 = performance.now();
    const activeWinRes = await getActiveWindow();
    const tActiveWin = performance.now() - tStart6;
    console.log('  Result:', activeWinRes, `(${Math.round(tActiveWin)}ms)`);
    const activeWinSuccess = !activeWinRes.error && (Boolean(activeWinRes.ProcessName) || Boolean(activeWinRes.WindowTitle) || activeWinRes.ProcessId !== undefined);
    recordResult(
      6,
      'getActiveWindow()',
      activeWinSuccess,
      tActiveWin,
      `Process: ${activeWinRes.ProcessName || 'N/A'}, Title: "${activeWinRes.WindowTitle || ''}", PID: ${activeWinRes.ProcessId || 'N/A'}`
    );

    await sleep(300);

    // -----------------------------------------------------------------
    // Step 7: automateGui([...]) 4-step composite action
    // -----------------------------------------------------------------
    console.log('\n[Step 7] Testing automateGui([...]) with 4-step composite action...');
    const compositeSteps = [
      { action: 'focus', target: 'notepad' },
      { action: 'move', x: 450, y: 350 },
      { action: 'type', text: '\nAutomated 4-Step Composite Action Verified!' },
      { action: 'press', key: '{ENTER}' }
    ];
    const tStart7 = performance.now();
    const autoRes = await automateGui(compositeSteps);
    const tAuto = performance.now() - tStart7;
    console.log('  Result:', autoRes, `(${Math.round(tAuto)}ms)`);
    const autoSuccess = autoRes.success === true && autoRes.stepsExecuted === 4;
    recordResult(
      7,
      'automateGui([...]) [4-Step Composite]',
      autoSuccess,
      tAuto,
      `Executed: ${autoRes.stepsExecuted} steps - ${autoRes.message}`
    );

    await sleep(500);

  } catch (err) {
    console.error('Unexpected error encountered during test execution:', err);
  } finally {
    // -----------------------------------------------------------------
    // Step 8: killProcess('notepad')
    // -----------------------------------------------------------------
    console.log('\n[Step 8] Testing killProcess(\'notepad\')...');
    const tStart8 = performance.now();
    const killRes = await killProcess('notepad');
    const tKill = performance.now() - tStart8;
    console.log('  Result:', killRes, `(${Math.round(tKill)}ms)`);
    const killSuccess = killRes.success === true;
    recordResult(8, "killProcess('notepad')", killSuccess, tKill, killRes.message);
  }

  // -----------------------------------------------------------------
  // Benchmark and Status Summary Table
  // -----------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('               STATUS REPORT & EXECUTION TIME SUMMARY                  ');
  console.log('======================================================================');
  console.table(
    results.map((r) => ({
      Step: r.step,
      Feature: r.feature,
      Status: r.status,
      'Time (ms)': r.durationMs,
      Details: r.details.length > 55 ? r.details.slice(0, 52) + '...' : r.details
    }))
  );

  const totalTime = results.reduce((sum, r) => sum + r.durationMs, 0);
  const allPassed = results.length === 8 && results.every((r) => r.status === 'PASSED');

  console.log(`Total Operations Tested: ${results.length}/8`);
  console.log(`Overall Status: ${allPassed ? 'ALL PASSED (100% SUCCESS)' : 'FAILED'}`);
  console.log(`Total Direct Execution Latency: ${totalTime}ms`);
  console.log('======================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runGuiAppsTestSuite();
