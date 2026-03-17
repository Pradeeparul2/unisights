// page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));
// page.on("pageerror", (err) => console.log("BROWSER ERROR:", err));

npx playwright test tests/framework.spec.ts --headed
