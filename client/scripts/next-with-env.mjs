import { spawnSync } from "node:child_process";

const [environment, command, ...args] = process.argv.slice(2);
const supportedEnvironments = new Set(["local", "staging", "production"]);

if (!supportedEnvironments.has(environment) || !command) {
  console.error(
    "Usage: node scripts/next-with-env.mjs <local|staging|production> <next-command> [args...]",
  );
  process.exit(1);
}

const nextCommand = process.platform === "win32" ? "next.cmd" : "next";
const result = spawnSync(nextCommand, [command, ...args], {
  env: { ...process.env, MOODIES_ENV: environment },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
