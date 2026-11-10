import { understandTask } from '../services/taskUnderstandingEngine.js';
import { TaskVerificationEngine } from '../services/taskVerificationEngine.js';
import { startVisionDesktopExecution, runWindowsAction } from '../services/visionComputerUse.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function cleanupWindows() {
  await runWindowsAction(['-Action', 'stop_border']);
  // Close any test Notepad instances
  try {
    const { execSync } = await import('child_process');
    execSync('taskkill /F /IM notepad.exe /T 2>nul', { stdio: 'ignore' });
  } catch (_) {}
  await new Promise(r => setTimeout(r, 800));
}

async function waitForJobCompletion(job, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'partial') {
      return job;
    }
    await new Promise(r => setTimeout(r, 600));
  }
  return job;
}

export async function runAllTests() {
  console.log('================================================================');
  console.log('🚀 RUXT 2.1 AUTONOMOUS VISION COMPUTER USE END-TO-END TEST SUITE');
  console.log('================================================================\n');

  const results = [];

  // -------------------------------------------------------------
  // TEST 1: Open Chrome and play a Sinhala song
  // -------------------------------------------------------------
  console.log('--- RUNNING TEST 1: Open Chrome and play a Sinhala song ---');
  await cleanupWindows();
  const t1Goal = 'Open Chrome and play a Sinhala song.';
  const t1Job = await startVisionDesktopExecution({ goal: t1Goal });
  await waitForJobCompletion(t1Job, 35000);

  const t1Pass = t1Job.status === 'completed' && t1Job.verifiedOutcomes['audio_stream_playing'];
  results.push({
    testId: 1,
    name: 'Open Chrome and play a Sinhala song',
    passed: Boolean(t1Pass),
    status: t1Job.status,
    verifiedOutcomes: t1Job.verifiedOutcomes
  });
  console.log(`TEST 1 RESULT: ${t1Pass ? '✅ PASSED' : '❌ FAILED'} (Status: ${t1Job.status})\n`);

  // -------------------------------------------------------------
  // TEST 2: Open Notepad and write a short story about a village
  // -------------------------------------------------------------
  console.log('--- RUNNING TEST 2: Open Notepad and write a short story about a village ---');
  await cleanupWindows();
  const t2Goal = 'Open Notepad and write a short story about a village.';
  const t2Job = await startVisionDesktopExecution({ goal: t2Goal });
  await waitForJobCompletion(t2Job, 25000);

  const t2Pass = t2Job.status === 'completed' && t2Job.verifiedOutcomes['text_in_document'];
  results.push({
    testId: 2,
    name: 'Open Notepad and write a short story about a village',
    passed: Boolean(t2Pass),
    status: t2Job.status,
    verifiedOutcomes: t2Job.verifiedOutcomes
  });
  console.log(`TEST 2 RESULT: ${t2Pass ? '✅ PASSED' : '❌ FAILED'} (Status: ${t2Job.status})\n`);

  // -------------------------------------------------------------
  // TEST 3: Open Notepad, write a story, and save it as village_story.txt on the desktop
  // -------------------------------------------------------------
  console.log('--- RUNNING TEST 3: Open Notepad, write a story, and save it as village_story.txt on the desktop ---');
  await cleanupWindows();
  const desktopFilePath = path.join(os.homedir(), 'Desktop', 'village_story.txt');
  if (fs.existsSync(desktopFilePath)) {
    try { fs.unlinkSync(desktopFilePath); } catch (_) {}
  }

  const t3Goal = 'Open Notepad, write a story, and save it as village_story.txt on the desktop.';
  const t3Job = await startVisionDesktopExecution({ goal: t3Goal });
  await waitForJobCompletion(t3Job, 30000);

  const fileExistsOnDisk = fs.existsSync(desktopFilePath) && fs.statSync(desktopFilePath).size > 20;
  const t3Pass = t3Job.status === 'completed' && fileExistsOnDisk && t3Job.verifiedOutcomes['file_saved_on_disk'];
  results.push({
    testId: 3,
    name: 'Open Notepad, write a story, and save it as village_story.txt on the desktop',
    passed: Boolean(t3Pass),
    status: t3Job.status,
    fileExistsOnDisk,
    filePath: desktopFilePath,
    fileSizeBytes: fileExistsOnDisk ? fs.statSync(desktopFilePath).size : 0,
    verifiedOutcomes: t3Job.verifiedOutcomes
  });
  console.log(`TEST 3 RESULT: ${t3Pass ? '✅ PASSED' : '❌ FAILED'} (File exists: ${fileExistsOnDisk})\n`);

  // -------------------------------------------------------------
  // TEST 4: Open Chrome, search for the official Python website, and open it
  // -------------------------------------------------------------
  console.log('--- RUNNING TEST 4: Open Chrome, search for the official Python website, and open it ---');
  await cleanupWindows();
  const t4Goal = 'Open Chrome, search for the official Python website, and open it.';
  const t4Job = await startVisionDesktopExecution({ goal: t4Goal });
  await waitForJobCompletion(t4Job, 25000);

  const t4Pass = t4Job.status === 'completed' && t4Job.verifiedOutcomes['navigation_complete'];
  results.push({
    testId: 4,
    name: 'Open Chrome, search for the official Python website, and open it',
    passed: Boolean(t4Pass),
    status: t4Job.status,
    verifiedOutcomes: t4Job.verifiedOutcomes
  });
  console.log(`TEST 4 RESULT: ${t4Pass ? '✅ PASSED' : '❌ FAILED'} (Status: ${t4Job.status})\n`);

  // -------------------------------------------------------------
  // TEST 5: Open Notepad and write a Sinhala story
  // -------------------------------------------------------------
  console.log('--- RUNNING TEST 5: Open Notepad and write a Sinhala story ---');
  await cleanupWindows();
  const t5Goal = 'Open Notepad and write a Sinhala story.';
  const t5Job = await startVisionDesktopExecution({ goal: t5Goal });
  await waitForJobCompletion(t5Job, 25000);

  const t5Pass = t5Job.status === 'completed' && t5Job.taskContract.isSinhala && t5Job.verifiedOutcomes['text_in_document'];
  results.push({
    testId: 5,
    name: 'Open Notepad and write a Sinhala story',
    passed: Boolean(t5Pass),
    status: t5Job.status,
    isSinhala: t5Job.taskContract.isSinhala,
    verifiedOutcomes: t5Job.verifiedOutcomes
  });
  console.log(`TEST 5 RESULT: ${t5Pass ? '✅ PASSED' : '❌ FAILED'} (Is Sinhala: ${t5Job.taskContract.isSinhala})\n`);

  // -------------------------------------------------------------
  // TEST 6: Open Chrome, search for a Sinhala song, play it, and pause it after playback begins
  // -------------------------------------------------------------
  console.log('--- RUNNING TEST 6: Open Chrome, search for a Sinhala song, play it, and pause it after playback begins ---');
  await cleanupWindows();
  const t6Goal = 'Open Chrome, search for a Sinhala song, play it, and pause it after playback begins.';
  const t6Job = await startVisionDesktopExecution({ goal: t6Goal });
  await waitForJobCompletion(t6Job, 50000);

  const t6Pass = t6Job.status === 'completed' && t6Job.verifiedOutcomes['audio_stream_playing'] && t6Job.verifiedOutcomes['playback_paused'];
  results.push({
    testId: 6,
    name: 'Open Chrome, search for a Sinhala song, play it, and pause it after playback begins',
    passed: Boolean(t6Pass),
    status: t6Job.status,
    verifiedOutcomes: t6Job.verifiedOutcomes
  });
  console.log(`TEST 6 RESULT: ${t6Pass ? '✅ PASSED' : '❌ FAILED'} (Status: ${t6Job.status})\n`);

  // -------------------------------------------------------------
  // TEST 7: Arbitrary Task Beyond Fixed Examples
  // User asks: "Open Notepad, write a creative poem about space exploration, and save it as space_poem.txt on the desktop."
  // -------------------------------------------------------------
  console.log('--- RUNNING TEST 7: Arbitrary Task: Space poem in Notepad saved to desktop ---');
  await cleanupWindows();
  const spaceFilePath = path.join(os.homedir(), 'Desktop', 'space_poem.txt');
  if (fs.existsSync(spaceFilePath)) {
    try { fs.unlinkSync(spaceFilePath); } catch (_) {}
  }

  const t7Goal = 'Open Notepad, write a creative poem about space exploration, and save it as space_poem.txt on the desktop.';
  const t7Job = await startVisionDesktopExecution({ goal: t7Goal });
  await waitForJobCompletion(t7Job, 35000);

  const spaceFileExists = fs.existsSync(spaceFilePath) && fs.statSync(spaceFilePath).size > 20;
  const t7Pass = t7Job.status === 'completed' && spaceFileExists && t7Job.verifiedOutcomes['file_saved_on_disk'];
  results.push({
    testId: 7,
    name: 'Arbitrary Task: Space poem in Notepad saved to desktop',
    passed: Boolean(t7Pass),
    status: t7Job.status,
    fileExistsOnDisk: spaceFileExists,
    filePath: spaceFilePath,
    fileSizeBytes: spaceFileExists ? fs.statSync(spaceFilePath).size : 0,
    verifiedOutcomes: t7Job.verifiedOutcomes
  });
  console.log(`TEST 7 RESULT: ${t7Pass ? '✅ PASSED' : '❌ FAILED'} (File exists: ${spaceFileExists})\n`);

  await cleanupWindows();

  console.log('================================================================');
  console.log('📊 FINAL TEST RESULTS SUMMARY:');
  console.log('================================================================');
  for (const r of results) {
    console.log(`TEST ${r.testId}: ${r.passed ? '✅ PASSED' : '❌ FAILED'} - ${r.name}`);
  }
  const allPassed = results.every(r => r.passed);
  console.log(`\nOVERALL STATUS: ${allPassed ? '🎉 ALL 7 TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
  console.log('================================================================\n');

  return results;
}

if (process.argv[1]?.includes('computerUse.test.js')) {
  runAllTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}
