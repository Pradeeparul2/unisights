import { spawn } from "child_process";

export function startBackend(type: string) {
  if (type === "express") return spawn("node", ["frameworks/express.js"]);

  if (type === "nest") return spawn("node", ["frameworks/nest.js"]);

  if (type === "edge") return spawn("node", ["frameworks/edge.js"]);

  if (type === "fastapi")
    return spawn("uvicorn", ["frameworks.fastapi:app", "--port", "4001"]);

  if (type === "flask") return spawn("python", ["frameworks/flask.py"]);

  if (type === "django")
    return spawn("python", ["manage.py", "runserver", "4001"]);
}
