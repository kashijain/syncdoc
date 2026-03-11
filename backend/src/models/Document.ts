import mongoose, { Document as MongooseDoc, Schema } from 'mongoose';

export enum RoleType {
  OWNER = 'Owner',
  EDITOR = 'Editor',
  VIEWER = 'Viewer',
}

interface Collaborator {
  user: mongoose.Types.ObjectId;
  role: RoleType;
}

export interface IDocument extends MongooseDoc {
  title: string;
  content: string; // Tiptap HTML or JSON string
  owner: mongoose.Types.ObjectId;
  collaborators: Collaborator[];
}

const documentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: true,
      default: 'Untitled Document',
    },
    content: {
      type: String,
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    collaborators: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: Object.values(RoleType),
          default: RoleType.VIEWER,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);

export default DocumentModel;
