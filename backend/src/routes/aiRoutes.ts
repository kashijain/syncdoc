import express from 'express';
import { streamInsights } from '../controllers/aiController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/insights', protect, streamInsights);

export default router;
