import express from 'express';
import * as ctrl from '../controllers/conversationController.js';
import authMiddleware from '../middleware/auth.js';
const router = express.Router();

router.use(authMiddleware);

router.get('/', ctrl.listConversations);
router.post('/', ctrl.createConversation);
router.get('/:conversationId', ctrl.getConversation);
router.put('/:conversationId', ctrl.updateConversation);
router.post('/:conversationId/members', ctrl.addMember);
router.delete('/:conversationId/members/:userId', ctrl.removeMember);
router.post('/:conversationId/admins', ctrl.addAdmin);
router.delete('/:conversationId/admins/:userId', ctrl.removeAdmin);
router.delete('/:conversationId', ctrl.deleteConversation);

export default router; 