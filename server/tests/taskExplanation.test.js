import { understandTask } from '../services/taskUnderstandingEngine.js';
import { notifyTaskOutcome } from '../services/taskOutcomeExplainer.js';
import db from '../db.js';
import { randomUUID } from 'crypto';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUXT 2.1 TASK EXPLANATION & NOTEPAD TARGETING TEST SUITE');
  console.log('================================================================\n');

  // 1. Test Task Understanding for user Sinhala/Singlish prompt
  console.log('--- TEST 1: Semantic Task Understanding for Sinhala Notepad Prompt ---');
  const userGoal = 'note pad open karala eke story ekak liyanna';
  const taskContract = await understandTask({ goal: userGoal, settings: {} });
  console.log('Primary App:', taskContract.primaryApp);
  console.log('Is Sinhala:', taskContract.isSinhala);
  console.log('Plan Steps Count:', taskContract.planSteps.length);
  console.log('Generated Story Length:', taskContract.contentPayload?.generatedContent?.length || 0);

  if (taskContract.primaryApp !== 'notepad') {
    throw new Error(`Expected primaryApp to be 'notepad', got: ${taskContract.primaryApp}`);
  }
  if (!taskContract.isSinhala) {
    throw new Error('Expected isSinhala to be true');
  }
  if (!taskContract.contentPayload?.generatedContent || taskContract.contentPayload.generatedContent.length < 50) {
    throw new Error('Expected rich generated story in contentPayload');
  }
  console.log('✅ TEST 1 PASSED: Notepad and Sinhala story understood accurately!\n');

  // Create a temporary chat session in DB for testing notifications
  const testSessionId = 'test-session-' + randomUUID();
  db.prepare(`
    INSERT INTO chat_sessions (id, title, agent_id)
    VALUES (?, ?, 'ruxt')
  `).run(testSessionId, 'Test Explanation Session');

  // 2. Test Incomplete Task Explanation (The exact problem user reported)
  console.log('--- TEST 2: Explain Incomplete Task Halted Halfway ---');
  const incompleteJobState = {
    id: randomUUID(),
    goal: userGoal,
    currentStepIndex: 2,
    steps: taskContract.planSteps
  };
  const incompleteReport = {
    status: 'PARTIAL_OR_FAILED',
    evaluation: {
      completed: false,
      reason: 'Pending unverified criteria: text_in_document',
      unverified: [{ id: 'text_in_document', description: 'Story text exists and is non-empty in editor' }]
    },
    verifiedDeliverables: {}
  };

  const incompleteRes = notifyTaskOutcome({
    sessionId: testSessionId,
    jobState: incompleteJobState,
    taskContract,
    finalReport: incompleteReport,
    isAborted: false
  });

  console.log('Generated Explanation Message for Incomplete Task:\n');
  console.log('--------------------------------------------------');
  console.log(incompleteRes.content);
  console.log('--------------------------------------------------');

  if (!incompleteRes.content.includes('කාර්යය අතරමග නැවතුණා') || !incompleteRes.content.includes('අතරමග නැවතීමට හේතුව')) {
    throw new Error('Incomplete task explanation missing required Sinhala sections');
  }
  console.log('✅ TEST 2 PASSED: Incomplete task explained transparently in Sinhala!\n');

  // 3. Test Full Completion Explanation
  console.log('--- TEST 3: Full Completion Explanation ---');
  const completeReport = {
    status: 'COMPLETED',
    evaluation: {
      completed: true,
      totalCriteria: 1,
      reason: 'All success criteria verified with observable evidence.'
    },
    verifiedDeliverables: { text_in_document: { verified: true } }
  };

  const completeRes = notifyTaskOutcome({
    sessionId: testSessionId,
    jobState: { ...incompleteJobState, currentStepIndex: 3 },
    taskContract,
    finalReport: completeReport,
    isAborted: false
  });

  console.log('Generated Completion Message:\n');
  console.log('--------------------------------------------------');
  console.log(completeRes.content);
  console.log('--------------------------------------------------');

  if (!completeRes.content.includes('කාර්යය සාර්ථකව අවසන් කළා')) {
    throw new Error('Completion explanation missing success header');
  }
  console.log('✅ TEST 3 PASSED: Completed task confirmed in Sinhala!\n');

  // Clean up test session
  db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(testSessionId);
  db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(testSessionId);

  console.log('================================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
