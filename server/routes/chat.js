import { Router } from 'express';
import db from '../db.js';
import { loadSettingRows } from '../services/secretStore.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAIResponse } from '../services/aiProvider.js';
import { handleOrchestratedConversation, conductBoardroomMeeting } from '../services/orchestrator.js';
import { 
  synthesizeTaskPlanAndScript, 
  resolveTargetAppFromPrompt 
} from '../services/desktopAutomation.js';
import { startLiveDesktopExecution } from '../services/desktopOperator.js';
import { startVisionDesktopExecution } from '../services/visionComputerUse.js';
import { desktopAutomationSupported, DESKTOP_UNSUPPORTED_MESSAGE } from '../services/platformGuard.js';
import { 
  extractCapCutTaskContract, 
  executeCapCutDraftGeneration 
} from '../services/capcutAgentBridge.js';
import { retrieveMemories, addMemory, formatMemoryContext } from '../services/agentMemory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const agentsDir = process.env.RUXT_AGENTS_DIR || path.resolve(__dirname, '../../agents');

function getAgentPersonaContext(slug, userQuery = '') {
  if (!slug) return '';
  const agentFolder = path.join(agentsDir, slug);
  if (!fs.existsSync(agentFolder)) return '';

  let context = '';

  // 1. Read agent.md
  const agentMdPath = path.join(agentFolder, 'agent.md');
  if (fs.existsSync(agentMdPath)) {
    try {
      const content = fs.readFileSync(agentMdPath, 'utf8');
      context += `\n\n--- AGENT PERSONA PROFILE ---\n${content}\n`;
    } catch (_) {}
  }

  // 2. Read skills/*/SKILL.md
  const skillsDir = path.join(agentFolder, 'skills');
  if (fs.existsSync(skillsDir)) {
    try {
      const scanDir = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const fullPath = path.join(dir, e.name);
          if (e.isDirectory()) {
            scanDir(fullPath);
          } else if (e.name.toLowerCase() === 'skill.md') {
            const skillContent = fs.readFileSync(fullPath, 'utf8');
            context += `\n\n--- SPECIALIST SKILL INSTRUCTIONS ---\n${skillContent}\n`;
          }
        }
      };
      scanDir(skillsDir);
    } catch (_) {}
  }

  // 3. Inject Universal Agent Memory (Internalized lessons, guidelines & preferences)
  try {
    const relevantMemories = retrieveMemories(slug, userQuery, { limit: 5 });
    if (relevantMemories.length > 0) {
      context += formatMemoryContext(relevantMemories);
    }
  } catch (memErr) {
    console.warn(`[chat] Failed to inject memory context for ${slug}:`, memErr.message);
  }

  // 4. If agent is RuXt (Leader), inject active team context
  if (slug === 'ruxt') {
    try {
      const installedAgents = db.prepare('SELECT id, name, slug, role, description FROM agents WHERE slug != ?').all('ruxt');
      if (installedAgents.length > 0) {
        context += `\n\n--- CURRENTLY INSTALLED SPECIALIST AGENTS UNDER YOUR LEADERSHIP ---\n`;
        for (const a of installedAgents) {
          context += `- **${a.name}** (${a.slug}): ${a.role} — ${a.description}\n`;
        }
        context += `\nAs the Team Leader, when the user presents a project, analyze it and assign tasks to these specific team members. Break work into clear, measurable steps and maintain quality assurance.\n`;
      }
    } catch (_) {}
  }

  return context;
}

