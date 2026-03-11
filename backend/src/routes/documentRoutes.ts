import express from 'express';
import {
  createDocument,
  getMyDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  shareDocument,
} from '../controllers/documentController';
import { protect } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { RoleType } from '../models/Document';

const router = express.Router();

router.route('/')
  .post(protect, createDocument)
  .get(protect, getMyDocuments);

router.route('/:id')
  .get(protect, requireRole([RoleType.OWNER, RoleType.EDITOR, RoleType.VIEWER]), getDocumentById)
  .put(protect, requireRole([RoleType.OWNER, RoleType.EDITOR]), updateDocument)
  .delete(protect, requireRole([RoleType.OWNER]), deleteDocument);

router.post('/:id/share', protect, requireRole([RoleType.OWNER]), shareDocument);

export default router;
