import { spawnSync } from "node:child_process";

process.env.STORYBOOK_DISABLE_TELEMETRY = "1";

const result = spawnSync("npx", ["vitest", "run"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

process.exit(result.status ?? 1);
