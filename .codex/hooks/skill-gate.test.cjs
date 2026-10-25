const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const { validateSkills } = require("./skill-gate.cjs");

const root = path.resolve(__dirname, "../..");
const names = ["ponytail", "i-have-adhd", "browser-use", "ui-ux-pro-max", "humanizer"];

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "moodies skills "));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("moodies skills "));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  for (const name of names) {
    const destination = path.join(directory, ".agents/skills", name, "SKILL.md");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `---\nname: ${name}\ndescription: Test skill\n---\nInstructions.\n`);
  }
  for (const relative of [
    "i-have-adhd/agents/openai.yaml",
    "ui-ux-pro-max/scripts/search.py", "ui-ux-pro-max/scripts/core.py",
    "ui-ux-pro-max/scripts/design_system.py", "ui-ux-pro-max/scripts/reasoning_contract.py",
    "ui-ux-pro-max/data/ux-guidelines.csv", "ui-ux-pro-max/data/stacks/nextjs.csv",
  ]) {
    const destination = path.join(directory, ".agents/skills", relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, "fixture\n");
  }
  return directory;
}

function runCommand(command, cwd) {
  const executable = process.platform === "win32" ? "powershell.exe" : "/bin/sh";
  const args = process.platform === "win32"
    ? ["-NoProfile", "-NonInteractive", "-Command", command]
    : ["-c", command];
  return spawnSync(executable, args, { cwd, encoding: "utf8" });
}

test("installed setup is readable and the gate emits valid hook context", () => {
  assert.deepEqual(validateSkills(root), []);
  const result = spawnSync(process.execPath, [path.join(__dirname, "skill-gate.cjs")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout).hookSpecificOutput;
  assert.equal(output.hookEventName, "UserPromptSubmit");
  assert.match(output.additionalContext, /Moodies skill gate passed/);
});

test("rejects missing, empty, directory-shaped, and incorrectly named skill manifests", (t) => {
  for (const kind of ["missing", "empty", "directory", "wrong-name"]) {
    const directory = fixture(t);
    const file = path.join(directory, ".agents/skills/ponytail/SKILL.md");
    if (kind === "missing" || kind === "directory") fs.unlinkSync(file);
    if (kind === "directory") fs.mkdirSync(file);
    if (kind === "empty") fs.writeFileSync(file, "");
    if (kind === "wrong-name") fs.writeFileSync(file, "---\nname: another\ndescription: Test\n---\n");
    assert.ok(validateSkills(directory).some((error) => error.includes("ponytail/SKILL.md")), kind);
  }
});

test("missing UI data blocks the child process with exit code 2", (t) => {
  const directory = fixture(t);
  const hook = path.join(directory, ".codex/hooks/skill-gate.cjs");
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "skill-gate.cjs"), hook);
  fs.unlinkSync(path.join(directory, ".agents/skills/ui-ux-pro-max/data/ux-guidelines.csv"));
  const result = spawnSync(process.execPath, [hook], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /ux-guidelines.csv/);
});

test("configured hook works from the root and a nested directory", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, ".codex/hooks.json"), "utf8"));
  const command = config.hooks.UserPromptSubmit[0].hooks[0].command;
  for (const cwd of [root, path.join(root, "server")]) {
    const result = runCommand(command, cwd);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.hookEventName, "UserPromptSubmit");
  }
});

test("configured hook supports a relocated Git checkout whose path contains spaces", (t) => {
  const directory = fixture(t);
  const hook = path.join(directory, ".codex/hooks/skill-gate.cjs");
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "skill-gate.cjs"), hook);
  const git = spawnSync("git", ["init", "--quiet", directory], { encoding: "utf8" });
  assert.equal(git.status, 0, git.stderr);
  const config = JSON.parse(fs.readFileSync(path.join(root, ".codex/hooks.json"), "utf8"));
  const result = runCommand(config.hooks.UserPromptSubmit[0].hooks[0].command, directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, /Moodies skill gate passed/);
});
