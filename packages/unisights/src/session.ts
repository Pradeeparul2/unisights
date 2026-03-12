import { SESSION_KEY, SESSION_TIMEOUT } from "./constants";

export function getOrCreateSession(): string {
  const now = Date.now();
  const stored = localStorage.getItem(SESSION_KEY);

  if (stored) {
    const session = JSON.parse(stored);
    if (now - session.lastActivity < SESSION_TIMEOUT) {
      session.lastActivity = now;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session.sessionId;
    }
  }

  const session = {
    sessionId: crypto.randomUUID(),
    startedAt: now,
    lastActivity: now,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session.sessionId;
}

export function touchSession(): void {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return;
  const session = JSON.parse(stored);
  session.lastActivity = Date.now();
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
