import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";
import { unisights } from "../../packages/node/dist/index.js";

let events: any[] = [];

@Module({})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  // Apply unisights middleware
  app.use(
    unisights({
      path: "/collect-nestjs/event",
      handler: async (payload) => {
        events.push(payload);
      },
    }),
  );

  // Add test endpoints
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  expressApp.get("/test/events", (req, res) => {
    res.json(events[events.length - 1] || null);
  });

  expressApp.get("/test/clear", (req, res) => {
    events = [];
    res.json({ cleared: true });
  });

  await app.listen(3005);
  console.log("✓ NestJS test server running on 3005");
}

bootstrap();
