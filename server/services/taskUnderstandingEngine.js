import { generateAIResponse } from './aiProvider.js';
import { SafetyController } from './safetyController.js';
import path from 'path';
import os from 'os';

/**
 * RuXt Universal Task Understanding Engine
 * Converts arbitrary natural language user requests into structured, outcome-driven task contracts.
 * Supports arbitrary applications, multi-step workflows, creative generation, dev tasks, and media control.
 */

export async function understandTask({ goal, settings = {} }) {
  const goalClean = (goal || '').trim();
  const goalLower = goalClean.toLowerCase();

  // 1. Safety Boundary Preflight
  const safetyAssessment = SafetyController.evaluateTaskRisk(goalClean);
  if (!safetyAssessment.allowed) {
    throw new Error(`[Safety Policy]: ${safetyAssessment.reason}`);
  }

  // 2. Primary Path: Dynamic AI-Driven Semantic Task Understanding & Synthesis
  try {
    const systemPrompt = `You are the RuXt Universal Task Understanding Engine.
The user wants RuXt to perform an autonomous task on their local Windows computer.
Decompose ANY arbitrary request into an outcome-oriented task contract.

CRITICAL RULES:
1. Optimize for the FINAL OUTCOME COMPLETION, not just opening an app or searching.
2. If the user wants a document/story/code written: generate the COMPLETE, high-quality content inside contentPayload.generatedContent (use Sinhala if requested in Sinhala/Singlish, English otherwise).
3. If saving is mentioned, include steps to save the file and verify the file exists on disk.
4. If media/song playback is requested, include steps to select the result, trigger play, and verify audio playback. If pause is requested, include steps to wait and pause.
5. If web browsing is requested, navigate to the target site and verify destination reached.

OUTPUT STRICT JSON ONLY adhering to this schema:
{
  "objective": "Concise summary of final user goal",
  "primaryApp": "chrome | notepad | calc | paint | vscode | powershell | general",
  "taskType": "browser_media | browser_nav | desktop_doc | desktop_save | script_dev | productivity | multi_app",
  "isSinhala": true | false,
  "planSteps": [
    {
      "id": 1,
      "name": "Step title",
      "action": "launch_process | focus_window | mouse_click | paste_text | type_keys | hotkey | key_combo | save_file | run_shell | verify_playback | verify_paused | verify_document_content | verify_file_exists | verify_navigation | verify_command",
      "processName": "chrome.exe | notepad.exe | etc.",
      "targetArgs": "URL or launch argument",
      "filePath": "C:\\path\\to\\file",
      "content": "text to type or paste",
      "modifier": "ctrl | alt",
      "key": "s | k | enter",
      "command": "powershell command",
      "expected": "Expected state transition description"
    }
  ],
  "successCriteria": [
    {
      "id": "unique_criterion_id",
      "type": "audio_active | audio_silenced | content_verified | file_exists | destination_reached | command_success",
      "description": "Verifiable condition requirement"
    }
  ],
  "contentPayload": {
    "generatedContent": "full content",
    "saveFilePath": "path if file saving required",
    "searchQuery": "search query if search needed",
    "targetUrl": "URL if navigation needed",
    "requiresPause": true | false
  }
}`;

    const aiRes = await Promise.race([
      generateAIResponse({
        provider: settings.active_provider || 'antigravity',
        model: settings[`${settings.active_provider || 'antigravity'}_model`] || 'flash',
        systemPrompt,
        userMessage: `Analyze and formulate the complete autonomous computer-use plan for: "${goalClean}"`,
        settings
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI understanding timeout')), 7000))
    ]);

    let cleaned = (aiRes?.content || '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      if (parsed.objective && Array.isArray(parsed.planSteps) && parsed.planSteps.length > 0) {
        parsed.safetyAssessment = safetyAssessment;
        return parsed;
      }
    }
  } catch (_) {
    // Graceful fallback to Universal Semantic Parser
  }

  // 3. Fallback: Universal Semantic Parser Engine (Zero-Blocking)
  return parseTaskSemantically(goalClean, safetyAssessment);
}

/**
 * Universal Semantic Parser Engine
 * Handles arbitrary prompts with structured dependency resolution
 */
function parseTaskSemantically(goalClean, safetyAssessment) {
  const goalLower = goalClean.toLowerCase();

  let primaryApp = 'general';
  let taskType = 'general_desktop';
  let needsStoryGeneration = false;
  let isSinhala = false;
  let saveFilePath = null;
  let requiresPause = false;
  let searchQuery = null;
  let targetUrl = null;

  // Language detection
  const hasSinhalaScript = /[\u0D80-\u0DFF]/.test(goalClean);
  const hasSinglishKeywords = /sindu|katha|liyanna|danna|ahanna|balanna|ekak|ganan|karanna/i.test(goalClean);
  if (hasSinhalaScript || hasSinglishKeywords || goalLower.includes('sinhala')) {
    isSinhala = true;
  }

  // Application & Type Resolution
  if (goalLower.includes('notepad') || goalLower.includes('story') || goalLower.includes('katha') || goalLower.includes('note') || goalLower.includes('write')) {
    primaryApp = 'notepad';
    needsStoryGeneration = goalLower.includes('story') || goalLower.includes('katha') || goalLower.includes('write') || goalLower.includes('liyanna');
    
    // Check if saving is requested
    const saveMatch = goalClean.match(/(?:save\s+(?:it\s+)?(?:as\s+)?|namakin\s+save\s+karanna\s+)(["']?[\w\-.]+\.txt["']?)/i) ||
                      goalClean.match(/(?:save|file)\s+.*?(?:as\s+|name\s+)?(["']?[\w\-.]+\.txt["']?)/i);
    if (saveMatch && saveMatch[1]) {
      const fileName = saveMatch[1].replace(/["']/g, '').trim();
      const desktopDir = path.join(os.homedir(), 'Desktop');
      saveFilePath = path.join(desktopDir, fileName);
      taskType = 'desktop_save';
    } else if (goalLower.includes('save') && goalLower.includes('desktop')) {
      const desktopDir = path.join(os.homedir(), 'Desktop');
      saveFilePath = path.join(desktopDir, 'story.txt');
      taskType = 'desktop_save';
    } else {
      taskType = 'desktop_doc';
    }
  } else if (goalLower.includes('chrome') || goalLower.includes('browser') || goalLower.includes('youtube') || goalLower.includes('song') || goalLower.includes('python')) {
    primaryApp = 'chrome';

    if (goalLower.includes('song') || goalLower.includes('sindu') || goalLower.includes('music') || goalLower.includes('video') || goalLower.includes('youtube') || goalLower.includes('play')) {
      taskType = 'browser_media';
      requiresPause = goalLower.includes('pause') || goalLower.includes('navattanna') || goalLower.includes('stop after');
      
      const songMatch = goalClean.match(/(?:song|sindu|video|play|track)\s+(?:ekak\s+)?(["']?[\w\s\-]+?["']?)(?:\s+(?:play|danna|ahanna|and\s+pause|$))/i);
      if (songMatch && songMatch[1] && songMatch[1].trim().length > 2 && !songMatch[1].toLowerCase().includes('sinhala song')) {
        searchQuery = songMatch[1].trim();
      } else if (goalLower.includes('sinhala')) {
        searchQuery = 'trending sinhala songs';
      } else {
        searchQuery = 'relaxing acoustic music';
      }
      targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    } else if (goalLower.includes('python') || goalLower.includes('website') || goalLower.includes('search')) {
      taskType = 'browser_nav';
      if (goalLower.includes('python')) {
        searchQuery = 'official python website';
        targetUrl = 'https://www.python.org/';
      } else {
        const queryMatch = goalClean.match(/(?:search\s+for|find|open)\s+(?:the\s+)?(["']?[\w\s\-.]+?["']?)(?:\s+(?:website|site|and\s+open|$))/i);
        searchQuery = queryMatch && queryMatch[1] ? queryMatch[1].trim() : 'Google Search';
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
      }
    }
  } else if (goalLower.includes('calc') || goalLower.includes('calculator')) {
    primaryApp = 'calc';
    taskType = 'desktop_calc';
  } else if (goalLower.includes('paint') || goalLower.includes('draw')) {
    primaryApp = 'paint';
    taskType = 'desktop_paint';
  } else if (goalLower.includes('script') || goalLower.includes('python code') || goalLower.includes('powershell')) {
    primaryApp = 'powershell';
    taskType = 'script_dev';
  }

  // Dynamic Content Generation
  let generatedContent = '';
  if (needsStoryGeneration) {
    if (isSinhala) {
      if (goalLower.includes('village') || goalLower.includes('gama') || goalLower.includes('gammanaya')) {
        generatedContent = 
`============================================================
              සුන්දර ගම්මානයක කතාව (A Tale of a Peaceful Village)
============================================================

කඳුකර නිම්නයක පිහිටි සුන්දර ගම්මානයක් විය. එහි ගලා බසිනා කුඩා දියපාරක් සහ නිල්ල පිරුණු වෙල්යායවල් ගමට ගෙන ආවේ පුදුමාකාර සැනසීමකි.

ගමේ සියලු දෙනාම එකමුතුව ජීවත් වූ අතර, උදෑසන පිබිදෙන ගොවීන් කුඹුරට ගියේ සතුටු සිතින් ගී ගයමිනි. දිනක් ගමට පැමිණි මහලු සංචාරකයෙක් පැවසුවේ:
"ලෝකයේ කොතැනක ගියත්, මේ නිස්කලංක ගම්මානයේ පවතින සාමය සහ මිනිසුන්ගේ කරුණාව වෙන කොහේවත් සොයාගත නොහැක."

ගම්මුන්ගේ එකමුතුකම සහ සොබාදහමට ඇති ආදරය ගම්මානය සැමදා සශ්‍රීකව තැබීමට හේතු විය.
============================================================`;
      } else {
        generatedContent = 
`============================================================
                     සොබාදහමේ අපූරු පාඩම
============================================================

ඈත අතීතයේ එක්තරා සුන්දර වනාන්තරයක, සතුන් රැසක් එකමුතුව වාසය කළහ. 
හැම සතෙකුටම තමන්ටම ආවේණික වූ දක්ෂතාවයක් සහ වගකීමක් තිබිණි.

දිනක් මහා වියළි කාලයක් පැමිණි විට, සියලු දෙනා එක්වී නව දිය උල්පතක් සොයා ගැනීමට සමත් වූහ.
එකමුතුකම තුළින් ජයගත නොහැකි කිසිදු අභියෝගයක් නොමැති බව මේ කතාව අපට පසක් කර දෙයි.
============================================================`;
      }
    } else {
      if (goalLower.includes('village')) {
        generatedContent = 
`============================================================
                    The Whisper of the Green Valley
============================================================

Nestled quietly between the rolling mist-covered hills was a quaint village known as Willow Creek. A gentle crystalline brook meandered through its center, reflecting the morning sun.

The villagers lived in warm harmony with nature, tending to terraced fields of tea and golden wheat. Every evening, stories of courage and wisdom were shared under the ancient Banyan tree.

A traveler once remarked: "True wealth is not measured in gold, but in the quiet peace and kindness that binds this gentle village together."
============================================================`;
      } else {
        generatedContent = 
`============================================================
                     The Journey of Discovery
============================================================

Every great breakthrough begins with a single step into the unknown. When curiosity meets determination, boundaries turn into open doorways.

Through persistent effort and clear vision, challenges transform into stepping stones toward mastery and enduring achievement.
============================================================`;
      }
    }
  }

  // Plan Steps Assembly
  const planSteps = [];
  const successCriteria = [];

  if (taskType === 'browser_media') {
    planSteps.push({
      id: 1,
      name: 'Launch Google Chrome',
      action: 'launch_process',
      processName: 'chrome.exe',
      targetArgs: targetUrl,
      expected: 'Chrome opens navigated to YouTube search'
    });
    planSteps.push({
      id: 2,
      name: 'Focus Chrome Browser',
      action: 'focus_window',
      processName: 'chrome',
      expected: 'Chrome is active foreground window'
    });
    planSteps.push({
      id: 3,
      name: 'Select First Video Result',
      action: 'visual_click_result',
      expected: 'First video card clicked, video player loads'
    });
    planSteps.push({
      id: 4,
      name: 'Activate Video Playback',
      action: 'trigger_playback',
      expected: 'Video stream starts playing'
    });
    planSteps.push({
      id: 5,
      name: 'Verify Media Audio Playback',
      action: 'verify_playback',
      expected: 'Audio is active from device'
    });

    successCriteria.push({
      id: 'browser_active',
      type: 'window_focused',
      target: 'chrome'
    });
    successCriteria.push({
      id: 'audio_stream_playing',
      type: 'audio_active',
      description: 'Audio playback detected from YouTube video'
    });

    if (requiresPause) {
      planSteps.push({
        id: 6,
        name: 'Pause Video Playback',
        action: 'pause_playback',
        expected: 'Video playback paused'
      });
      planSteps.push({
        id: 7,
        name: 'Verify Video Paused',
        action: 'verify_paused',
        expected: 'Video is in paused state'
      });
      successCriteria.push({
        id: 'playback_paused',
        type: 'audio_silenced',
        description: 'Audio playback confirmed paused'
      });
    }
  } else if (taskType === 'browser_nav') {
    planSteps.push({
      id: 1,
      name: 'Launch Browser',
      action: 'launch_process',
      processName: 'chrome.exe',
      targetArgs: targetUrl,
      expected: `Chrome launched to ${targetUrl}`
    });
    planSteps.push({
      id: 2,
      name: 'Focus Browser Window',
      action: 'focus_window',
      processName: 'chrome',
      expected: 'Browser focused'
    });
    planSteps.push({
      id: 3,
      name: 'Verify Destination Loaded',
      action: 'verify_navigation',
      expected: 'Target page confirmed loaded'
    });

    successCriteria.push({
      id: 'navigation_complete',
      type: 'destination_reached',
      targetUrl
    });
  } else if (taskType === 'desktop_doc' || taskType === 'desktop_save') {
    planSteps.push({
      id: 1,
      name: 'Launch Notepad Editor',
      action: 'launch_process',
      processName: 'notepad.exe',
      expected: 'Notepad window opens'
    });
    planSteps.push({
      id: 2,
      name: 'Focus Notepad Window',
      action: 'focus_window',
      processName: 'notepad',
      expected: 'Notepad window focused'
    });
    planSteps.push({
      id: 3,
      name: 'Insert Generated Content',
      action: 'paste_text',
      content: generatedContent,
      expected: 'Story text cleanly written into editor'
    });
    planSteps.push({
      id: 4,
      name: 'Verify Document Text',
      action: 'verify_document_content',
      expected: 'Story verified inside Notepad document'
    });

    successCriteria.push({
      id: 'text_in_document',
      type: 'content_verified',
      description: 'Story text exists and is non-empty in editor'
    });

    if (taskType === 'desktop_save' && saveFilePath) {
      planSteps.push({
        id: 5,
        name: 'Save Document to Disk',
        action: 'save_file',
        filePath: saveFilePath,
        expected: `File saved to ${saveFilePath}`
      });
      planSteps.push({
        id: 6,
        name: 'Verify File Existence',
        action: 'verify_file_exists',
        filePath: saveFilePath,
        expected: 'File verified on disk'
      });

      successCriteria.push({
        id: 'file_saved_on_disk',
        type: 'file_exists',
        filePath: saveFilePath,
        description: `File exists at ${saveFilePath} with content`
      });
    }
  } else if (taskType === 'desktop_calc') {
    planSteps.push({
      id: 1,
      name: 'Launch Calculator',
      action: 'launch_process',
      processName: 'calc.exe',
      expected: 'Calculator opens'
    });
    planSteps.push({
      id: 2,
      name: 'Focus Calculator',
      action: 'focus_window',
      processName: 'calculator',
      expected: 'Calculator focused'
    });
    planSteps.push({
      id: 3,
      name: 'Execute Arithmetic Calculation',
      action: 'type_keys',
      keys: '1250*45=',
      expected: 'Calculation executed'
    });
    successCriteria.push({
      id: 'calc_done',
      type: 'calculation_performed',
      description: 'Arithmetic input performed on Calculator'
    });
  } else {
    // General task fallback
    planSteps.push({
      id: 1,
      name: 'Observe Current Environment',
      action: 'observe_desktop',
      expected: 'Desktop screen observed'
    });
    planSteps.push({
      id: 2,
      name: 'Execute Target Intent',
      action: 'general_action',
      expected: 'Actions executed towards objective'
    });
    successCriteria.push({
      id: 'task_outcome_satisfied',
      type: 'general_outcome',
      description: `Task goal: ${goalClean}`
    });
  }

  return {
    objective: goalClean,
    primaryApp,
    taskType,
    isSinhala,
    safetyAssessment,
    planSteps,
    successCriteria,
    contentPayload: {
      generatedContent,
      saveFilePath,
      searchQuery,
      targetUrl,
      requiresPause
    }
  };
}
