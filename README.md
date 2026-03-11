# SyncDoc - Real-Time Collaborative Workspace

SyncDoc is a modern, responsive full-stack collaborative workspace application built for seamless remote collaboration. It supports real-time rich-text editing, live chat, secure access control, document sharing, file attachments via Cloudinary, and Google Gemini AI insights.

## Approach to Handling Real-Time Concurrency (Yjs & CRDTs)

Handling simultaneous edits correctly requires managing race conditions and network delays so no two users overwrite each other's work. To solve this, the application uses **CRDTs (Conflict-free Replicated Data Types)** via the **Yjs** library, integrated with the **Tiptap** rich-text editor. 

- **Why CRDT over Operational Transformation (OT)?** CRDTs allow offline editing and peer-to-peer merging natively without relying on a central authority to sequence operations. It guarantees that all users converge to the exact same document state regardless of network delay.
- **WebSocket Synchronization:** A Node.js `ws` server running alongside the Express app acts as the central WebSockets provider. The `y-websocket` integration on the frontend connects to this server.
- **Awareness & Cursors:** Yjs handles the "Awareness" protocol to broadcast live cursors and presence events natively alongside document changes. If User A and User B type in the exact same paragraph simultaneously, Yjs merges the strings character by character based on their unique client identifiers, ensuring no data override or breakages occur.

## RBAC Database Schema Structure

The Role-Based Access Control (RBAC) implementation is enforced at the database layer (MongoDB) and verified meticulously via Express Authentication Middlewares.

### The Embedded Schema Approach
Instead of creating a standalone `Role` or `Permission` table (which requires expensive joins or aggregate lookups), the roles are **embedded** securely inside the `Document` schema. 

```javascript
collaborators: [
  {
    user: { type: ObjectId, ref: 'User' },
    role: { type: String, enum: ['Owner', 'Editor', 'Viewer'], default: 'Viewer' }
  }
]
```

### Strictly Enforced Permissions
- **Owner**: Inherits full rights. The primary `owner` field specifies this user. Can delete the document and manage shares.
- **Editor**: Can read the document, connect to the Yjs WebSocket, update the document content, upload files, and send chat messages.
- **Viewer**: Read-only access.
- **Middleware Enforcement & UI Guard:** The `requireRole(['Owner', 'Editor'])` wrapper is applied to REST API modification endpoints (like `PUT /api/documents/:id` and `/api/upload`). If a Viewer attempts to send a `POST` message, the server intercepts the JWT token, matches it to the document's collaborator list, and immediately returns a `403 Forbidden` error. Additionally, the Next.js Frontend disables the Tiptap editor and hides the Chat Input bar if the user accesses the UI as a Viewer.

---

## Local Setup Instructions

### 1. Environment Configurations
First, clone the project and open two terminal windows (one for `/backend`, one for `/frontend`).

**Backend (Node.js/Express)**
Create a `.env` file inside `/backend` and fill it with your credentials:
```env
PORT=5000
MONGO_URI=mongodb+srv://<your_user>:<your_pass>@cluster0.abc.mongodb.net/syncdoc?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GEMINI_API_KEY=your_google_ai_studio_key
```

**Frontend (Next.js)**
Create a `.env.local` file inside `/frontend` targeting the local backend:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=ws://localhost:5000
```

### 2. Startup Commands
Run the following exact commands to start the project locally:

**Terminal 1 (Backend)**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 (Frontend)**
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Test Flow for Roles
1. Connect to `localhost:3000`. Register a primary account, **User A**.
2. Create a Document (You are now the **Owner**).
3. Open an Incognito Window and Register **User B**.
4. In User A's window, click "Share" (via Postman API or UI) and assign User B as **Viewer**.
5. Switch to User B. Notice the Editor is strictly readable and the chat bar says "Viewers cannot send messages."
6. Have User A change User B's role to **Editor**. User B can now type (syncing cursors live with A) and upload images.

---

## Deployment Configuration

I have provided native files to simplify the deployment pipeline. 

### 1. Database Deployment (MongoDB Atlas)
- Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free tier cluster.
- In **Network Access**, add `0.0.0.0/0` so your deployed backend can reach it.
- In **Database Access**, create a user and copy the connection string (`MONGO_URI`).

### 2. Backend Deployment (Render)
Render natively recognizes the `render.yaml` blueprint included in the root of `/backend`.
1. Push your repository to GitHub.
2. Sign into [Render.com](https://render.com) and click **New > Blueprint**.
3. Point to your GitHub repository. It will automatically detect `syncdoc-backend`.
4. Render will prompt you to enter the environment variables (`MONGO_URI`, `JWT_SECRET`, `CLOUDINARY`, `GEMINI_API_KEY`).
5. Wait for the deployment. You will receive a URL like `https://syncdoc-api.onrender.com`.

### 3. Frontend Deployment (Vercel)
Vercel is strictly designed for Next.js.
1. Sign into [Vercel.com](https://vercel.com) and select **Add New Project**.
2. Select your GitHub repository.
3. Change the **Framework Preset** to Next.js.
4. Set the **Root Directory** to `frontend`.
5. Enter the Production Environment Variables relying on Render's URL:
   - `NEXT_PUBLIC_API_URL` = `https://syncdoc-api.onrender.com/api`
   - `NEXT_PUBLIC_SOCKET_URL` = `wss://syncdoc-api.onrender.com`
6. Click **Deploy**.

## Final Deployment Checklist
- [x] Backend pushed to GitHub with `render.yaml` blueprint.
- [x] MongoDB Atlas securely accepting 0.0.0.0/0 IP connections.
- [x] Render Env Variables properly copied skipping `PORT`.
- [x] Vercel `Root Directory` directed precisely to `/frontend`.
- [x] Vercel `NEXT_PUBLIC_API_URL` directed to the live Render endpoint.

## Folder Structure

```text
/backend/
├── .env.example
├── package.json
├── render.yaml          # Render Blueprint Config
└── src/
    ├── config/          # Database connection
    ├── controllers/     # API logic (Auth, Documents, AI)
    ├── middleware/      # Auth & RBAC checks
    ├── models/          # Mongoose Schemas (User, Document)
    ├── routes/          # Express Routes
    ├── socket/          # Socket.io & Yjs Server
    └── server.ts        # Entry point

/frontend/
├── .env.example
├── package.json
└── src/
    ├── app/
    │   ├── dashboard/   # Document List UI
    │   └── document/    # Collaborative Editor UI
    └── store/           # Zustand state
```
