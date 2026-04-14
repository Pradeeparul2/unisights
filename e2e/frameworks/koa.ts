import Koa from "koa";
import cors from "@koa/cors";
import Router from "@koa/router";
import { unisights } from "../../packages/node/dist/index.js";

const corsOptions = {
  origin: ["http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const app = new Koa();
const router = new Router();

app.use(cors(corsOptions));

let events: any[] = [];
const eventQueue = new Map<string, Promise<void>>();

app.use(
  unisights({
    path: "/collect-koa/event",
    handler: async (payload) => {
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {}
      }
      events.push(payload);
    },
  }).koa,
);

router.get("/health", async (ctx) => {
  ctx.body = { status: "ok" };
});

router.get("/test/events", async (ctx) => {
  ctx.body = JSON.stringify(events[events.length - 1] || null);
});

router.get("/test/clear", async (ctx) => {
  events = [];
  ctx.body = { cleared: true };
});

app.use(router.routes());
app.use(router.allowedMethods());

const server = app.listen(3006, () => {
  console.log("✓ Koa test server running on 3006");
});

// Graceful shutdown
const shutdown = (signal: string) => {
  return () => {
    console.log(`${signal} signal received: closing HTTP server`);
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error("Forced exit due to timeout");
      process.exit(1);
    }, 10000);
  };
};

process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
