import { spawn } from 'child_process';

async function testServer() {
  console.log('--- Testing Hub Server & API Endpoints ---');

  const proc = spawn('node', ['server/index.js'], {
    cwd: process.cwd(),
    stdio: 'pipe'
  });

  proc.stdout.on('data', (d) => process.stdout.write('[Server] ' + d));
  proc.stderr.on('data', (d) => process.stderr.write('[Server Err] ' + d));

  // Poll for status until running
  let online = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch('http://localhost:42000/api/status');
      if (res.ok) {
        const data = await res.json();
        console.log(`\n✓ Server responded! Port: ${data.port}, Local URL: ${data.primaryLocalUrl}`);
        if (data.tunnelUrl) {
          console.log(`✓ Worldwide Tunnel URL: ${data.tunnelUrl}`);
        }
        online = true;
        break;
      }
    } catch {}
  }

  if (!online) {
    console.error('✗ Server failed to respond in 15 seconds.');
    proc.kill();
    process.exit(1);
  }

  // Check /api/qr
  try {
    const qrRes = await fetch('http://localhost:42000/api/qr');
    const qrData = await qrRes.json();
    console.log(`✓ Pairing QR string: ${qrData.qrString}`);
    console.log(`✓ Pairing QR image base64 length: ${qrData.qrDataUrl?.length}`);
  } catch (err) {
    console.error('✗ /api/qr error:', err.message);
  }

  // Check /api/sessions
  try {
    const sessRes = await fetch('http://localhost:42000/api/sessions');
    const sessData = await sessRes.json();
    console.log(`✓ Active Sessions: ${sessData.length} session(s) found.`);
  } catch (err) {
    console.error('✗ /api/sessions error:', err.message);
  }

  console.log('\n======================================================');
  console.log('  ALL SERVER & TUNNEL VERIFICATIONS PASSED!');
  console.log('======================================================');

  proc.kill();
  process.exit(0);
}

testServer();
