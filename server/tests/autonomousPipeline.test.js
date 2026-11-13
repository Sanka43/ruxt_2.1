import db from '../db.js';
import {
  discoverActiveAgents,
  resolveStageAgent,
  conductBoardroomMeeting,
  runAutonomousPipeline
} from '../services/orchestrator.js';

console.log('=== RuXt Multi-Stage Autonomous Pipeline Test ===\n');

// 1. Test Dynamic Agent Discovery
const activeAgents = discoverActiveAgents();
console.log(`[PASS 1] Discovered ${activeAgents.length} active agents.`);
console.log('Registered Slugs:', activeAgents.map(a => a.slug).join(', '));

// 2. Test Dynamic Discovery of a Brand New Agent
const testAgentSlug = 'cipher-web3-bot';
try {
  db.prepare(`
    INSERT OR REPLACE INTO agents (id, name, slug, role, description, version, manifest)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'test-cipher-id-999',
    'Cipher Web3',
    testAgentSlug,
    'Decentralized Smart Contract Engineer',
    'Specialist in Solidity, Web3 wallets, Ethereum contracts, and DeFi protocols.',
    '1.0.0',
    JSON.stringify({
      skills: ['Solidity', 'Smart Contracts', 'Web3', 'Ethereum', 'DeFi'],
      tags: ['Crypto', 'Blockchain', 'Tokens']
    })
  );

  const matchedNewAgent = resolveStageAgent('deploy ethereum smart contracts and connect metamask web3 wallet');
  console.log(`\n[PASS 2] New Agent Resolution: "${matchedNewAgent.name}" (${matchedNewAgent.slug})`);
  if (matchedNewAgent.slug !== testAgentSlug) {
    throw new Error(`Expected new agent ${testAgentSlug}, but got ${matchedNewAgent.slug}`);
  }
} finally {
  // Clean up mock agent
  db.prepare('DELETE FROM agents WHERE slug = ?').run(testAgentSlug);
}

// 3. Test Multi-Stage Pipeline Execution with Handoff Context
console.log('\n[TEST 3] Running Multi-Stage Boardroom & Autonomous Execution Pipeline...');
const boardroomResult = await conductBoardroomMeeting({
  topic: 'Build fullstack SaaS e-commerce with SEO traffic optimization and backend PostgreSQL'
});

const boardroomId = boardroomResult.boardroomSession.id;
console.log(`Boardroom Session created: ${boardroomId}`);
console.log(`Planned Tasks Count: ${boardroomResult.tasks.length}`);

// Execute the entire pipeline autonomously
const pipelineRunResult = await runAutonomousPipeline({ boardroomId, maxStages: 10 });
console.log(`\n[PASS 3] Pipeline Stages Executed: ${pipelineRunResult.stagesExecuted}`);
console.log(`Completed Count: ${pipelineRunResult.completedCount} / ${pipelineRunResult.totalCount}`);
console.log(`Progress Percent: ${pipelineRunResult.progressPercent}%`);
console.log(`Is Fully Completed: ${pipelineRunResult.isFullyCompleted}`);

// Verify downstream deliverables include handoff context from upstream stages
const completedTasks = pipelineRunResult.tasks;
console.log('\n--- Deliverables & Context Handoff Verification ---');
completedTasks.forEach((t, i) => {
  const hasHandoff = (t.deliverable_output || '').includes('Pipeline Handoff Context');
  console.log(`Stage ${i + 1}: ${t.title} -> ${t.agent_id} [Status: ${t.status}] (Has Handoff Context: ${hasHandoff})`);
});

const lastTask = completedTasks[completedTasks.length - 1];
if (!lastTask.deliverable_output.includes('Pipeline Handoff Context')) {
  throw new Error('Downstream deliverable missing Pipeline Handoff Context!');
}

console.log('\n=== ALL MULTI-STAGE AUTONOMOUS PIPELINE TESTS PASSED! ===');
process.exit(0);