// Get all chat sessions (excluding/purging any empty sessions that have 0 messages)
router.get('/sessions', (req, res) => {
  try {
    // Automatically purge any empty chat sessions without any messages
    db.prepare(`
      DELETE FROM chat_sessions 
      WHERE id NOT IN (SELECT DISTINCT session_id FROM chat_messages)
    `).run();

    const sessions = db.prepare(`
      SELECT s.*, 
        (SELECT content FROM chat_messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as message_count
      FROM chat_sessions s
      ORDER BY s.updated_at DESC
    `).all();
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create chat session
router.post('/sessions', (req, res) => {
  try {
    const { title, agent_id } = req.body;

    const id = randomUUID();
    const sessionTitle = title || (agent_id ? `Chat with ${agent_id}` : 'New Conversation');

    db.prepare(`
      INSERT INTO chat_sessions (id, title, agent_id)
      VALUES (?, ?, ?)
    `).run(id, sessionTitle, agent_id || null);

    const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get messages for a session
router.get('/sessions/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    const messages = db.prepare(`
      SELECT * FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `).all(id);
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete chat session
router.delete('/sessions/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(id);
    db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Active session abort controllers map for stop/cancellation
const activeSessionAbortControllers = new Map();

// Stop active generation for a session
router.post('/sessions/:id/stop', (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const ctrl = activeSessionAbortControllers.get(sessionId);
    if (ctrl) {
      try {
        ctrl.abort();
      } catch (_) {}
      activeSessionAbortControllers.delete(sessionId);
    }
    return res.json({ success: true, message: 'Generation stopped' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Send message & get agent response via selected multi-provider brain
router.post('/sessions/:id/messages', async (req, res) => {
  const requestStartTime = Date.now();
  const { id: sessionId } = req.params;

  const abortCtrl = new AbortController();
  activeSessionAbortControllers.set(sessionId, abortCtrl);
  req.on('close', () => {
    try { abortCtrl.abort(); } catch (_) {}
    activeSessionAbortControllers.delete(sessionId);
  });

  try {
    const { content, providerOverride, modelOverride } = req.body;
    if (!content) return res.status(400).json({ error: 'Message content is required' });

    // 1. Insert user message
    const userMsgId = randomUUID();
    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content)
      VALUES (?, ?, 'user', ?)
    `).run(userMsgId, sessionId, content);

    // Update session timestamp & auto-name session from first message if title is generic
    const countRow = db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?').get(sessionId);
    if (countRow?.count === 1) {
      const sess = db.prepare('SELECT title FROM chat_sessions WHERE id = ?').get(sessionId);
      if (sess && (sess.title === 'New Conversation' || sess.title.startsWith('Chat with'))) {
        const cleanSnippet = content.trim().replace(/\s+/g, ' ');
        const shortSnippet = cleanSnippet.length > 36 ? cleanSnippet.slice(0, 36) + '...' : cleanSnippet;
        db.prepare('UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(shortSnippet, sessionId);
      } else {
        db.prepare('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId);
      }
    } else {
      db.prepare('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sessionId);
    }

    // Fetch session and agent details
    const session = db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(sessionId);
    let agentName = 'RuXt Leader';
    let agentRole = 'Engine Orchestrator';
    let agentSlug = session?.agent_id || 'ruxt';

    // 1. Check for @mention in content to dynamically route/consult installed specialist
    let isMentioned = false;
    try {
      const allAgents = db.prepare('SELECT id, name, slug, role FROM agents').all();
      // Sort descending by name length so multi-word names match before shorter terms
      allAgents.sort((a, b) => (b.name || '').length - (a.name || '').length);
      for (const a of allAgents) {
        const safeName = (a.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const safeSlug = (a.slug || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const namePattern = new RegExp(`@${safeName}\\b`, 'i');
        const slugPattern = new RegExp(`@${safeSlug}\\b`, 'i');
        if (namePattern.test(content) || slugPattern.test(content)) {
          agentSlug = a.slug;
          agentName = a.name;
          agentRole = a.role;
          isMentioned = true;
          break;
        }
      }
    } catch (_) {}

    if (!isMentioned && agentSlug) {
      const agent = db.prepare('SELECT name, role, slug FROM agents WHERE id = ? OR slug = ?').get(agentSlug, agentSlug);
      if (agent) {
        agentName = agent.name;
        agentRole = agent.role;
        agentSlug = agent.slug;
      }

      if (agentSlug === 'ruxt') {
        try {
          const leaderNameRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('team_leader_name');
          const leaderRoleRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('team_leader_role');
          if (leaderNameRow?.value) agentName = leaderNameRow.value;
          if (leaderRoleRow?.value) agentRole = leaderRoleRow.value;
        } catch (_) {}
      }
    }

    // Load full persona & skills definition with contextual memory injection
    const personaContext = getAgentPersonaContext(agentSlug, content);

    let systemPrompt = `You are ${agentName}, working as ${agentRole} on the RuXt AI Platform.
You embody the highest standard of your profession. Do not act like a generic chatbot. Speak with authenticity, professionalism, and purpose.
${personaContext}

Answer the user directly, provide structured and actionable recommendations according to your instructions, and stay in character.`;

    // 2. Intelligent Intent Classification & Slash Actions Extraction
    const rawContent = content || '';
    const msgLower = rawContent.toLowerCase().trim();

    // Check for slash commands anywhere in the prompt (start, end, or middle)
    const hasSlashPlan = /(?:^|\s)\/plan(?:\s|$)/i.test(rawContent);
    const hasSlashPcControl = /(?:^|\s)\/(?:pc-control|desktop|control)(?:\s|$)/i.test(rawContent);
    const hasSlashLearn = /(?:^|\s)\/learn(?:\s|$)/i.test(rawContent);

    // Extract clean task without the slash command keyword
    const cleanPrompt = rawContent
      .replace(/(?:^|\s)\/(?:plan|pc-control|desktop|control|learn)(?:\s|$)/ig, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Natural planning inquiry check (e.g. "plan ekak hadanna", "make a plan", "plan karanna")
    const isNaturalPlanning = !hasSlashPcControl && (
      hasSlashPlan || 
      /\b(?:make\s+a\s+plan|plan\s+(?:this|an|the|for)|plan\s*ekak|plan\s*karanna|planning\s+mode)\b/i.test(msgLower)
    );

    if (isNaturalPlanning) {
      systemPrompt = `--- PLANNING MODE DIRECTIVE ---
The user explicitly invoked /plan for: "${cleanPrompt || 'the requested objective'}".
You must formulate a thorough, structured, step-by-step implementation plan before proposing execution:
1. Executive Goal & Architectural Alignment
2. Phase-by-Phase Milestones & Detailed Implementation Steps
3. File & Component Change Matrix
4. Verification & Testing Strategy
5. Potential Risks & Mitigation Procedures
Format with clean GitHub Markdown, alerts, and tables where appropriate.
--------------------------------

${systemPrompt}`;
    }

    if (hasSlashLearn && cleanPrompt) {
      try {
        addMemory(agentSlug, {
          type: 'preference',
          content: cleanPrompt,
          importance: 1.0,
          tags: ['user-guideline', 'instruction']
        });
      } catch (memErr) {
        console.warn(`[chat] Could not persist learned memory for ${agentSlug}:`, memErr.message);
      }

      systemPrompt = `--- WORKSPACE LEARNING DIRECTIVE ---
The user explicitly invoked /learn to teach or memorize this guideline/skill: "${cleanPrompt}".
This guideline has been PERMANENTLY recorded in your native agent memory (memory.json).
Acknowledge the instruction clearly, confirm that you have saved it into your permanent operating memory, and explain how it will strictly shape all future tasks and workflows in this workspace.
------------------------------------

${systemPrompt}`;
    }

    // Fetch recent message history (last 8 messages)
    const history = db.prepare(`
      SELECT role, content FROM chat_messages 
      WHERE session_id = ? AND id != ?
      ORDER BY created_at DESC LIMIT 8
    `).all(sessionId, userMsgId).reverse();

    // Fetch user configured settings
    const settingsRows = loadSettingRows();
    const settings = {
      active_provider: 'antigravity',
      antigravity_model: 'flash',
      antigravity_custom_path: '',
      stealth_host_mode: 'true',
      gemini_model: 'gemini-2.0-flash',
      claude_model: 'claude-3-7-sonnet-20250219',
      openai_model: 'gpt-4o-mini',
      ollama_host: 'http://localhost:11434',
      ollama_model: 'deepseek-r1:latest',
      custom_base_url: 'http://localhost:1234/v1',
      global_system_rules: ''
    };
    for (const r of settingsRows) {
      settings[r.key] = r.value;
    }

    if (settings.global_system_rules && settings.global_system_rules.trim()) {
      systemPrompt = `--- GLOBAL WORKSPACE COGNITIVE RULES ---\n${settings.global_system_rules.trim()}\n----------------------------------------\n\n${systemPrompt}`;
    }

    const activeProvider = providerOverride || settings.active_provider || 'antigravity';
    const activeModel = modelOverride || settings[`${activeProvider}_model`] || (activeProvider === 'antigravity' ? 'flash' : 'gemini-2.0-flash');

    let replyContent = '';
    let usedProvider = activeProvider;
    let usedModel = activeModel;
    let dispatchData = null;
    let quickReplies = null;
    let workflowState = null;
    let desktopAction = null;
    let boardroomData = null;
    let mcpEvents = []; // tool calls the agent made during this reply

    // 3. Strict & Safe Desktop Automation Intent Classification
    const isRuXtLeader = agentSlug === 'ruxt';
    const isCapCutSpecialist = agentSlug === 'capcut-agent';

    // 3.1 Autonomous CapCut Specialist Draft Execution
    const isCapCutTask = isCapCutSpecialist || (
      /\b(?:capcut|tiktok\s*reel|reel\s*project|video\s*clip|build\s*(?:the\s*)?draft|0930\.mp4)\b/i.test(msgLower) &&
      /\b(?:video|clip|short|reel|tiktok|subtitles?|aspect\s*ratio|capcut)\b/i.test(msgLower)
    );

    if (isCapCutTask) {
      try {
        const contract = await extractCapCutTaskContract(content, settings);
        if (contract && contract.videos && contract.videos.length > 0) {
          const runRes = await executeCapCutDraftGeneration(contract);
          usedProvider = 'CineCut Studio (.ruxt)';
          usedModel = 'Zero-Mouse Draft Synthesizer';

          const subListMd = (contract.subtitles || []).map((s, idx) => 
            `  ${idx + 1}. "${s.text}" (${s.start}s – ${s.start + s.duration}s)`
          ).join('\n');

          systemPrompt = `--- CAPCUT DRAFT TASK COMPLETED ---
You have successfully generated and launched a CapCut Desktop draft:
- Project Title: "${contract.title}"
- Aspect Ratio: ${contract.ratio} (Vertical TikTok/Reels Preset)
- Primary Video Track: ${contract.videos[0].path} (Start: ${contract.videos[0].start}s, Duration: ${contract.videos[0].duration}s)
${subListMd ? `- Subtitles (${contract.subtitles.length} tracks):\n${subListMd}` : ''}
- Draft Location: %LOCALAPPDATA%\\CapCut\\User Data\\Projects\\com.lveditor.draft\\${contract.title}
- Status: The CapCut Desktop timeline has been prepared and opened on the user's desktop screen.

Respond dynamically to the user in their language (Sinhala/English). Acknowledge that the project draft has been synthesized and launched, summarize the key timeline specs, and explain what they will see on screen.
-----------------------------------\n\n${systemPrompt}`;
        }
      } catch (capErr) {
        console.warn('[CapCut Execution Warning]:', capErr.message);
      }
    }

    // Negative Filter: Never trigger desktop controller for software, web, coding, design or business development tasks
    const isSoftwareOrWebTask = !isCapCutTask && /\b(?:web\s*site|website|web\s*app|html|css|react|javascript|js|node|python|code|coding|api|database|db|sqlite|sql|sell|store|ecommerce|shop|design|figma|backend|frontend|system|component|mockup|ui|landing\s*page)\b/i.test(msgLower);

    let isDesktopIntent = false;
    let targetDesktopGoal = cleanPrompt || rawContent;

    if (hasSlashPcControl) {
      isDesktopIntent = true;
      targetDesktopGoal = cleanPrompt || 'inspect desktop screen and report active applications';
    } else if (isRuXtLeader && !isNaturalPlanning && !isSoftwareOrWebTask) {
      // Natural language desktop automation - MUST be unambiguous physical computer manipulation
      const isExplicitPcControlPhrase = (
        /(?:pc|desktop|screen|computer)\s*(?:eka|screen)?\s*(?:control|operate)\s*(?:karala|karanna)/i.test(msgLower) ||
        /(?:control|operate)\s+(?:my\s+)?(?:pc|desktop|screen|computer)\b/i.test(msgLower) ||
        /(?:open|launch|run)\s+(?:karala\s+)?(?:notepad|calculator|calc|mspaint|paint|excel|word|powerpoint)\b/i.test(msgLower) ||
        /(?:notepad|calculator|mspaint|paint|calc)\s*(?:eka)?\s*(?:open|launch|run)\s*(?:karala|karanna)?/i.test(msgLower)
      );

      if (isExplicitPcControlPhrase) {
        isDesktopIntent = true;
      }
    }

    if (isDesktopIntent && !desktopAutomationSupported()) {
      isDesktopIntent = false;
      systemPrompt = `--- NOTICE ---
${DESKTOP_UNSUPPORTED_MESSAGE} Tell the user this politely and offer to help another way.
---

${systemPrompt}`;
    }

    if (isDesktopIntent) {
      try {
        const job = await startVisionDesktopExecution({
          goal: targetDesktopGoal,
          settings,
          sessionId
        });

        desktopAction = {
          jobId: job.id,
          taskTitle: targetDesktopGoal,
          appName: 'DESKTOP',
          steps: job.steps
        };
        usedProvider = 'RuXt Live Engine';
        usedModel = 'Autonomous Desktop Controller';

        systemPrompt = `--- AUTONOMOUS LIVE PC CONTROL STATUS ---
An autonomous desktop execution job (Job ID: ${job.id}) has been launched for goal: "${targetDesktopGoal}".
The desktop operator is actively controlling the application on the user's screen.
Respond dynamically to the user in their language (Sinhala/English). Confirm that you have taken control of the screen to execute their goal, and explain what they will see happening live.
-----------------------------------------\n\n${systemPrompt}`;
      } catch (deskErr) {
        console.warn('[Vision Operator Error]:', deskErr.message);
      }
    }

    const isSpecialistCollaborationIntent = isRuXtLeader && !isDesktopIntent && (
      /\b(?:collaborat(?:e|ing|ion)|colabarate|board\s*room|boardroom|executive\s*board|squad|team)\b/i.test(msgLower)
    );

    // Direct Board Room Deliberation when user initiates multi-agent task or collaboration
    if (isSpecialistCollaborationIntent) {
      try {
        const cleanTopic = cleanPrompt || content;
        const boardroomResult = await conductBoardroomMeeting({
          topic: cleanTopic,
          squadName: 'RuXt Specialist Executive Board',
          sessionId,
          settings
        });

        boardroomData = {
          id: boardroomResult.boardroomSession.id,
          session: boardroomResult.boardroomSession,
          messages: boardroomResult.messages,
          tasks: boardroomResult.tasks,
          decision: boardroomResult.decision,
          isLive: true
        };

        const squadNames = (boardroomResult.squad || []).map(s => `${s.name} (${s.role})`).join(', ') || 'Julian Vance, Damon Cole, RuXt';

        systemPrompt = `--- EXECUTIVE BOARD ROOM CONVENED ---
You convened the Specialist Executive Board for the project topic: "${cleanTopic}".
- Active Squad: ${squadNames}
- Consensus Reached: "${boardroomResult.decision}"
- Kanban Tasks Created: ${boardroomResult.tasks.length} tasks scheduled on the Roadmap.

Respond dynamically to the user as Chief of Staff in the language they used (Sinhala/English).
Deliver an authentic executive briefing: summarize the consensus decision reached with the squad, explain the high-level roadmap, and mention that the live deliberation transcript and Kanban tasks are available in the Board Room panel on the right.
-------------------------------------\n\n${systemPrompt}`;
      } catch (bErr) {
        console.warn('[Direct Boardroom Deliberation Error]:', bErr.message);
      }
    }

    let result = null;
    // 100% Real-Time Dynamic AI Generation (Zero Hardcoding) via activeProvider
    try {
      const convTitle = session?.title || 'Chat';
      result = await generateAIResponse({
        provider: activeProvider,
          model: activeModel,
          systemPrompt,
          userMessage: content,
          history,
          settings,
          conversationTitle: convTitle,
          agentSlug,
          agentName,
          agentRole,
          existingConversationId: session?.antigravity_conversation_id,
          projectCwd: process.cwd()
        });

        replyContent = result.content;
        usedProvider = result.provider;
        usedModel = result.model;
        mcpEvents = Array.isArray(result.mcpEvents) ? result.mcpEvents : [];

        // Persist Antigravity conversation ID to ensure seamless single-flow chat continuity in IDE
        if (result.conversationId && result.conversationId !== session?.antigravity_conversation_id) {
          db.prepare('UPDATE chat_sessions SET antigravity_conversation_id = ? WHERE id = ?').run(result.conversationId, sessionId);
        }
      } catch (genErr) {
        console.warn(`[AI Generation Warning (${activeProvider})]:`, genErr.message);

        replyContent = `Hello! I am **${agentName}** (${agentRole}).\n\n*(Could not connect to the external AI Engine: ${genErr.message}. Please verify your API Key or host bridge in Settings.)*`;
      }

    // 2. Insert assistant response with metadata
    const assistantMsgId = randomUUID();
    const metadataStr = JSON.stringify({
      dispatch: dispatchData,
      quickReplies,
      workflowState,
      desktopAction,
      boardroom: boardroomData,
      mcpEvents
    });

    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, metadata)
      VALUES (?, ?, 'assistant', ?, ?)
    `).run(assistantMsgId, sessionId, replyContent, metadataStr);

    // 4. Log activity
    db.prepare(`
      INSERT INTO activity_logs (type, message, details)
      VALUES ('chat', ?, ?)
    `).run(`Message handled by ${agentName} via ${usedProvider}`, JSON.stringify({ sessionId, provider: usedProvider, model: usedModel, dispatch: dispatchData, desktopAction, boardroomId: boardroomData?.id }));

    const userMessage = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(userMsgId);
    const assistantMessage = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(assistantMsgId);

    res.json({
      success: true,
      userMessage,
      assistantMessage,
      dispatch: dispatchData,
      quickReplies,
      workflowState,
      desktopAction,
      boardroom: boardroomData,
provider: usedProvider,
      model: usedModel
    });
  } catch (err) {
    console.error('[Chat API Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    activeSessionAbortControllers.delete(sessionId);
  }
});

export default router;
