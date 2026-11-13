import { Router } from 'express';
import db from '../db.js';
import { randomUUID } from 'crypto';
import { discoverActiveAgents, resolveStageAgent } from '../services/orchestrator.js';

const router = Router();

// Get all tasks
router.get('/', (req, res) => {
  try {
    const { boardroom_id } = req.query;
    let tasks;
    if (boardroom_id) {
      tasks = db.prepare('SELECT * FROM tasks WHERE boardroom_id = ? ORDER BY order_index ASC, created_at ASC').all(boardroom_id);
    } else {
      tasks = db.prepare('SELECT * FROM tasks ORDER BY order_index ASC, created_at DESC').all();
    }
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create task
router.post('/', (req, res) => {
  try {
    const { title, description, priority, agent_id, status, order_index, boardroom_id, deliverable_output } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const id = randomUUID();
    const taskStatus = status || 'backlog';
    const taskPriority = priority || 'medium';
    const order = typeof order_index === 'number' ? order_index : 0;

    db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, agent_id, order_index, boardroom_id, deliverable_output)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, description || '', taskStatus, taskPriority, agent_id || null, order, boardroom_id || null, deliverable_output || null);

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update task
router.patch('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, agent_id, order_index, deliverable_output } = req.body;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    db.prepare(`
      UPDATE tasks 
      SET title = COALESCE(?, title),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          agent_id = COALESCE(?, agent_id),
          order_index = COALESCE(?, order_index),
          deliverable_output = COALESCE(?, deliverable_output),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, description, status, priority, agent_id, order_index, deliverable_output, id);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json({ success: true, task: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete task
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Dynamic Multi-Stage Pipeline Planner with New Agent Identification
router.post('/pipeline/plan', (req, res) => {
  try {
    const { topic, stages: customStages } = req.body || {};
    if (!topic || !topic.trim()) {
      return res.status(400).json({ success: false, error: 'Topic / project goal is required' });
    }

    const cleanTopic = topic.trim();
    const activeAgents = discoverActiveAgents();

    const stageTemplates = Array.isArray(customStages) && customStages.length > 0
      ? customStages
      : [
          { name: 'Frontend Architecture & Responsive UI', query: 'frontend react tailwind ui ux design ' + cleanTopic },
          { name: 'Backend API & Distributed Data Layer', query: 'backend database postgres api nodejs docker ' + cleanTopic },
          { name: 'Domain Specialist Integration & Audit', query: 'seo traffic compliance tax strategy ' + cleanTopic },
          { name: 'RuXt Leader QA & Acceptance Sign-off', query: 'ruxt qa verification orchestrator signoff' }
        ];

    const plannedStages = stageTemplates.map((stage, idx) => {
      const assigned = stage.query.includes('ruxt qa')
        ? { slug: 'ruxt', name: 'RuXt Leader', role: 'Local Engine Orchestrator' }
        : resolveStageAgent(stage.query || stage.name, activeAgents);

      return {
        orderIndex: idx,
        title: `[Stage ${idx + 1}] ${stage.name || stage.title}`,
        assignedAgent: {
          slug: assigned.slug,
          name: assigned.name,
          role: assigned.role
        },
        description: `Execute ${stage.name || stage.title} for "${cleanTopic}" with accumulated pipeline context.`
      };
    });

    res.json({
      success: true,
      topic: cleanTopic,
      availableAgentsCount: activeAgents.length,
      stages: plannedStages
    });
  } catch (err) {
    console.error('Pipeline plan error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
