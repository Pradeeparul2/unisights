type NavigationCallback = (url: string) => void;
type ExitCallback = () => void;

// ─── SPA navigation ───────────────────────────────────────────────────────────

export function setupNavigation(onNavigate: NavigationCallback): void {
  window.addEventListener("popstate", () => onNavigate(location.href));

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPushState(...args);
    onNavigate(location.href);
  };

  history.replaceState = (...args) => {
    originalReplaceState(...args);
    onNavigate(location.href);
  };
}

// ─── Exit tracking ────────────────────────────────────────────────────────────

export function setupExitTracking(onExit: ExitCallback): void {
  window.addEventListener("pagehide", onExit);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onExit();
  });
}
