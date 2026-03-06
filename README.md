# Yakk

Yakk is a private, invite-only chat application built for real-time text and voice communication. It runs as both a web app (hosted on Railway) and a native desktop application on Windows and Linux via Electron. The name comes from the idea of yakking — talking a lot, without the noise of a public platform.

---

## What it does

Yakk is essentially a self-hosted Discord alternative. Users join with an invite code, create an account, and get access to a shared server with text channels, voice channels, and direct messages.

**Text channels** work like any standard chat — messages appear in real time, support emoji reactions, replies, edits, and deletion. Admins can delete any message; regular users can only edit or delete their own.

**Voice channels** use WebRTC peer-to-peer audio. When you join a voice channel, your browser establishes direct audio connections to every other participant. There is no audio relay server — audio travels peer to peer, routed through a TURN server only when a direct connection cannot be established. Noise suppression is applied using RNNoise via WebAssembly.

**Direct messages** are one-to-one conversations between users. DMs are end-to-end encrypted using ECDH key exchange and AES-GCM. The private key is generated on login and never leaves the client. The server only stores ciphertext for DM messages.

**Search** allows full-text search across channel message history using PostgreSQL's built-in GIN index.

**User profiles** support avatars, display nicknames, and per-user local nicknames (you can rename someone in your own view without affecting how others see them).

**Admin tools** include role management, the ability to assign custom role names, session invalidation (kick), and banning. The first registered account is automatically promoted to admin. Admins cannot act against other admins or the server owner.

---

## Architecture

Yakk is split into two main components: a Node.js server and a React frontend.

### Server

The server lives in the `server/` directory and is a Node.js/Express application. It handles REST API routes and a WebSocket gateway for real-time messaging.

- **Express** serves the REST API under `/api` and also serves the compiled React frontend in production.
- **WebSocket** (`ws` library) handles all real-time events: messages, typing indicators, voice signalling, reactions, online presence, and DM notifications. Each connected client is authenticated via a JWT passed as a query parameter on the WebSocket upgrade request.
- **PostgreSQL** is the only persistent data store. It stores users, channels, messages, reactions, DM conversations, refresh tokens, and local nicknames. Full-text search on messages is handled with a GIN index on the content column using `to_tsvector`.
- **Authentication** uses short-lived JWT access tokens (15 minutes) paired with long-lived opaque refresh tokens (30 days) stored in the database. Rate limiting is applied to login and registration endpoints.
- **Redis** is included in the Docker Compose setup but is currently unused in the application logic — it is available for future session or pub/sub use.

The server is deployed on Railway and connects to a Railway-managed PostgreSQL instance via `DATABASE_URL`.

### Client

The client lives in the `client/` directory and is a React + TypeScript application built with Vite.

- **React Router** handles navigation between login, registration, and the main chat view.
- **WebSocket hook** maintains a persistent connection to the server with automatic reconnection. Voice participants are rejoined automatically on reconnect.
- **Voice** is handled entirely in the browser using the WebRTC API. ICE candidates and SDP offers/answers are exchanged via the WebSocket server, which acts as a signalling relay only. Audio processing uses the Web Audio API with a custom AudioWorklet and the RNNoise WASM module for noise suppression.
- **E2E encryption** for DMs uses the Web Crypto API — ECDH P-256 for key exchange and AES-GCM 256 for encryption. Key pairs are generated fresh on each login session.
- **Theming** is handled through a React context, with multiple colour schemes available.
- **State** is managed entirely with React hooks — no external state management library.

### Desktop (Electron)

The desktop wrapper lives at `client/electron.cjs`. It loads the compiled React app from the `dist/` directory as a local file and adds a frameless window with custom title bar controls.

On startup, the app checks the GitHub Releases API for a newer version. If one exists, it prompts the user to download it. The update is downloaded in-app with a progress window, then the installer is launched. On Windows this is an NSIS installer (`.exe`). On Linux it is an AppImage.

The desktop build is produced by `electron-builder` and targeted separately per platform:

- Windows: NSIS installer, output as `YakkSetup.exe`
- Linux: AppImage, output as `Yakk.AppImage`

### CI/CD

A GitHub Actions workflow at `.github/workflows/release.yml` triggers on version tags (e.g. `v1.2.0`). It runs two parallel jobs — one on `windows-latest` and one on `ubuntu-latest` — each building the Electron app for their respective platform. Both artifacts are then uploaded to a GitHub Release automatically.

The web app is deployed continuously via Railway, which builds and deploys on every push to the main branch.

---

## Project structure

```
Yakk/
├── client/                  React + Vite frontend, Electron wrapper
│   ├── src/
│   │   ├── components/      UI components (Chat, Sidebar, ChannelList, etc.)
│   │   ├── hooks/           Logic hooks (useVoice, useMessages, useWebSocket, etc.)
│   │   ├── context/         React contexts (Auth, Theme, LocalNickname)
│   │   ├── crypto/          E2E encryption utilities
│   │   └── pages/           Login and Register pages
│   ├── public/              Static assets including the compiled RNNoise worklet
│   ├── electron.cjs         Electron main process
│   ├── preload.cjs          Electron preload script
│   └── vite.config.ts       Vite build config
├── server/
│   └── src/
│       ├── routes/          Express route handlers (auth, users, channels, dm, admin, search)
│       ├── websocket/       WebSocket gateway and message handling
│       ├── middleware/       Auth middleware, rate limiting
│       └── db/              PostgreSQL connection and schema initialisation
├── .github/
│   └── workflows/
│       └── release.yml      GitHub Actions build and release workflow
├── docker-compose.yml       Local development PostgreSQL and Redis
└── start.sh                 Production start script
```

---

## Environment variables

**Server**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign access tokens |
| `INVITE_CODE` | Code required to register a new account |
| `PORT` | Port the server listens on (default 4000) |

**Client**

| Variable | Description |
|---|---|
| `VITE_METERED_USERNAME` | Metered.ca TURN server username |
| `VITE_METERED_CREDENTIAL` | Metered.ca TURN server credential |

---

## Running locally

Start the database:

```bash
docker-compose up -d
```

Start the server:

```bash
cd server
npm install
node src/server.js
```

Start the frontend dev server:

```bash
cd client
npm install
npm run dev
```

To run the Electron app in development:

```bash
cd client
npm run electron:dev
```

To build the desktop app:

```bash
# Windows
npm run electron:build:win

# Linux
npm run electron:build:linux
```

---

## Releasing a new version

Update the version in `client/package.json`, then push a tag:

```bash
git tag v1.x.x
git push origin v1.x.x
```

GitHub Actions will build both the Windows and Linux installers and attach them to a new GitHub Release. The desktop app will detect the new version on next launch and prompt users to update.
