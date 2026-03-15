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

const events: any[] = [];

app.use(
  unisights({
    path: "/collect-express/event",
    handler: async (payload) => {
      events.push(payload);
    },
  }),
);

/* test endpoint */
app.get("/test/events", (req, res) => {
  res.json(events);
});

app.listen(3001, () => {
  console.log("Express test server running on 3001");
});
