// Build the app and serve it, plus the API, to this computer and the local network.
import { networkInterfaces } from "node:os";

const port = process.env.PLUMI_PORT || "3002";

console.log("[lan] Building the app…");
const build = Bun.spawnSync(["bun", "run", "build"], { stdout: "inherit", stderr: "inherit" });
if (build.exitCode !== 0) process.exit(build.exitCode || 1);

const server = Bun.spawn(["bun", "server/index.js"], {
  env: { ...process.env, PLUMI_HOST: "0.0.0.0", PLUMI_PORT: port, PORT: port },
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

let ready = false;
for (let attempt = 0; attempt < 40; attempt += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (response.ok) { ready = true; break; }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
}

if (!ready) {
  console.error(`[lan] The server did not start on port ${port}. Is that port already in use?`);
  server.kill();
  process.exit(1);
}

const addresses = new Set();
for (const entries of Object.values(networkInterfaces())) {
  for (const entry of entries || []) {
    if (entry.family === "IPv4" && !entry.internal) addresses.add(entry.address);
  }
}

console.log("\nAsterwood is running:");
console.log(`  This computer: http://127.0.0.1:${port}`);
for (const address of addresses) console.log(`  Phone / tablet: http://${address}:${port}`);
console.log("\nUse this only on a trusted home network. Press Ctrl+C to stop.");

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  try { server.kill(); } catch {}
  setTimeout(() => process.exit(0), 100);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const code = await server.exited;
process.exit(code || 0);
