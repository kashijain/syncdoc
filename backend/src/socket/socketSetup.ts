import { Server as IOServer } from "socket.io";
import http from "http";

export const setupSocketIO = (server: http.Server) => {
  const io = new IOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join-document", (documentId: string) => {
      socket.join(`document:${documentId}`);
    });

    socket.on("chat-message", (payload) => {
      io.to(`document:${payload.documentId}`).emit("receive-message", payload);
    });

    socket.on("send-message", (payload) => {
      io.to(`document:${payload.documentId}`).emit("receive-message", payload);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};
