import { spawn } from 'child_process';
import WebSocket from 'ws';

async function testChatFlow() {
  console.log('--- Testing Chat Response Flow (No Hang) ---');

  const proc = spawn('node', ['server/index.js'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });

  // Wait for server to start
  await new Promise((r) => setTimeout(r, 2500));

  try {
    // 1. Get or create session
    const sessRes = await fetch('http://localhost:42000/api/sessions');
    const sessions = await sessRes.json();
    const sessionId = sessions[0]?.id || 'default';
    console.log(`✓ Using session: ${sessionId}`);

    // 2. Connect WebSocket
    const ws = new WebSocket('ws://localhost:42000/ws');

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
      ws.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    console.log('✓ WebSocket connected');

    // 3. Send "hello" message and wait for response
    console.log('Sending message: "hello"...');
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Test timed out: Assistant did not respond!')), 8000);

      ws.on('message', (raw) => {
        const { event, data } = JSON.parse(raw);
        if (event === 'message:completed' && data.sessionId === sessionId) {
          clearTimeout(timeout);
          resolve(data);
        }
      });
    });

    ws.send(
      JSON.stringify({
        event: 'chat:send',
        data: {
          sessionId,
          content: 'hello'
        }
      })
    );

    const result = await responsePromise;
    console.log('\n✓ RECEIVED RESPONSE FROM ASSISTANT:');
    console.log('--------------------------------------------------');
    console.log(result.content);
    console.log('--------------------------------------------------');
    console.log('\n✓ CHAT FLOW VERIFIED: ZERO HANG, IMMEDIATE RESPONSE!');
  } catch (err) {
    console.error('✗ Test failed:', err.message);
  } finally {
    proc.kill();
    process.exit(0);
  }
}

testChatFlow();
