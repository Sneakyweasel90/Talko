import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { initDB } from "./db/postgres.js";
import authRoutes, { cleanupExpiredTokens } from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import channelsRoutes from "./routes/channels.routes.js";
import searchRoutes from "./routes/search.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import dmRoutes from "./routes/dm.routes.js";
import { initWebSocket } from "./websocket/gateway.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import voiceRoutes from "./routes/voice.routes.js";
import helmet from "helmet";
import communitiesRouter from "./routes/communities.routes.js";
import communityChannelsRouter from "./routes/community.channels.routes.js";
import communityMembersRouter from "./routes/community.members.routes.js";
import communityRolesRouter from "./routes/community.roles.routes.js";
import invitesRouter from "./routes/invites.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  "https://talko-production.up.railway.app",
  "http://localhost:5173",
  "http://localhost:4000",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
];

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/channels", channelsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dm", dmRoutes);
app.use("/api/voice", voiceRoutes);
app.get("/api/health", (_, res) => res.json({ ok: true }));

// Communities CRUD
app.use("/api/communities", communitiesRouter);
app.use("/api/communities/:id/channels", communityChannelsRouter);
app.use("/api/communities/:id/members", communityMembersRouter);
app.use("/api/communities/:id/roles", communityRolesRouter);

// Invite lookup and join (no community context needed)
app.use("/api/invite", invitesRouter);

// Invite management (community context)
app.use("/api", invitesRouter);

// Serve React frontend in production
const clientDist = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDist));

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

await initDB();
await initWebSocket(server);

setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Talko server running on port ${PORT}`));
