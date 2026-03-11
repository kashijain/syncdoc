'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/useAuthStore';
import { PlusCircle, FileText, Share2, Trash2, Edit2, LogOut } from 'lucide-react';
import axios from 'axios';

interface Collaborator {
  user: string;
  role: string;
}

interface Document {
  _id: string;
  title: string;
  owner: string;
  collaborators: Collaborator[];
  updatedAt: string;
}

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchDocuments = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const { data } = await axios.get(`${API_URL}/documents`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setDocuments(data);
      } catch (error) {
        console.error('Error fetching docs', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [user, router]);

  const handleCreateDocument = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const { data } = await axios.post(
        `${API_URL}/documents`,
        { title: 'Untitled Document' },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      router.push(`/document/${data._id}`);
    } catch (error) {
      console.error('Failed to create document');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      setDocuments((docs) => docs.filter((d) => d._id !== id));
      await axios.delete(`${API_URL}/documents/${id}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
    } catch (error) {
      console.error('Failed to delete document');
      // Re-fetch on error to revert optimistic update ideally
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow border-b border-slate-200">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">SyncDoc Workspace</h1>
          <div className="flex items-center space-x-4">
            <span className="text-slate-600">Hello, {user?.name}</span>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-semibold text-slate-800">Your Documents</h2>
          <button
            onClick={handleCreateDocument}
            className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            New Document
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-slate-200 shadow-sm block">
            <FileText className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No documents</h3>
            <p className="mt-1 text-sm text-slate-500">Get started by creating a new document.</p>
            <div className="mt-6">
              <button
                onClick={handleCreateDocument}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusCircle className="mr-2 -ml-1 h-5 w-5" />
                New Document
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <div
                key={doc._id}
                onClick={() => router.push(`/document/${doc._id}`)}
                className="bg-white overflow-hidden shadow-sm rounded-lg border border-slate-200 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-6 w-6 text-indigo-500" />
                      <h3 className="ml-3 text-lg font-medium text-slate-900 truncate" title={doc.title}>
                        {doc.title}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                    <div>
                      {doc.owner === user?._id ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Owner
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Shared with you
                        </span>
                      )}
                    </div>
                    <div>
                      Last updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {doc.owner === user?._id && (
                  <div className="bg-slate-50 px-6 py-3 flex justify-end space-x-3 border-t border-slate-100">
                    <button
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Share"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Open share modal
                      }}
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button
                      className="text-slate-400 hover:text-red-600 transition-colors"
                      title="Delete document"
                      onClick={(e) => handleDelete(e, doc._id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
