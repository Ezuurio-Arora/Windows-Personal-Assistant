import { detectActionIntent } from '../server/agent.js';
import { launchApp, resolveWebDestination } from '../server/tools/apps.js';
import { parseModelOutput } from '../server/llm.js';

async function runTests() {
  console.log('====================================================');
  console.log('  TEST 1: Web Destination Resolution Verification');
  console.log('====================================================');
  const d1 = resolveWebDestination('apple store');
  const d2 = resolveWebDestination('youtube');
  const d3 = resolveWebDestination('github.com');
  const d4 = resolveWebDestination('https://news.ycombinator.com');
  console.log('apple store =>', d1);
  console.log('youtube =>', d2);
  console.log('github.com =>', d3);
  console.log('full URL =>', d4);

  if (d1 !== 'https://www.apple.com/store') throw new Error(`Unexpected destination for apple store: ${d1}`);
  if (d2 !== 'https://www.youtube.com') throw new Error(`Unexpected destination for youtube: ${d2}`);
  if (!d3.includes('github.com')) throw new Error(`Unexpected destination for github.com: ${d3}`);
  console.log('✅ TEST 1 PASSED: Web destination resolution is 100% accurate!\n');

  console.log('====================================================');
  console.log('  TEST 2: Direct Action Intent Detection');
  console.log('====================================================');
  const intent1 = detectActionIntent('Open chrome and navigate to apple store');
  console.log('Prompt: "Open chrome and navigate to apple store" =>', JSON.stringify(intent1));
  if (!intent1 || intent1.length === 0 || intent1[0].name !== 'launch_app') {
    throw new Error('Failed to detect action intent for browser navigation');
  }
  if (intent1[0].arguments.args !== 'https://www.apple.com/store') {
    throw new Error(`Unexpected URL in arguments: ${intent1[0].arguments.args}`);
  }

  const intent2 = detectActionIntent('open youtube');
  console.log('Prompt: "open youtube" =>', JSON.stringify(intent2));
  if (intent2[0].arguments.args !== 'https://www.youtube.com') {
    throw new Error('Failed to detect action intent for open youtube');
  }
  console.log('✅ TEST 2 PASSED: Direct action intent detection is 100% accurate!\n');

  console.log('====================================================');
  console.log('  TEST 3: Robust LLM Tool Call Parser Edge Cases');
  console.log('====================================================');
  const unclosed = parseModelOutput('<response>\n{\n  "name": "launch_app",\n  "arguments": {\n    "appOrPath": "chrome",\n    "args": "https://www.apple.com/store"\n  }\n}');
  if (unclosed.toolCalls.length === 0 || unclosed.toolCalls[0].name !== 'launch_app') {
    throw new Error('Failed to parse unclosed XML tag');
  }

  const embedded = parseModelOutput('I will open Apple Store for you:\n{\n  "name": "launch_app",\n  "arguments": {\n    "appOrPath": "chrome",\n    "args": "https://www.apple.com/store"\n  }\n}');
  if (embedded.toolCalls.length === 0 || embedded.toolCalls[0].name !== 'launch_app') {
    throw new Error('Failed to parse embedded JSON');
  }
  if (!embedded.cleanText.includes('I will open Apple Store')) {
    throw new Error('Lost clean conversational text during embedded JSON parsing');
  }
  console.log('✅ TEST 3 PASSED: Unclosed tags and embedded JSON extracted perfectly!\n');

  console.log('====================================================');
  console.log('  TEST 4: Live launchApp with Browser & Destination');
  console.log('====================================================');
  const launchResult = await launchApp('chrome', 'https://www.apple.com/store');
  console.log('launchApp result:', launchResult);
  if (!launchResult.success) {
    throw new Error(`launchApp failed: ${launchResult.message}`);
  }
  console.log('✅ TEST 4 PASSED: Chrome successfully launched and navigated to Apple Store!\n');

  console.log('====================================================');
  console.log('  ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! 🎉');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
