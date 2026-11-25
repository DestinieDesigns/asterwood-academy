// Starts the Bun API server and the Vite dev server together.
const api = Bun.spawn(["bun", "--watch", "server/index.js"], {
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});
const web = Bun.spawn(["bun", "run", "vite"], {
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

let closing = false;
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  try { api.kill(); } catch {}
  try { web.kill(); } catch {}
  setTimeout(() => process.exit(code), 120);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const first = await Promise.race([
  api.exited.then((code) => ({ who: "api", code })),
  web.exited.then((code) => ({ who: "web", code })),
]);
console.error(`[dev] ${first.who} exited with code ${first.code}`);
shutdown(first.code || 1);
