import express from 'express';
import * as ctrl from '../controllers/conversationController.js';
import authMiddleware from '../middleware/auth.js';
import inputValidation from '../middleware/inputValidation.js';
const router = express.Router();

router.use(authMiddleware);

router.get('/', ctrl.listConversations);
router.post('/', inputValidation.sanitizeConversationData, ctrl.createConversation);
router.get('/:conversationId', inputValidation.validateObjectId('conversationId'), ctrl.getConversation);
router.put('/:conversationId', inputValidation.validateObjectId('conversationId'), inputValidation.sanitizeConversationData, ctrl.updateConversation);
router.put('/:conversationId/read', inputValidation.validateObjectId('conversationId'), ctrl.markConversationAsRead);
router.post('/:conversationId/members', inputValidation.validateObjectId('conversationId'), ctrl.addMember);
router.delete('/:conversationId/members/:userId', inputValidation.validateObjectId('conversationId'), inputValidation.validateObjectId('userId'), ctrl.removeMember);
router.post('/:conversationId/admins', inputValidation.validateObjectId('conversationId'), ctrl.addAdmin);
router.delete('/:conversationId/admins/:userId', inputValidation.validateObjectId('conversationId'), inputValidation.validateObjectId('userId'), ctrl.removeAdmin);
router.delete('/:conversationId', inputValidation.validateObjectId('conversationId'), ctrl.deleteConversation);

export default router; 