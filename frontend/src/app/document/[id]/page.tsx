'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Bot, Save, FileImage, Send, Loader2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

export default function DocumentPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { user } = useAuthStore();
  const router = useRouter();

  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  
  const [docTitle, setDocTitle] = useState<string>('Loading...');
  const [role, setRole] = useState<string>('');
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    // 1. Fetch Document Metadata and Role
    const fetchDoc = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const { data } = await axios.get(`${API_URL}/documents/${id}`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        setDocTitle(data.title);
        
        if (data.owner === user._id) {
           setRole('Owner');
        } else {
           const collab = data.collaborators.find((c: any) => c.user === user._id || c.user?._id === user._id);
           if (collab) setRole(collab.role);
        }
      } catch (err) {
         console.error('Failed to load document access');
         router.push('/dashboard');
      }
    };
    fetchDoc();

    // 2. Setup Yjs
    const doc = new Y.Doc();
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:5000';
    const wsProvider = new WebsocketProvider(SOCKET_URL, id, doc);
    
    wsProvider.awareness.setLocalStateField('user', {
      name: user.name,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
    });

    setYdoc(doc);
    setProvider(wsProvider);

    // 3. Setup Socket.io for Chat
    const newSocket = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000');
    setSocket(newSocket);
    
    newSocket.emit('join-document', id);
    newSocket.on('receive-message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      wsProvider.destroy();
      doc.destroy();
      newSocket.disconnect();
    };
  }, [id, user, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const editor = useEditor({
    editable: role !== 'Viewer' && role !== '',
    extensions: [
      StarterKit.configure({
        history: false,
      } as any),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: user?.name,
          color: '#' + Math.floor(Math.random()*16777215).toString(16),
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm xl:prose-lg outline-none min-h-[60vh] p-4 bg-white rounded-lg border shadow-sm',
      },
    },
  }, [ydoc, provider, role]);

  const sendMessage = () => {
    if (!messageInput.trim() || !socket || role === 'Viewer') return;
    const msgData = { documentId: id, message: messageInput, type: 'text', user: { name: user?.name, id: user?._id } };
    socket.emit('send-message', msgData);
    setMessages((prev) => [...prev, { ...msgData, timestamp: new Date().toISOString() }]);
    setMessageInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || role === 'Viewer') return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const { data } = await axios.post(`${API_URL}/upload`, formData, {
        headers: { Authorization: `Bearer ${user?.token}`, 'Content-Type': 'multipart/form-data' }
      });
      const msgData = { documentId: id, message: data.url, type: 'image', user: { name: user?.name, id: user?._id } };
      socket?.emit('send-message', msgData);
      setMessages((prev) => [...prev, { ...msgData, timestamp: new Date().toISOString() }]);
    } catch(err) {
       console.error('File upload failed');
    }
  };

  const handleAiInsight = async (action: 'summarize' | 'fix_grammar') => {
    setAiLoading(true);
    setAiResponse('');
    const content = editor?.getText() || '';
    
    try {
       const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
       const res = await fetch(`${API_URL}/ai/insights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
          body: JSON.stringify({ action, content })
       });
       
       const reader = res.body?.getReader();
       const decoder = new TextDecoder();
       
       while (reader) {
         const { done, value } = await reader.read();
         if (done) break;
         
         const chunk = decoder.decode(value);
         const lines = chunk.split('\n\n');
         for (const line of lines) {
           if (line.startsWith('data: ')) {
             const dataStr = line.replace('data: ', '');
             if (dataStr === '[DONE]') break;
             try {
               const parsed = JSON.parse(dataStr);
               if (parsed.text) setAiResponse((prev) => prev + parsed.text);
             } catch (e) {}
           }
         }
       }
    } catch (err) {
       console.error(err);
    } finally {
       setAiLoading(false);
    }
  };

  if (!editor || !ydoc || !provider) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
         <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
         <p className="text-slate-600 font-medium">Loading Workspace...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-white shadow border-b border-slate-200 py-3 px-6 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/dashboard')} className="text-slate-500 hover:text-indigo-600 font-medium text-sm">
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold text-slate-800">{docTitle}</h1>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 ml-2">Live</span>
          {role === 'Viewer' && <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-200 text-slate-700 ml-2">Read Only</span>}
        </div>
        <div className="flex space-x-2 items-center">
           <button onClick={() => handleAiInsight('fix_grammar')} className="text-sm font-medium bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded shadow-sm hover:bg-indigo-50">
            Fix Grammar
          </button>
          <button onClick={() => handleAiInsight('summarize')} className="flex items-center text-sm font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-3 py-1.5 rounded shadow-sm hover:opacity-90">
            <Bot className="w-4 h-4 mr-1.5" /> Summarize
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          <div className="max-w-4xl mx-auto">
             {aiResponse && (
               <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg relative">
                 <button className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-600" onClick={() => setAiResponse('')}>✕</button>
                 <h4 className="text-sm font-bold text-indigo-800 mb-1 flex items-center"><Bot className="w-4 h-4 mr-1"/> AI Insight</h4>
                 <div className="text-sm text-indigo-900 whitespace-pre-wrap">{aiResponse}</div>
               </div>
             )}
             {aiLoading && (
               <div className="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center text-sm text-indigo-800">
                 <Loader2 className="w-4 h-4 mr-2 animate-spin"/> Generating response...
               </div>
             )}
             <EditorContent editor={editor} />
          </div>
        </main>

        {/* Chat Sidebar */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100 font-semibold text-slate-700 flex justify-between items-center">
            Discussion
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            <div className="text-xs text-center text-slate-400 my-2">Welcome to the chat</div>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.user?.id === user?._id ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-slate-400 mb-0.5">{msg.user?.name}</span>
                <div className={`px-3 py-2 rounded-lg text-sm max-w-[85%] ${msg.user?.id === user?._id ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border rounded-bl-none text-slate-800'}`}>
                  {msg.type === 'image' ? (
                    <img src={msg.message} alt="upload" className="max-w-full rounded" />
                  ) : (
                    msg.message
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-slate-200 bg-white">
            {role === 'Viewer' ? (
              <div className="text-xs text-center text-slate-400 p-2">Viewers cannot send messages.</div>
            ) : (
              <div className="flex items-center space-x-2">
                <label className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full cursor-pointer transition">
                  <FileImage className="w-5 h-5" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
                <input 
                  type="text" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Message..." 
                  className="flex-1 border-slate-300 border rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button onClick={sendMessage} className="p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
