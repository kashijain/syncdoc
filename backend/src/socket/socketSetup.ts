import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
// const setupWSConnection = require('y-websocket/bin/utils').setupWSConnection;

export const initializeSocket = (io: SocketIOServer) => {
  io.on('connection', (socket) => {
    console.log('User connected to chat:', socket.id);

    // Join a document-specific room
    socket.on('join-document', (documentId) => {
      socket.join(documentId);
      console.log(`Socket ${socket.id} joined document ${documentId}`);
    });

    // Handle chat messages
    socket.on('send-message', (data) => {
      const { documentId, message, user } = data;
      // Broadcast to all others in the room
      socket.to(documentId).emit('receive-message', {
        message,
        user,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected from chat:', socket.id);
    });
  });
};

/*
 * To run y-websocket on the same server, we can attach a raw WebSocketServer
 * to the http.Server instance manually before Express handles it.
 */
export const initializeYjsServer = (server: any) => {
  const wss = new WebSocketServer({ noServer: true });

  /*
   * We need to dynamically import `y-websocket/bin/utils` because it's CommonJS/ESM mixed.
   * A simple way is to use `require`.
   */
  const { setupWSConnection } = require('y-websocket/bin/utils');

  server.on('upgrade', (request: any, socket: any, head: any) => {
    // Determine which endpoint the WebSocket is trying to connect to
    if (request.url.startsWith('/api/collaboration')) {
      wss.handleUpgrade(request, socket, head, (ws: any) => {
        wss.emit('connection', ws, request);
      });
    } else {
      // Let Socket.IO handle other upgrades at /socket.io
      // Socket.IO hooks into the upgrade event internally, so we don't destroy it unless it's neither
    }
  });

  wss.on('connection', (ws: any, req: any) => {
    // Get document name from URL (e.g., /api/collaboration/docId123)
    const docName = req.url.split('/').pop() || 'default-doc';
    setupWSConnection(ws, req, { docName });
  });
};
