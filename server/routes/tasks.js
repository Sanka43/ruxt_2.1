import { Router } from 'express';
import db from '../db.js';
import { randomUUID } from 'crypto';

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

export default router;
