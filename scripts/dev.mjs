#!/usr/bin/env node
// Local development launcher: starts the Cloudflare tunnel (web + socket)
// alongside `turbo run dev` (web on :3000, realtime on :3001), and stops the
// tunnel when dev stops. LOCAL ONLY — skipped in CI / production, or when
// cloudflared or its credentials aren't present on this machine.
//
//   pnpm dev            → tunnel + all apps
//   pnpm dev:no-tunnel  → all apps, no tunnel
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = process.env.TUNNEL_CONFIG ?? join(root, "cloudflared", "xivago-app.dev.yml");
const tunnelId = "debaaa03-f0dc-44b2-915e-8c62e17bba74";
const credentials = join(homedir(), ".cloudflared", `${tunnelId}.json`);

const children = [];

function startTunnel() {
  if (process.env.CI || process.env.NODE_ENV === "production" || process.env.NO_TUNNEL) {
    console.log("[dev] tunnel skipped (CI / production / NO_TUNNEL)");
    return;
  }
  const hasCloudflared = spawnSync("cloudflared", ["--version"], { stdio: "ignore", shell: true }).status === 0;
  if (!hasCloudflared || !existsSync(credentials)) {
    console.log("[dev] tunnel skipped (cloudflared or tunnel credentials not found on this machine)");
    return;
  }
  console.log("[dev] starting tunnel → https://app.xivago.com (web :3000, /socket.io → :3001)");
  const tunnel = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--config", config, "run"], {
    stdio: ["ignore", "ignore", "pipe"],
    shell: true,
  });
  // cloudflared logs to stderr; only surface connection + error lines.
  tunnel.stderr.on("data", (buf) => {
    for (const line of buf.toString().split("\n")) {
      if (/Registered tunnel connection|ERR|error/i.test(line)) console.log(`[tunnel] ${line.trim()}`);
    }
  });
  tunnel.on("exit", (code) => console.log(`[dev] tunnel exited (${code})`));
  children.push(tunnel);
}

function stopAll() {
  for (const child of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
}

startTunnel();

const turbo = spawn("pnpm", ["exec", "turbo", "run", "dev"], { cwd: root, stdio: "inherit", shell: true });
children.push(turbo);

turbo.on("exit", (code) => {
  stopAll();
  process.exit(code ?? 0);
});
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    stopAll();
    process.exit(0);
  });
}
