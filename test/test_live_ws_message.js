import { WebSocket } from 'ws';

async function testWs() {
  const ws = new WebSocket('ws://127.0.0.1:42000');

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  console.log('Connected to WebSocket server on ws://127.0.0.1:42000');

  const testSessionId = `sess_test_${Date.now()}`;

  // Register new session first
  const createRes = await fetch('http://127.0.0.1:42000/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: testSessionId, title: 'Apple Store Test' })
  });
  const createdData = await createRes.json();
  console.log('Created test session:', createdData.id);

  let finalCompletedMsg = null;
  const recordedSteps = [];

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.event === 'agent:progress') {
        console.log(`[Progress ${msg.data.percent}%] ${msg.data.label}`);
      } else if (msg.event === 'step:completed') {
        console.log(`[Step Completed] Tool: ${msg.data.step.tool}, Status: ${msg.data.step.status}`);
        recordedSteps.push(msg.data.step);
      } else if (msg.event === 'message:completed') {
        console.log('\n[Message Completed Event Received!]');
        finalCompletedMsg = msg.data;
      }
    } catch (e) {
      console.error('Error parsing WS message:', e);
    }
  });

  console.log('\nSending: "Open chrome and navigate to apple store"...\n');
  ws.send(JSON.stringify({
    event: 'chat:send',
    data: {
      sessionId: createdData.id,
      content: 'Open chrome and navigate to apple store'
    }
  }));

  // Wait up to 30s for message:completed
  const startTime = Date.now();
  while (!finalCompletedMsg && Date.now() - startTime < 35000) {
    await new Promise((r) => setTimeout(r, 500));
  }

  ws.close();

  if (!finalCompletedMsg) {
    throw new Error('Timed out waiting for message:completed');
  }

  console.log('\n================ FINAL RESULT ================');
  console.log('Content:', finalCompletedMsg.content);
  console.log('Steps recorded:', recordedSteps.length);
  console.log('==============================================');

  if (finalCompletedMsg.content.includes('empty response from the model')) {
    throw new Error('FAILED: Assistant still returned "empty response from the model"');
  }

  if (recordedSteps.length === 0) {
    throw new Error('FAILED: No steps were recorded');
  }

  console.log('\n🎉 SUCCESS: Browser navigation executed, recorded, and summarized without empty response!');
}

testWs().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
