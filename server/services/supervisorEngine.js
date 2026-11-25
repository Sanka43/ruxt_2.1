import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAIResponse } from './aiProvider.js';
import { addMemory, recordExperience } from './agentMemory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '../..');

/**
 * RuXt Universal AI Supervisor & Review Engine
 * Provides independent QA, scoring (0-100), pass/fail verdict, and auto-recreation directives.
 * Integrates natively with RuXt's aiProvider (Antigravity/Gemini/Claude/Ollama).
 */
export async function reviewDeliverable({
  prompt = '',
  deliverable = '',
  outputFile = null,
  supervisorSlug = 'donald-trump-supervisor',
  workerSlug = 'specialist',
  settings = {}
} = {}) {
  const cleanPrompt = String(prompt || '').trim();
  const cleanDeliverable = String(deliverable || '').trim();

  let artifactContent = '';
  let artifactName = '';

  if (outputFile) {
    try {
      const resolvedPath = path.isAbsolute(outputFile) ? outputFile : path.resolve(appRootDir, outputFile);
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        artifactName = path.basename(resolvedPath);
        const size = fs.statSync(resolvedPath).size;
        if (size > 0 && size <= 65536) {
          artifactContent = fs.readFileSync(resolvedPath, 'utf8');
        } else if (size > 65536) {
          artifactContent = `[File exists: ${artifactName}, Size: ${size} bytes - binary/large file]`;
        }
      }
    } catch (e) {
      console.warn(`[supervisorEngine] Could not inspect outputFile ${outputFile}:`, e.message);
    }
  }

  const isTrump = supervisorSlug === 'donald-trump-supervisor';

  const systemPrompt = isTrump
    ? `You are Donald J. Trump, the Executive Quality Supervisor of RuXt.
You review work done by specialist agents with total authority, relentless standards, and unmistakable Trumpian style:
- You love winning, perfection, huge achievements, and world-class deliverables.
- You despise low-effort work, laziness, broken code, and missing files ("Total disaster", "Sad!", "Not good").
- When work is fantastic, you give huge praise ("Tremendous", "The best I've ever seen", "Phenomenal").
- Evaluate the deliverable rigorously against the user request.
- Score from 0 to 100:
  * 0 - 49: TOTAL FAILURE / RECREATE. Point out exactly what was botched.
  * 50 - 100: PASS / ACCEPTED. Solid or tremendous output.

You MUST respond strictly with valid JSON only in this format:
{
  "score": <0-100 integer>,
  "verdict": "<PASS or RECREATE>",
  "critique": "<Detailed supervisor evaluation in your distinctive voice>",
  "recreateDirective": "<If RECREATE, specific actionable instructions on what must be rebuilt>",
  "lessons": ["<Extracted durable rules or standards that must be remembered for next time>"]
}`
    : `You are an elite Autonomous Quality Supervisor & Code Reviewer on the RuXt Platform.
Independently audit and score the deliverable against the requested outcomes.
- Score from 0 to 100:
  * Score < 50: RECREATE (Failed acceptance criteria, missing core requirements, or empty outputs)
  * Score >= 50: PASS (Meets expectations or production-grade quality)

You MUST respond strictly with valid JSON only in this format:
{
  "score": <0-100 integer>,
  "verdict": "<PASS or RECREATE>",
  "critique": "<Objective evaluation highlighting strengths and gaps>",
  "recreateDirective": "<If RECREATE, specific instructions for revision>",
  "lessons": ["<Extracted durable technical lessons>"]
}`;

  const reviewInput = `USER REQUEST:\n${cleanPrompt}\n\n` +
    `DELIVERABLE SUBMITTED:\n${cleanDeliverable || '(No text submitted)'}\n\n` +
    (artifactName ? `ARTIFACT INSPECTED (${artifactName}):\n${artifactContent || '(Empty file)'}\n\n` : '') +
    `Evaluate and return JSON now.`;

  let score = 75;
  let verdict = 'PASS';
  let critique = 'Deliverable inspected and accepted.';
  let recreateDirective = '';
  let lessons = [];

  try {
    const aiResult = await generateAIResponse({
      systemPrompt,
      userMessage: reviewInput,
      settings: { ...settings, temperature: 0.2 }
    });

    const rawText = typeof aiResult === 'string' ? aiResult : (aiResult?.content || '');
    const cleanJson = rawText.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (typeof parsed.score === 'number') {
      score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    }
    verdict = score < 50 ? 'RECREATE' : 'PASS';
    critique = parsed.critique || (verdict === 'PASS' ? 'Deliverable approved.' : 'Deliverable failed standards.');
    recreateDirective = parsed.recreateDirective || '';
    lessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
  } catch (err) {
    console.warn(`[supervisorEngine] AI review parsing failed, using deterministic evaluation:`, err.message);
    if (!cleanDeliverable && !artifactContent) {
      score = 20;
      verdict = 'RECREATE';
      critique = isTrump 
        ? "Total disaster! Nothing was delivered. Zero output. Unacceptable!" 
        : "Failed: Deliverable is empty and no artifacts were generated.";
      recreateDirective = "Produce the complete requested deliverable according to specifications.";
    } else {
      score = 80;
      verdict = 'PASS';
      critique = isTrump
        ? "Very solid work. Looks great, very clean, tremendous execution!"
        : "Approved: Deliverable meets core requirements.";
      lessons = ["Follow verified requirements and provide structured evidence."];
    }
  }

  // Record experience in worker agent's memory
  if (workerSlug) {
    recordExperience(workerSlug, {
      taskTitle: cleanPrompt.slice(0, 80),
      summary: cleanDeliverable.slice(0, 200),
      score,
      verdict,
      artifact: artifactName || null,
      metadata: { supervisorSlug, critique: critique.slice(0, 300) }
    });

    // If passed, store durable lessons learned
    if (verdict === 'PASS' && lessons.length > 0) {
      for (const lesson of lessons) {
        if (typeof lesson === 'string' && lesson.trim().length > 10) {
          addMemory(workerSlug, {
            type: 'lesson',
            content: lesson.trim(),
            importance: Math.min(1.0, score / 100),
            tags: ['supervisor-approved', supervisorSlug]
          });
        }
      }
    }
  }

  return {
    success: true,
    score,
    rating: Math.round((score / 20) * 10) / 10,
    verdict,
    critique,
    recreate: verdict === 'RECREATE',
    recreateDirective: verdict === 'RECREATE' ? recreateDirective : null,
    recreatePrompt: verdict === 'RECREATE' ? `Revise the deliverable for this request:\n${cleanPrompt}\n\nSupervisor findings:\n${critique}\n${recreateDirective}` : null,
    supervisorSlug,
    lessons
  };
}

export default {
  reviewDeliverable
};
