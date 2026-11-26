import { Router } from 'express';
import {
  listPendingApprovals,
  resolveApproval,
  listGrants,
  revokeTool
} from '../services/agentTools.js';

const router = Router();

// Tool calls waiting for the user's yes/no (shown as a prompt in the app)
router.get('/', (_req, res) => {
  res.json({ success: true, pending: listPendingApprovals() });
});

router.post('/:id', (req, res) => {
  const result = resolveApproval(req.params.id, req.body?.decision);
  res.status(result.success ? 200 : result.error === 'No such approval is pending' ? 404 : 400).json(result);
});

// Tools the user chose to stop being asked about ("first-use" approvals)
router.get('/grants/list', (_req, res) => {
  res.json({ success: true, grants: listGrants() });
});

router.delete('/grants/:agentSlug/:tool', (req, res) => {
  const removed = revokeTool(req.params.agentSlug, req.params.tool);
  res.status(removed ? 200 : 404).json({ success: removed });
});

export default router;
