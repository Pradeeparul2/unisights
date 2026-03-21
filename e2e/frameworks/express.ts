import express from "express";
import cors from "cors";
import { unisights } from "../../packages/node/dist/index.js";

const corsOptions = {
  origin: ["http://localhost:3000"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

let events: any[] = [];

app.use(
  unisights({
    path: "/collect-express/event",
    handler: async (payload) => {
      events.push(payload);
    },
  }),
);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/test/events", (req, res) => {
  res.json(events[events.length - 1] || null);
});

app.get("/test/clear", (req, res) => {
  events = [];
  res.json({ cleared: true });
});

app.listen(3001, () => {
  console.log("✓ Express test server running on 3001");
});
