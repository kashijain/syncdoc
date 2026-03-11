import { Request, Response } from 'express';
import Document, { RoleType } from '../models/Document';
import User from '../models/User';

// @desc    Create a new document
// @route   POST /api/documents
// @access  Private
export const createDocument = async (req: Request, res: Response): Promise<void> => {
  const { title } = req.body;
  const user = (req as any).user;

  try {
    const document = await Document.create({
      title: title || 'Untitled Document',
      owner: user._id,
      collaborators: [],
    });

    res.status(201).json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error creating document' });
  }
};

// @desc    Get all documents for a user (owned & collaborated)
// @route   GET /api/documents
// @access  Private
export const getMyDocuments = async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;

  try {
    const documents = await Document.find({
      $or: [
        { owner: user._id },
        { 'collaborators.user': user._id }
      ]
    }).sort({ updatedAt: -1 });

    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching documents' });
  }
};

// @desc    Get document by ID
// @route   GET /api/documents/:id
// @access  Private
export const getDocumentById = async (req: Request, res: Response): Promise<void> => {
  // Document is attached by requireRole middleware
  const document = (req as any).document;
  res.json(document);
};

// @desc    Update document content or title
// @route   PUT /api/documents/:id
// @access  Private (Owner or Editor)
export const updateDocument = async (req: Request, res: Response): Promise<void> => {
  const document = (req as any).document;
  const { title, content } = req.body;

  try {
    if (title) document.title = title;
    if (content !== undefined) document.content = content;

    const updatedDocument = await document.save();
    res.json(updatedDocument);
  } catch (error) {
    res.status(500).json({ message: 'Error updating document' });
  }
};

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Private (Owner only)
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  const document = (req as any).document;

  try {
    await document.deleteOne();
    res.json({ message: 'Document removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document' });
  }
};

// @desc    Share document (manage collaborators)
// @route   POST /api/documents/:id/share
// @access  Private (Owner only)
export const shareDocument = async (req: Request, res: Response): Promise<void> => {
  const document = (req as any).document;
  const { email, role } = req.body;

  try {
    const shareUser = await User.findOne({ email });
    if (!shareUser) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (shareUser._id.toString() === document.owner.toString()) {
      res.status(400).json({ message: 'Cannot share with owner' });
      return;
    }

    // Check if user is already a collaborator
    const existingCollab = document.collaborators.find(
      (c: any) => c.user.toString() === shareUser._id.toString()
    );

    if (existingCollab) {
      existingCollab.role = role;
    } else {
      document.collaborators.push({ user: shareUser._id, role });
    }

    await document.save();
    res.json({ message: 'Document shared successfully', document });
  } catch (error) {
    res.status(500).json({ message: 'Error sharing document' });
  }
};
