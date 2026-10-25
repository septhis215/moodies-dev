const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "../..");

function snapshotSkill(directory) {
  const files = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "__pycache__" || /\.py[co]$/.test(entry.name)) continue;
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push(path.relative(directory, file).split(path.sep).join("/"));
      else throw new Error(`Unsupported skill entry: ${file}`);
    }
  }
  visit(directory);
  const hash = crypto.createHash("sha256");
  for (const relative of files.sort()) {
    let content = fs.readFileSync(path.join(directory, relative));
    const text = content.toString("utf8");
    if (!content.includes(0) && Buffer.from(text, "utf8").equals(content)) {
      content = Buffer.from(text.replace(/\r\n/g, "\n"), "utf8");
    }
    hash.update(`${relative}\0${content.length}\0`);
    hash.update(content);
    hash.update("\0");
  }
  return { fileCount: files.length, sha256: hash.digest("hex") };
}

function main() {
  const manifestPath = path.join(root, ".agents/skill-sources.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const update = process.argv.includes("--update");
  let failures = 0;
  for (const skill of manifest.skills) {
    const snapshot = snapshotSkill(path.join(root, ".agents/skills", skill.name));
    if (update) Object.assign(skill, snapshot);
    else if (snapshot.sha256 !== skill.sha256 || snapshot.fileCount !== skill.fileCount) {
      console.error(`${skill.name}: installed files differ from the reviewed snapshot`);
      failures++;
    }
  }
  if (update) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  else if (!failures) console.log(`${manifest.skills.length} skill snapshots verified.`);
  process.exitCode = failures ? 1 : 0;
}

if (require.main === module) main();
module.exports = { snapshotSkill };
