import { Router } from 'express';
import db from '../db.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const agentsDir = process.env.RUXT_AGENTS_DIR || path.resolve(__dirname, '../../agents');

function getAgentPersonaContext(slug) {
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

  // 3. If agent is RuXt (Leader), inject active team context
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

// Send message & get agent response via selected multi-provider brain
router.post('/sessions/:id/messages', async (req, res) => {
  try {
    const { id: sessionId } = req.params;
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

    const DEFAULT_SPECIALISTS_MAP = {
      'julian-vance': { name: 'Julian Vance', role: 'Senior Frontend Web Developer' },
      'maya-brooks': { name: 'Maya Brooks', role: 'Chief Financial Analyst' },
      'noah-reed': { name: 'Noah Reed', role: 'Security & Cloud DevOps' },
      'elena-voss-chess': { name: 'Elena Voss', role: 'Strategic Game Intelligence' },
      'marcus-sterling': { name: 'Marcus Sterling', role: 'Enterprise Legal Counsel' },
      'numbers': { name: 'Numbers', role: 'Quantitative Data Analyst' },
      'ruxt': { name: 'RuXt', role: 'Team Leader & Engine Orchestrator' }
    };

    // 1. Check for @mention in content to dynamically route/consult specialist
    let isMentioned = false;
    try {
      const allAgents = db.prepare('SELECT id, name, slug, role FROM agents').all();
      for (const [sKey, sVal] of Object.entries(DEFAULT_SPECIALISTS_MAP)) {
        if (!allAgents.some(a => a.slug === sKey)) {
          allAgents.push({ id: sKey, name: sVal.name, slug: sKey, role: sVal.role });
        }
      }
      // Sort descending by name length so multi-word names like "Julian Vance" match before shorter terms
      allAgents.sort((a, b) => b.name.length - a.name.length);
      for (const a of allAgents) {
        const safeName = a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const safeSlug = a.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      } else if (DEFAULT_SPECIALISTS_MAP[agentSlug]) {
        agentName = DEFAULT_SPECIALISTS_MAP[agentSlug].name;
        agentRole = DEFAULT_SPECIALISTS_MAP[agentSlug].role;
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

    // Load full persona & skills definition
    const personaContext = getAgentPersonaContext(agentSlug);

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

    if (hasSlashLearn) {
      systemPrompt = `--- WORKSPACE LEARNING DIRECTIVE ---
The user explicitly invoked /learn to teach or memorize this guideline/skill: "${cleanPrompt}".
Acknowledge the instruction clearly, state how you have internalized this into your operating principles, and explain how it will shape all future workflows in this workspace.
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
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
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

    // 3. Strict & Safe Desktop Automation Intent Classification
    const isRuXtLeader = agentSlug === 'ruxt';

    // Negative Filter: Never trigger desktop controller for software, web, coding, design or business development tasks
    const isSoftwareOrWebTask = /\b(?:web\s*site|website|web\s*app|html|css|react|javascript|js|node|python|code|coding|api|database|db|sqlite|sql|sell|store|ecommerce|shop|design|figma|backend|frontend|system|component|mockup|ui|landing\s*page)\b/i.test(msgLower);

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

    if (isDesktopIntent) {
      try {
        const job = await startVisionDesktopExecution({
          goal: targetDesktopGoal,
          settings,
          sessionId
        });

        desktopAction = null;
        usedProvider = 'RuXt Live Engine';
        usedModel = 'Autonomous Desktop Controller';

        replyContent = 
          `⚡ **RuXt Autonomous Live PC Control Activated!**\n\n` +
          `මම ඔබේ පරිගණකයේ සැබෑ Screen එක direct access කරමින් කාර්යය (*${targetDesktopGoal}*) සජීවීව ආරම්භ කළා! 🚀\n\n` +
          `• **Physical Execution:** Windows Application එක Screen එක ඉදිරියට (Foreground) පැමිණෙන අතර, Mouse Cursor එක සහ Keyboard Typing සජීවීව ඔබේ ඇස් ඉදිරිපිට ක්‍රියාත්මක වේ.\n` +
          `• **Screen Status:** දැන් ඔබේ Physical Monitor Screen එක මත සජීවීව කාර්යය සිදුවන ආකාරය බලන්න!`;
      } catch (deskErr) {
        console.warn('[Vision Operator Error]:', deskErr.message);
      }
    }

    const isSessionInWorkflow = session?.workflow_state === 'CONSULTING' || session?.workflow_state === 'ASSIGNING';
    const isExplicitWorkflowTrigger = msgLower.startsWith('🚗') || msgLower.startsWith('🛍️') || msgLower.startsWith('🌴') || msgLower.startsWith('⚡') || msgLower.startsWith('🚀') || msgLower.includes('write the files to disk immediately');

    const isSpecialistCollaborationIntent = isRuXtLeader && !isDesktopIntent && (
      isSessionInWorkflow || 
      isExplicitWorkflowTrigger ||
      /\b(?:collaborat(?:e|ing|ion)|colabarate|board\s*room|boardroom|executive\s*board|squad|team)\b/i.test(msgLower) ||
      /\b(?:julian(?:\s+vance)?|damon(?:\s+cole)?|noah(?:\s+reed)?|maya(?:\s+brooks)?|elena(?:\s+voss)?)\b/i.test(msgLower) ||
      (isNaturalPlanning && /\b(?:build|create|develop|hadanna|storefront|website|web\s*app|saas|platform|system|portal|fleet|rental|shop)\b/i.test(msgLower))
    );

    // 1. Try structured orchestrated workflow first
    if (!replyContent && isRuXtLeader && (isSessionInWorkflow || isExplicitWorkflowTrigger)) {
      try {
        const orchestrated = await handleOrchestratedConversation({
          sessionId,
          userMessage: content,
          history,
          settings
        });

        if (orchestrated && (orchestrated.dispatch || orchestrated.workflowState === 'CONSULTING' || orchestrated.workflowState === 'DELIVERED')) {
          replyContent = orchestrated.content;
          dispatchData = orchestrated.dispatch || null;
          quickReplies = orchestrated.quickReplies || null;
          workflowState = orchestrated.workflowState || null;
          boardroomData = orchestrated.boardroom || null;
          usedProvider = 'RuXt Orchestrator';
          usedModel = 'Inter-Agent Consensus Engine';
        }
      } catch (orchErr) {
        console.warn('[Orchestration Warning]:', orchErr.message);
      }
    }

    // 2. Direct Board Room Deliberation when user initiates multi-agent task or collaboration
    if (!replyContent && isSpecialistCollaborationIntent) {
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

        replyContent = 
          `🎯 **Executive Board Room Convened!** 🚀\n\n` +
          `මම ඔබේ කාර්යය (*"${cleanTopic}"*) අපේ **Specialist Executive Board** (Julian Vance, Damon Cole, RuXt) වෙත ඉදිරිපත් කර Board Room සාකච්ඡාව සජීවීව ආරම්භ කළා!\n\n` +
          `• **Lead Agent:** RuXt (Engine Orchestrator)\n` +
          `• **Active Squad:** [Julian Vance (Frontend Lead), Damon Cole (Systems Architect), RuXt]\n` +
          `• **Live Deliberation:** දකුණු පස ඇති Board Room panel එකෙන් කණ්ඩායමේ සජීවී සාකච්ඡාව (Live Deliberation) දැන් සජීවීව නැරඹිය හැක.\n` +
          `• **Pipeline Tasks:** සම්මුතියට (${boardroomResult.decision}) පැමිණි පසු අදාළ ${boardroomResult.tasks.length} tasks ස්වයංක්‍රීයව Kanban පුවරුවට එක් කෙරේ.\n\n` +
          `*(සජීවී සාකච්ඡාව නැරඹීමට හෝ කාර්යයන් පියවරෙන් පියවර ක්‍රියාත්මක කිරීමට Board Room panel එක විවෘත කරන්න!)*`;

        usedProvider = 'RuXt Orchestrator';
        usedModel = 'Inter-Agent Consensus Engine';
      } catch (bErr) {
        console.warn('[Direct Boardroom Deliberation Error]:', bErr.message);
      }
    }

    // Real-Time Dynamic AI Generation (Zero Hardcoding) if not handled by team dispatch
    if (!replyContent) {
      try {
        const convTitle = session?.title || 'Chat';
        const result = await generateAIResponse({
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

        // Persist Antigravity conversation ID to ensure seamless single-flow chat continuity in IDE
        if (result.conversationId && result.conversationId !== session?.antigravity_conversation_id) {
          db.prepare('UPDATE chat_sessions SET antigravity_conversation_id = ? WHERE id = ?').run(result.conversationId, sessionId);
        }
      } catch (genErr) {
        console.warn(`[AI Generation Warning (${activeProvider})]:`, genErr.message);

        replyContent = `Hello! I am **${agentName}** (${agentRole}).\n\n*(Could not connect to the external AI Engine: ${genErr.message}. Please verify your API Key or host bridge in Settings.)*`;
      }
    }

    // 2. Insert assistant response with metadata
    const assistantMsgId = randomUUID();
    const metadataStr = JSON.stringify({
      dispatch: dispatchData,
      quickReplies,
      workflowState,
      desktopAction,
      boardroom: boardroomData
    });

    db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, metadata)
      VALUES (?, ?, 'assistant', ?, ?)
    `).run(assistantMsgId, sessionId, replyContent, metadataStr);

    // 3. Log activity
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
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
