import { Request, Response, NextFunction } from 'express';
import Document, { RoleType } from '../models/Document';

export const requireRole = (roles: RoleType[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const documentId = req.params.id;
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const document = await Document.findById(documentId);
      if (!document) {
        res.status(404).json({ message: 'Document not found' });
        return;
      }

      const isOwner = document.owner.toString() === user._id.toString();

      let userRole: RoleType | null = null;

      if (isOwner) {
        userRole = RoleType.OWNER;
      } else {
        const collab = document.collaborators.find(
          (c) => c.user.toString() === user._id.toString()
        );
        if (collab) {
          userRole = collab.role;
        }
      }

      if (!userRole) {
        res.status(403).json({ message: 'Forbidden. No access to this document.' });
        return;
      }

      if (!roles.includes(userRole)) {
        res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
        return;
      }

      // Pass the role and document to next middleware if needed
      (req as any).userRole = userRole;
      (req as any).document = document;

      next();
    } catch (error) {
      res.status(500).json({ message: 'Server error checking permissions' });
    }
  };
};
