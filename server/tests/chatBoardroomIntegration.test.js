import express from 'express';
import chatRouter from '../routes/chat.js';
import db from '../db.js';
import http from 'http';
import { randomUUID } from 'crypto';

console.log('--- Testing Chat -> Boardroom Integration ---');

// 1. Create a dummy chat session
const sessionId = randomUUID();
db.prepare('INSERT INTO chat_sessions (id, title, agent_id) VALUES (?, ?, ?)').run(sessionId, 'Test Squad Chat', 'ruxt');

// 2. Set up test express server with the chat router
const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
console.log(`Test server running on port ${port}`);

// 3. Send message asking to collaborate with Julian Vance
const postData = JSON.stringify({
  content: 'Julian Vance ekka collaborate wela modern dark mode storefront ekak hadanna'
});

const response = await new Promise((resolve, reject) => {
  const req = http.request(`http://localhost:${port}/api/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => resolve(JSON.parse(body)));
  });
  req.on('error', reject);
  req.write(postData);
  req.end();
});

console.log('Response success:', response.success);
console.log('Has Boardroom Data:', Boolean(response.boardroom));
if (response.boardroom) {
  console.log('Boardroom ID:', response.boardroom.id);
  console.log('Boardroom Topic:', response.boardroom.session?.topic);
  console.log('Boardroom Messages Count:', response.boardroom.messages?.length);
  console.log('Boardroom Tasks Count:', response.boardroom.tasks?.length);
  console.log('Boardroom Is Live:', response.boardroom.isLive);
}

if (!response.boardroom || !response.boardroom.id || !response.boardroom.messages?.length) {
  console.error('FAILED: Chat message did not convene boardroom meeting!');
  process.exit(1);
}

// Clean up test session
db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId);

server.close();
console.log('✓ Chat -> Boardroom integration successfully verified!');
process.exit(0);
