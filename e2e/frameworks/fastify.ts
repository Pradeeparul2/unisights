import fastify from "fastify";
import cors from "@fastify/cors";
import { unisights } from "../../packages/node/dist/index.js";

const app = fastify();

let events: any[] = [];

app.register(cors, {
  origin: ["http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

app.register(unisights({
  path: "/collect-fastify/event",
  handler: async (payload) => {
    events.push(payload);
  },
}).fastify);

app.get("/health", async (request, reply) => {
  reply.send({ status: "ok" });
});

app.get("/test/events", async (request, reply) => {
  reply.send(events[events.length - 1] || null);
});

app.get("/test/clear", async (request, reply) => {
  events = [];
  reply.send({ cleared: true });
});

app.listen({ port: 3004 }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("✓ Fastify test server running on 3004");
});