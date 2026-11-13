import { conductBoardroomMeeting } from '../services/orchestrator.js';

console.log('--- Testing Boardroom Orchestration ---');

const result = await conductBoardroomMeeting({
  topic: 'Build fullstack SaaS platform with high throughput API, PostgreSQL, and Google Search Console analytics'
});

console.log('Session ID:', result.boardroomSession.id);
console.log('Consensus:', result.decision);
console.log('Dialogue message count:', result.messages.length);
console.log('Speakers:', result.messages.map(m => `${m.agent_name} (${m.agent_role}) [${m.phase}]`));
console.log('Generated Tasks count:', result.tasks.length);
console.log('Tasks assigned to:', result.tasks.map(t => `${t.title} -> ${t.agent_id}`));

console.log('--- Boardroom test passed! ---');
process.exit(0);
