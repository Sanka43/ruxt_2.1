import readline from 'readline';

// Route all informational console logs to stderr so stdout is reserved 100% for clean NDJSON lines
const originalLog = console.log;
console.log = (...args) => console.error(...args);

import { generateAIResponse } from './aiProvider.js';

/**
 * High-Speed Persistent Bridge Daemon for RuXt Agent-S Vision Loop.
 * Keeps ACP connection warm across multiple execution steps.
 */
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

let isProcessing = false;
const queue = [];

async function handleRequest(line) {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const parsed = JSON.parse(trimmed);
    const userPrompt = parsed.userPrompt || parsed.prompt;
    const systemPrompt = parsed.systemPrompt || parsed.system || '';
    const imageBase64 = parsed.imageBase64 || parsed.image || null;
    const model = parsed.model || 'flash';

    const res = await generateAIResponse({
      provider: 'antigravity',
      model,
      systemPrompt,
      userMessage: userPrompt,
      images: imageBase64 ? [imageBase64] : []
    });

    process.stdout.write(JSON.stringify({ success: true, content: res.content }) + '\n');
  } catch (err) {
    process.stdout.write(JSON.stringify({ success: false, error: err.message }) + '\n');
  }
}

rl.on('line', async (line) => {
  queue.push(line);
  if (!isProcessing) {
    isProcessing = true;
    while (queue.length > 0) {
      const nextLine = queue.shift();
      await handleRequest(nextLine);
    }
    isProcessing = false;
  }
});

rl.on('close', () => {
  process.exit(0);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
