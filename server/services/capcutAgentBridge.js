import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { generateAIResponse } from './aiProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Discovers the installed CapCut Agent Python CLI
 */
export function getCapCutAgentCliPath() {
  const userProfile = process.env.USERPROFILE || '';
  const appData = process.env.APPDATA || (userProfile ? path.join(userProfile, 'AppData', 'Roaming') : '');

  const candidates = [
    path.join(appData, 'RuXt', 'data', 'agents', 'capcut-agent', 'capcut_agent', 'cli.py'),
    path.resolve(__dirname, '../../agents/capcut-agent/capcut_agent/cli.py'),
    path.resolve(__dirname, '../../../agents/capcut-agent/capcut_agent/cli.py'),
    path.resolve(__dirname, '../../data/agents/capcut-agent/capcut_agent/cli.py')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Fast Regex Parser for structured Video/Reel prompts
 */
export function parseStructuredCapCutPrompt(text) {
  if (!text) return null;
  const t = text;

  // Title: named "AI_Tech_Short" or project "..." or title "..."
  const titleMatch = t.match(/(?:named|project|title)\s*["']([^"']+)["']/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Viral_TikTok_Reel';

  // Aspect Ratio: e.g. 9:16, 16:9, 1:1
  const ratioMatch = t.match(/aspect\s*ratio[:\s]+([\d]+:[\d]+)/i);
  const ratio = ratioMatch ? ratioMatch[1].trim() : '9:16';

  // Video Clip: absolute path or relative path ending in .mp4, .mov, etc.
  const videoMatch = t.match(/video\s*clip[:\s]+([A-Za-z]:\\[^\s()\r\n]+|\/[^\s()\r\n]+)/i);
  const videoPath = videoMatch ? videoMatch[1].trim() : null;

  if (!videoPath) return null;

  // Duration: e.g. "Use first 10 seconds" or "duration: 10s"
  let duration = 10.0;
  const durMatch = t.match(/(?:first|duration[:\s]+)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)/i);
  if (durMatch) {
    duration = parseFloat(durMatch[1]);
  }

  // Subtitles
  const subtitles = [];
  const subRegex = /["']([^"']+)["']\s*\(([\d\.]+)\s*s?\s*(?:to|-)\s*([\d\.]+)\s*s?\)/gi;
  let m;
  while ((m = subRegex.exec(t)) !== null) {
    const textStr = m[1].trim();
    const startSec = parseFloat(m[2]);
    const endSec = parseFloat(m[3]);
    const durSec = Math.max(0.5, endSec - startSec);
    subtitles.push({
      text: textStr,
      start: startSec,
      duration: durSec
    });
  }

  const autoOpen = !t.match(/no-open|don't open|manual open/i);

  return {
    title,
    ratio,
    videos: [
      {
        path: videoPath,
        start: 0.0,
        duration: duration
      }
    ],
    subtitles,
    auto_open: autoOpen
  };
}

/**
 * Intelligent AI-Powered Task Extractor for arbitrary video editing requests
 */
export async function extractCapCutTaskContract(prompt, settings = {}) {
  // 1. Try fast local regex first
  const fastParsed = parseStructuredCapCutPrompt(prompt);
  if (fastParsed && fastParsed.videos.length > 0 && fs.existsSync(fastParsed.videos[0].path)) {
    return fastParsed;
  }

  // 2. Dynamic AI extraction
  try {
    const systemPrompt = `You are CineCut Studio AI Task Decomposer.
Convert user video editing requests into strict CapCut draft generation JSON.
Rules:
- ratio: "9:16" for TikTok/Reels/Shorts, "16:9" for YouTube, "1:1" for Square.
- videos: array of { "path": string, "start": number (seconds), "duration": number (seconds) }.
- subtitles: array of { "text": string, "start": number (seconds), "duration": number (seconds) }.
- auto_open: boolean (true by default).

OUTPUT STRICT JSON ONLY adhering to:
{
  "title": "string",
  "ratio": "9:16 | 16:9 | 1:1",
  "videos": [
    { "path": "C:\\\\path\\\\to\\\\video.mp4", "start": 0.0, "duration": 10.0 }
  ],
  "subtitles": [
    { "text": "Sub text", "start": 0.0, "duration": 3.0 }
  ],
  "auto_open": true
}`;

    const res = await generateAIResponse({
      provider: settings.active_provider || 'antigravity',
      model: settings[`${settings.active_provider || 'antigravity'}_model`] || 'flash',
      systemPrompt,
      userMessage: `Extract CapCut draft specification for: "${prompt}"`,
      settings
    });

    const cleaned = (res?.content || '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    }
  } catch (err) {
    console.warn('[CapCut AI Decomposer Warning]:', err.message);
  }

  return fastParsed;
}

/**
 * Executes CapCut Draft Synthesis via the standalone capcut-agent Python CLI
 */
export async function executeCapCutDraftGeneration(payload) {
  const cliPath = getCapCutAgentCliPath();
  if (!cliPath) {
    throw new Error('CineCut Studio Agent package (cli.py) not found in system or agents catalog.');
  }

  return new Promise((resolve, reject) => {
    const jsonStr = JSON.stringify(payload);
    const child = spawn('python', [cliPath, '--payload', jsonStr], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());

    child.on('close', code => {
      if (code === 0) {
        resolve({
          success: true,
          output: stdout.trim(),
          payload
        });
      } else {
        reject(new Error(`CapCut Agent failed with exit code ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', err => {
      reject(new Error(`Failed to spawn Python for CapCut Agent: ${err.message}`));
    });
  });
}
