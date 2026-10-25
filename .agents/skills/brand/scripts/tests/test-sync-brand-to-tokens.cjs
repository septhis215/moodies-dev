const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const brandRoot = path.resolve(__dirname, '../..');

function fixture(t, generator = 'real') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'moodies-brand-sync-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const script = path.join(root, 'skills/brand/scripts/sync-brand-to-tokens.cjs');
  const generatorPath = path.join(root, 'skills/design-system/scripts/generate-tokens.cjs');
  for (const dir of [path.dirname(script), path.dirname(generatorPath), path.join(root, 'docs'), path.join(root, 'assets')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(path.join(brandRoot, 'scripts/sync-brand-to-tokens.cjs'), script);
  fs.copyFileSync(path.join(brandRoot, 'templates/brand-guidelines-starter.md'), path.join(root, 'docs/brand-guidelines.md'));
  fs.copyFileSync(path.join(brandRoot, '../design-system/templates/design-tokens-starter.json'), path.join(root, 'assets/design-tokens.json'));
  if (generator === 'real') {
    fs.copyFileSync(path.join(brandRoot, '../design-system/scripts/generate-tokens.cjs'), generatorPath);
  } else if (generator === 'failing') {
    fs.writeFileSync(generatorPath, 'process.exit(9);');
  }
  return { root, script };
}

function sync({ root, script }, ...args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
}

test('sync finds its sibling generator from a separate project directory and writes JSON and CSS', t => {
  const context = fixture(t);
  const result = sync(context);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const tokens = JSON.parse(fs.readFileSync(path.join(context.root, 'assets/design-tokens.json'), 'utf8'));
  assert.equal(tokens.primitive.color.primary['500'].$value, '#2563EB');
  assert.match(fs.readFileSync(path.join(context.root, 'assets/design-tokens.css'), 'utf8'), /#2563EB/i);
});

test('missing generator fails before changing token JSON', t => {
  const context = fixture(t, 'missing');
  const tokensPath = path.join(context.root, 'assets/design-tokens.json');
  const before = fs.readFileSync(tokensPath, 'utf8');
  const result = sync(context);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /generator not found/i);
  assert.equal(fs.readFileSync(tokensPath, 'utf8'), before);
  assert.doesNotMatch(result.stdout, /Brand sync complete/);
});

test('failed CSS regeneration returns failure and reports the partial JSON update', t => {
  const context = fixture(t, 'failing');
  const result = sync(context);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JSON was updated/);
  assert.doesNotMatch(result.stdout, /Brand sync complete/);
});
