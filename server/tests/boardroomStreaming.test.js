import express from 'express';
import boardroomRouter from '../routes/boardroom.js';
import { conductBoardroomMeeting } from '../services/orchestrator.js';
import http from 'http';

console.log('--- Testing Boardroom SSE Streaming Endpoint ---');

// 1. Conduct a meeting to have data
const result = await conductBoardroomMeeting({
  topic: 'Test Live Stream Deliberation Platform'
});
const boardroomId = result.boardroomSession.id;
console.log('Created Boardroom Session:', boardroomId);

// 2. Set up test express server with the boardroom router
const app = express();
app.use(express.json());
app.use('/api/boardroom', boardroomRouter);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;
console.log(`Test server running on port ${port}`);

// 3. Connect to SSE stream with speed=instant
const eventsReceived = [];
await new Promise((resolve, reject) => {
  const req = http.get(`http://localhost:${port}/api/boardroom/stream/${boardroomId}?speed=instant`, (res) => {
    let raw = '';
    res.on('data', (chunk) => {
      raw += chunk.toString();
    });
    res.on('end', () => {
      const lines = raw.split('\n\n').filter(Boolean);
      for (const block of lines) {
        const eventMatch = block.match(/^event: (.*)$/m);
        const dataMatch = block.match(/^data: (.*)$/m);
        if (eventMatch && dataMatch) {
          eventsReceived.push({
            event: eventMatch[1],
            data: JSON.parse(dataMatch[1])
          });
        }
      }
      resolve();
    });
  });
  req.on('error', reject);
});

console.log(`Received ${eventsReceived.length} SSE events:`);
eventsReceived.forEach((ev, idx) => {
  if (ev.event === 'message') {
    console.log(` [${idx}] ${ev.event}: ${ev.data.agent_name} [${ev.data.phase}]`);
  } else {
    console.log(` [${idx}] ${ev.event}`);
  }
});

// Verify critical events
const hasSession = eventsReceived.some(e => e.event === 'session');
const hasMessages = eventsReceived.filter(e => e.event === 'message').length >= 3;
const hasConsensus = eventsReceived.some(e => e.event === 'consensus');
const hasTasks = eventsReceived.some(e => e.event === 'tasks');
const hasDone = eventsReceived.some(e => e.event === 'done');

if (!hasSession || !hasMessages || !hasConsensus || !hasTasks || !hasDone) {
  console.error('FAILED: Missing required SSE events!');
  process.exit(1);
}

console.log('✓ All required SSE events (session, messages, consensus, tasks, done) received properly!');
server.close();
console.log('--- Boardroom SSE Streaming Test Passed! ---');
process.exit(0);
