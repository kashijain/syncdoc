import express from 'express';
import { upload } from '../utils/cloudinary';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/', protect, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }
    res.status(200).json({
      message: 'File uploaded successfully',
      url: req.file.path,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading file' });
  }
});

export default router;
