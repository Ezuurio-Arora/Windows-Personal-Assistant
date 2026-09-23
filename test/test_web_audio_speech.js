import { searchWeb, fetchWebContent } from '../server/tools/web.js';
import { setClipboard, getClipboard } from '../server/tools/clipboard.js';
import { setVolume } from '../server/tools/system.js';
import { showNotification, speakText } from '../server/tools/notifications.js';

async function runExhaustiveTests() {
  console.log('================================================================================');
  console.log('   STARTING EXHAUSTIVE TEST SUITE: WEB, AUDIO, CLIPBOARD & NOTIFICATIONS');
  console.log('================================================================================\n');

  const testResults = [];

  // Helper for tracking tests
  async function runStep(id, name, testFn) {
    const start = Date.now();
    console.log(`[TEST ${id}] ${name}...`);
    try {
      const details = await testFn();
      const duration = Date.now() - start;
      console.log(`  -> PASS (${duration}ms)`);
      testResults.push({ id, name, status: 'PASS', duration: `${duration}ms`, details });
      return true;
    } catch (err) {
      const duration = Date.now() - start;
      console.error(`  -> FAIL (${duration}ms):`, err.message);
      testResults.push({ id, name, status: 'FAIL', duration: `${duration}ms`, details: err.message });
      return false;
    }
  }

  // 1. Test searchWeb('Google Gemini AI news', 3)
  await runStep(1, "searchWeb('Google Gemini AI news', 3)", async () => {
    const res = await searchWeb('Google Gemini AI news', 3);
    console.log(`     Response query: "${res.query}", totalResults: ${res.totalResults}`);
    if (res.error) {
      throw new Error(`searchWeb returned error: ${res.error}`);
    }
    if (!res.results || res.results.length === 0) {
      throw new Error('searchWeb returned empty results');
    }
    for (let i = 0; i < res.results.length; i++) {
      console.log(`     [Result ${i + 1}] ${res.results[i].title} - ${res.results[i].url}`);
    }
    return `Found ${res.results.length} result(s). First: "${res.results[0].title.slice(0, 40)}..."`;
  });

  // 2. Test fetchWebContent('https://example.com')
  await runStep(2, "fetchWebContent('https://example.com')", async () => {
    const res = await fetchWebContent('https://example.com');
    if (res.error) {
      throw new Error(`fetchWebContent returned error: ${res.error}`);
    }
    if (!res.content || res.characterCount === 0) {
      throw new Error('fetchWebContent returned empty content');
    }
    console.log(`     Fetched ${res.characterCount} chars from ${res.url}`);
    console.log(`     Preview: "${res.content.slice(0, 100).replace(/\s+/g, ' ')}..."`);
    return `Fetched ${res.characterCount} chars, content includes "Example Domain": ${res.content.includes('Example Domain')}`;
  });

  // 3. Test setClipboard and getClipboard roundtrip
  await runStep(3, "Clipboard Roundtrip: setClipboard & getClipboard", async () => {
    const testText = 'Personal Assistant Clipboard Verification';
    const setRes = await setClipboard(testText);
    if (!setRes.success) {
      throw new Error(`setClipboard failed: ${setRes.message}`);
    }
    console.log(`     setClipboard succeeded: ${setRes.message}`);

    const getRes = await getClipboard();
    console.log(`     getClipboard returned: "${getRes.content}" (length: ${getRes.length})`);
    if (getRes.content.trim() !== testText) {
      throw new Error(`Clipboard roundtrip mismatch! Expected "${testText}", got "${getRes.content}"`);
    }
    return `Roundtrip verified: "${getRes.content.trim()}" (fidelity 100%)`;
  });

  // 4a. Test setVolume(50)
  await runStep('4a', "setVolume(50)", async () => {
    const res = await setVolume(50);
    if (!res.success) {
      throw new Error(`setVolume(50) failed: ${res.message}`);
    }
    console.log(`     setVolume(50) response: ${res.message}`);
    return res.message.trim();
  });

  // 4b. Test setVolume('unmute')
  await runStep('4b', "setVolume('unmute')", async () => {
    const res = await setVolume('unmute');
    if (!res.success) {
      throw new Error(`setVolume('unmute') failed: ${res.message}`);
    }
    console.log(`     setVolume('unmute') response: ${res.message}`);
    return res.message.trim();
  });

  // 5. Test showNotification('Test Notification', 'Testing notification system')
  await runStep(5, "showNotification('Test Notification', 'Testing notification system')", async () => {
    const res = await showNotification('Test Notification', 'Testing notification system');
    if (!res.success) {
      throw new Error(`showNotification failed: ${res.message}`);
    }
    console.log(`     showNotification response: ${res.message}`);
    return res.message.trim();
  });

  // 6. Test speakText('System audio test complete', 1)
  await runStep(6, "speakText('System audio test complete', 1)", async () => {
    const res = await speakText('System audio test complete', 1);
    if (!res.success) {
      throw new Error(`speakText failed: ${res.message}`);
    }
    console.log(`     speakText response: ${res.message}`);
    return res.message.trim();
  });

  // Print final summary table
  console.log('\n================================================================================');
  console.log('                          TEST EXECUTION RESULTS TABLE');
  console.log('================================================================================');
  console.table(testResults.map(r => ({
    'Test #': r.id,
    'Target Feature': r.name,
    'Status': r.status,
    'Duration': r.duration,
    'Details': r.details
  })));

  const allPassed = testResults.every(r => r.status === 'PASS');
  if (allPassed) {
    console.log('\n>>> ALL 6 FEATURES & ROUNDTRIPS TESTED AND PASSED WITH 100% SUCCESS <<<\n');
    process.exit(0);
  } else {
    console.error('\n>>> SOME TESTS FAILED. PLEASE INSPECT LOGS ABOVE <<<\n');
    process.exit(1);
  }
}

runExhaustiveTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
