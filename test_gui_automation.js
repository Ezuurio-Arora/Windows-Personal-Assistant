/**
 * test_gui_automation.js
 * Comprehensive automated verification and latency benchmark suite for:
 * - Native OS GUI Automation Engine (server/tools/gui.js)
 * - Native Document Creation Engine (server/tools/documents.js)
 */

import path from 'path';
import fs from 'fs';
import { executeCommand } from './server/tools/shell.js';
import {
  focusWindow,
  mouseMove,
  mouseClick,
  typeText,
  sendKeyPress,
  automateGui
} from './server/tools/gui.js';
import {
  createWordDocument,
  createDocument
} from './server/tools/documents.js';

const results = [];

function recordResult(testName, success, latencyMs, details) {
  results.push({
    testName,
    status: success ? 'PASSED' : 'FAILED',
    latencyMs: Math.round(latencyMs),
    details: typeof details === 'object' ? JSON.stringify(details) : String(details || '')
  });
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('  STARTING OS AUTOMATION & DOCUMENT ENGINE TEST SUITE');
  console.log('===============================================================\n');

  // Track created files for cleanup
  const createdFiles = [];

  try {
    // -------------------------------------------------------------
    // 1. Preparation: Launch a test Notepad instance for GUI tests
    // -------------------------------------------------------------
    console.log('[Setup] Launching Notepad test harness...');
    await executeCommand('Start-Process notepad.exe', 'powershell', 5000);
    // Give OS window manager time to map window handle
    await new Promise((r) => setTimeout(r, 1500));

    // -------------------------------------------------------------
    // 2. Test Window Finding and Focusing (focusWindow)
    // -------------------------------------------------------------
    console.log('\n[Test 1] Testing Window Finding & Focusing (focusWindow)...');
    const t0 = performance.now();
    const focusRes = await focusWindow('notepad');
    const tFocus = performance.now() - t0;
    console.log(`  -> focusWindow('notepad'):`, focusRes, `(${Math.round(tFocus)}ms)`);
    recordResult('focusWindow (Notepad)', focusRes.success, tFocus, focusRes.message);

    // -------------------------------------------------------------
    // 3. Test Cursor Movement (mouseMove)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Testing Cursor Movement (mouseMove)...');
    const t1 = performance.now();
    const moveRes = await mouseMove(500, 400);
    const tMove = performance.now() - t1;
    console.log(`  -> mouseMove(500, 400):`, moveRes, `(${Math.round(tMove)}ms)`);
    recordResult('mouseMove(500, 400)', moveRes.success, tMove, moveRes.message);

    // -------------------------------------------------------------
    // 4. Test Mouse Clicking (mouseClick)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing Mouse Clicking (mouseClick)...');
    const t2 = performance.now();
    const clickRes = await mouseClick('left', 500, 400);
    const tClick = performance.now() - t2;
    console.log(`  -> mouseClick('left', 500, 400):`, clickRes, `(${Math.round(tClick)}ms)`);
    recordResult("mouseClick('left')", clickRes.success, tClick, clickRes.message);

    // -------------------------------------------------------------
    // 5. Test Fast Text Typing - Short Text & Special Characters (typeText)
    // -------------------------------------------------------------
    console.log('\n[Test 4] Testing Fast Text Typing - Keystroke mode with special chars...');
    const t3 = performance.now();
    const typeShortRes = await typeText('Hi+Test!', true);
    const tTypeShort = performance.now() - t3;
    console.log(`  -> typeText('Hi+Test!', forceKeystrokes=true):`, typeShortRes, `(${Math.round(tTypeShort)}ms)`);
    recordResult('typeText (Keystrokes)', typeShortRes.success, tTypeShort, typeShortRes.message);

    // -------------------------------------------------------------
    // 6. Test High-Speed Clipboard Injection Typing (typeText)
    // -------------------------------------------------------------
    console.log('\n[Test 5] Testing High-Speed Clipboard Injection (typeText)...');
    const multiLinePayload = 
      'Autonomous Personal Assistant Automation Suite\n' +
      'Line 1: High-speed clipboard text injection verified.\n' +
      'Line 2: Multi-line and special character handling: {test} [ok] 100% ^safe.\n';
    
    const t4 = performance.now();
    const typeFastRes = await typeText(multiLinePayload, false);
    const tTypeFast = performance.now() - t4;
    console.log(`  -> typeText(clipboard injection, ${multiLinePayload.length} chars):`, typeFastRes, `(${Math.round(tTypeFast)}ms)`);
    recordResult('typeText (High-Speed Injection)', typeFastRes.success, tTypeFast, typeFastRes.message);

    // -------------------------------------------------------------
    // 7. Test Hotkey / Key Press (sendKeyPress)
    // -------------------------------------------------------------
    console.log('\n[Test 6] Testing Hotkey / Key Press (sendKeyPress)...');
    const t5 = performance.now();
    const keyRes = await sendKeyPress('^a'); // Select All
    const tKey = performance.now() - t5;
    console.log(`  -> sendKeyPress('^a'):`, keyRes, `(${Math.round(tKey)}ms)`);
    recordResult("sendKeyPress('^a')", keyRes.success, tKey, keyRes.message);

    // -------------------------------------------------------------
    // 8. Test Composite GUI Automation Pipeline (automateGui)
    // -------------------------------------------------------------
    console.log('\n[Test 7] Testing Composite GUI Automation Pipeline (automateGui)...');
    const t6 = performance.now();
    const autoRes = await automateGui([
      { action: 'focus', target: 'notepad' },
      { action: 'move', x: 400, y: 300 },
      { action: 'click', button: 'left' },
      { action: 'wait', ms: 100 },
      { action: 'type', text: '\n[Pipeline Injection Step: Success]\n' },
      { action: 'press', key: '{ENTER}' }
    ]);
    const tAuto = performance.now() - t6;
    console.log(`  -> automateGui(6 steps composite):`, autoRes, `(${Math.round(tAuto)}ms)`);
    recordResult('automateGui (Pipeline)', autoRes.success, tAuto, autoRes.message);

    // -------------------------------------------------------------
    // 9. Test Word Document Creation with COM Automation (createWordDocument)
    // -------------------------------------------------------------
    console.log('\n[Test 8] Testing Word COM Document Engine (createWordDocument)...');
    const testDocxName = `test_verification_doc_${Date.now()}.docx`;
    const t7 = performance.now();
    const wordRes = await createWordDocument({
      title: 'Automated System Verification Report',
      content: 
        'This document was generated automatically by the Antigravity assistant.\n' +
        '## Executive Summary\n' +
        'The native automation subsystem successfully executes Win32 and COM operations.\n' +
        '### Technical Verification\n' +
        'All coordinates, focus events, and Word styles applied without exceptions.',
      bullets: [
        'Win32 user32 SetForegroundWindow verified',
        'Direct SendKeys & Clipboard Injection active',
        'Word COM Object automation active'
      ],
      filename: testDocxName,
      openInWord: false
    });
    const tWord = performance.now() - t7;
    console.log(`  -> createWordDocument:`, wordRes, `(${Math.round(tWord)}ms)`);
    
    let wordValid = wordRes.success === true && fs.existsSync(wordRes.filePath);
    if (wordValid) {
      createdFiles.push(wordRes.filePath);
      const stats = fs.statSync(wordRes.filePath);
      wordValid = stats.size > 0;
    }
    recordResult('createWordDocument (.docx)', wordValid, tWord, `Path: ${wordRes.filePath}`);

    // -------------------------------------------------------------
    // 10. Test Generic Document Creation (createDocument)
    // -------------------------------------------------------------
    console.log('\n[Test 9] Testing Generic Document Engine (createDocument)...');
    const testTxtName = `test_generic_doc_${Date.now()}.txt`;
    const t8 = performance.now();
    const docRes = await createDocument({
      type: 'txt',
      title: 'Generic Document Test',
      content: 'Antigravity Native Document Engine Output Verification\nTimestamp: ' + new Date().toISOString(),
      filename: testTxtName,
      openInApp: false
    });
    const tDoc = performance.now() - t8;
    console.log(`  -> createDocument:`, docRes, `(${Math.round(tDoc)}ms)`);

    let docValid = docRes.success === true && fs.existsSync(docRes.filePath);
    if (docValid) {
      createdFiles.push(docRes.filePath);
      const stats = fs.statSync(docRes.filePath);
      docValid = stats.size > 0;
    }
    recordResult('createDocument (.txt)', docValid, tDoc, `Path: ${docRes.filePath}`);

  } catch (err) {
    console.error('Fatal unexpected error during test suite execution:', err);
  } finally {
    // -------------------------------------------------------------
    // Cleanup: Terminate Notepad test instance and delete test files
    // -------------------------------------------------------------
    console.log('\n[Cleanup] Terminating Notepad test process...');
    await executeCommand('Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue', 'powershell', 5000);

    console.log('[Cleanup] Removing temporary test documents...');
    for (const f of createdFiles) {
      try {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
          console.log(`  Removed test artifact: ${f}`);
        }
      } catch (e) {
        console.warn(`  Could not remove ${f}: ${e.message}`);
      }
    }
  }

  // -------------------------------------------------------------
  // Display Final Benchmark Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log('                 TEST RESULTS & BENCHMARK SUMMARY              ');
  console.log('===============================================================');
  console.table(results.map(r => ({
    'Test Scenario': r.testName,
    'Status': r.status,
    'Latency (ms)': r.latencyMs,
    'Details': r.details.length > 50 ? r.details.substring(0, 47) + '...' : r.details
  })));

  const allPassed = results.every(r => r.status === 'PASSED');
  const totalDuration = results.reduce((acc, r) => acc + r.latencyMs, 0);
  console.log(`Total Operations Tested: ${results.length}`);
  console.log(`All Passed: ${allPassed ? 'YES (100% Success)' : 'NO'}`);
  console.log(`Combined Latency: ${totalDuration}ms`);
  console.log('===============================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runTestSuite();
