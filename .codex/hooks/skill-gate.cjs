const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const skills = ["ponytail", "i-have-adhd", "browser-use", "ui-ux-pro-max", "humanizer"];
const resources = [
  ".agents/skills/i-have-adhd/agents/openai.yaml",
  ".agents/skills/ui-ux-pro-max/scripts/search.py",
  ".agents/skills/ui-ux-pro-max/scripts/core.py",
  ".agents/skills/ui-ux-pro-max/scripts/design_system.py",
  ".agents/skills/ui-ux-pro-max/scripts/reasoning_contract.py",
  ".agents/skills/ui-ux-pro-max/data/ux-guidelines.csv",
  ".agents/skills/ui-ux-pro-max/data/stacks/nextjs.csv",
];

function validateSkills(projectRoot = root) {
  const errors = [];
  function readFile(relative) {
    try {
      const file = path.join(projectRoot, relative);
      if (!fs.statSync(file).isFile()) throw new Error("expected a regular file");
      const content = fs.readFileSync(file, "utf8");
      if (!content.trim()) throw new Error("file is empty");
      return content;
    } catch (error) {
      errors.push(`${relative}: ${error.code || error.message}`);
      return null;
    }
  }

  for (const name of skills) {
    const relative = `.agents/skills/${name}/SKILL.md`;
    const content = readFile(relative);
    if (content === null) continue;
    const header = content.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    // Full YAML validation belongs in setup checks; the per-prompt gate checks identity.
    const declaredName = header?.[1].match(/^name:\s*["']?([a-z0-9-]+)["']?\s*$/m)?.[1];
    if (declaredName !== name || !/^description:\s*\S/m.test(header?.[1] || "")) {
      errors.push(`${relative}: expected frontmatter with name '${name}' and description`);
    }
  }
  for (const relative of resources) readFile(relative);
  return errors;
}

function main() {
  const errors = validateSkills();
  if (errors.length) {
    process.stderr.write(`Moodies skill gate failed:\n${errors.join("\n")}\nRestore the listed skill files before continuing.\n`);
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext:
        "Moodies skill gate passed: five skill manifests and required helper files checked. " +
        "Apply the default skill workflow in the repository AGENTS.md to this request. " +
        "Consider ponytail, i-have-adhd, browser-use, ui-ux-pro-max, and humanizer. " +
        "Apply their task-relevant rules and current user overrides. Read required " +
        "skill instructions before claiming to use them.",
    },
  }));
}

if (require.main === module) main();
module.exports = { main, validateSkills };
