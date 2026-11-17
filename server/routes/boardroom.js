import { Router } from 'express';
import db from '../db.js';
import { conductBoardroomMeeting, executeTaskStep, runAutonomousPipeline } from '../services/orchestrator.js';

const router = Router();

// 1. Get latest or active Board Room session
router.get('/active', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM boardroom_sessions ORDER BY created_at DESC LIMIT 1').get();
    if (!session) {
      return res.json({ success: true, session: null, messages: [], tasks: [] });
    }

    const messages = db.prepare(`
      SELECT * FROM boardroom_messages 
      WHERE boardroom_id = ? 
      ORDER BY created_at ASC
    `).all(session.id);

    const tasks = db.prepare(`
      SELECT * FROM tasks 
      WHERE boardroom_id = ? 
      ORDER BY order_index ASC, created_at ASC
    `).all(session.id);

    res.json({
      success: true,
      session,
      messages,
      tasks
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Start a new Board Room deliberation
router.post('/start', async (req, res) => {
  try {
    const { topic, squadName, sessionId } = req.body;
    if (!topic || !topic.trim()) {
      return res.status(400).json({ success: false, error: 'Topic / project goal is required' });
    }

    const result = await conductBoardroomMeeting({
      topic: topic.trim(),
      squadName: squadName || 'RuXt Specialist Executive Board',
      sessionId: sessionId || null
    });

    res.json({
      success: true,
      session: result.boardroomSession,
      messages: result.messages,
      tasks: result.tasks,
      decision: result.decision,
      isLive: true
    });
  } catch (err) {
    console.error('Boardroom start error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2b. Server-Sent Events (SSE) stream for live inter-agent deliberation
router.get('/stream/:id', async (req, res) => {
  const { id } = req.params;
  const speed = req.query.speed || '1x'; // '1x', '2x', 'instant'

  try {
    const session = db.prepare('SELECT * FROM boardroom_sessions WHERE id = ?').get(id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Boardroom session not found' });
    }

    const messages = db.prepare(`
      SELECT * FROM boardroom_messages 
      WHERE boardroom_id = ? 
      ORDER BY created_at ASC
    `).all(id);

    const tasks = db.prepare(`
      SELECT * FROM tasks 
      WHERE boardroom_id = ? 
      ORDER BY order_index ASC, created_at ASC
    `).all(id);

    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    let isClosed = false;
    req.on('close', () => {
      isClosed = true;
    });

    const sendEvent = (event, data) => {
      if (isClosed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Initial session announcement
    sendEvent('session', { session, squad: session.squad_name });

    // Instant delivery if requested
    if (speed === 'instant') {
      for (const msg of messages) {
        if (isClosed) break;
        sendEvent('message', msg);
      }
      sendEvent('consensus', { decision: session.decision, status: 'consensus_reached' });
      sendEvent('tasks', tasks);
      sendEvent('done', { id });
      return res.end();
    }

    // Paced live streaming
    const turnDelay = speed === '2x' ? 450 : 1100;
    const messagePause = speed === '2x' ? 250 : 550;

    for (let i = 0; i < messages.length; i++) {
      if (isClosed) break;
      const msg = messages[i];

      // 1. Announce active speaker turn
      sendEvent('speaker_turn', {
        index: i + 1,
        total: messages.length,
        agent_slug: msg.agent_slug,
        agent_name: msg.agent_name,
        agent_role: msg.agent_role,
        phase: msg.phase,
        time: msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      await new Promise(r => setTimeout(r, turnDelay));
      if (isClosed) break;

      // 2. Deliver speaker's dialogue
      sendEvent('message', msg);

      await new Promise(r => setTimeout(r, messagePause));
    }

    if (!isClosed) {
      sendEvent('consensus', { decision: session.decision, status: 'consensus_reached' });
      sendEvent('tasks', tasks);
      sendEvent('done', { id });
      res.end();
    }
  } catch (err) {
    console.error('SSE Stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.end();
    }
  }
});

// 3. Get specific Board Room session by ID
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const session = db.prepare('SELECT * FROM boardroom_sessions WHERE id = ?').get(id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Boardroom session not found' });
    }

    const messages = db.prepare(`
      SELECT * FROM boardroom_messages 
      WHERE boardroom_id = ? 
      ORDER BY created_at ASC
    `).all(id);

    const tasks = db.prepare(`
      SELECT * FROM tasks 
      WHERE boardroom_id = ? 
      ORDER BY order_index ASC, created_at ASC
    `).all(id);

    res.json({
      success: true,
      session,
      messages,
      tasks
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Execute the next step in this Board Room's task pipeline
router.post('/:id/execute-next', async (req, res) => {
  try {
    const { id } = req.params;
    const pendingTask = db.prepare(`
      SELECT * FROM tasks 
      WHERE boardroom_id = ? AND status != 'done' 
      ORDER BY order_index ASC LIMIT 1
    `).get(id);

    if (!pendingTask) {
      return res.json({
        success: true,
        message: 'All tasks in this boardroom pipeline have already been completed!',
        completed: true
      });
    }

    const result = await executeTaskStep({ taskId: pendingTask.id });

    // Fetch all current tasks
    const allTasks = db.prepare('SELECT * FROM tasks WHERE boardroom_id = ? ORDER BY order_index ASC').all(id);

    res.json({
      success: true,
      executedTask: result.task,
      tasks: allTasks,
      progress: result.progress
    });
  } catch (err) {
    console.error('Execute next step error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Execute all remaining tasks in this Board Room sequentially
router.post('/:id/execute-all', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await runAutonomousPipeline({ boardroomId: id });

    res.json({
      success: true,
      message: `Successfully executed ${result.stagesExecuted} tasks to completion!`,
      tasks: result.tasks,
      progress: {
        completedCount: result.completedCount,
        totalCount: result.totalCount,
        progressPercent: result.progressPercent,
        nextTask: null
      }
    });
  } catch (err) {
    console.error('Execute all steps error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Autonomous continuous pipeline loop with dynamic agent handoffs
router.post('/:id/auto-continue', async (req, res) => {
  try {
    const { id } = req.params;
    const { maxStages } = req.body || {};
    const result = await runAutonomousPipeline({ boardroomId: id, maxStages: maxStages || 10 });

    res.json({
      success: true,
      message: result.isFullyCompleted
        ? 'Autonomous pipeline finished all stages successfully!'
        : `Autonomous pipeline progressed ${result.stagesExecuted} stage(s).`,
      result
    });
  } catch (err) {
    console.error('Auto continue error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
