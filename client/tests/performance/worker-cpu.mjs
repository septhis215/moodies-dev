import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import WebSocket from "ws";

const { values } = parseArgs({ options: {
  "base-url": { type: "string", default: "http://127.0.0.1:8787" },
  "inspector-url": { type: "string", default: "http://127.0.0.1:9230" },
  samples: { type: "string", default: "20" },
  output: { type: "string" }, compare: { type: "string" },
} });
const base = new URL(values["base-url"]);
const inspector = new URL(values["inspector-url"]);
for (const url of [base, inspector]) {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "CPU profiling is local only");
}
const samples = Number(values.samples);
assert.ok(Number.isInteger(samples) && samples >= 5 && samples <= 100, "Use 5–100 samples");
const targets = await (await fetch(new URL("/json/list", inspector), { signal: AbortSignal.timeout(10000) })).json();
const target = targets.find(target => target.webSocketDebuggerUrl);
assert.ok(target, "Start preview:cloudflare with --inspector-port 9230 first");
const socket = new WebSocket(target.webSocketDebuggerUrl, { handshakeTimeout: 10000 });
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timeout);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function request() {
  const start = performance.now();
  const response = await fetch(base, { signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  assert.equal(response.status, 200, body.slice(0, 200));
  assert.ok(body.includes("homepage-browse"), "Expected the landing page");
  return { wallMs: performance.now() - start, cache: response.headers.get("x-opennext-cache") ?? response.headers.get("x-nextjs-cache") ?? "none" };
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
  if (values.output) await mkdir(dirname(values.output), { recursive: true });
  const first = await request();
  for (let i = 0; i < 3; i++) await request();
  await command("Profiler.enable");
  const batches = [];
  for (let batch = 0; batch < 3; batch++) {
    await command("Profiler.start");
    const responses = [];
    for (let i = 0; i < samples; i++) responses.push(await request());
    const { profile } = await command("Profiler.stop");
    assert.ok(profile.samples?.length > 0, "Inspector returned no CPU samples");
    assert.equal(profile.timeDeltas?.length, profile.samples.length, "CPU sample durations are missing");
    const nodes = new Map(profile.nodes.map(node => [node.id, node]));
    // Sampled active time includes profiler overhead; it is not Cloudflare's billed CPU metric.
    const activeUs = (profile.samples ?? []).reduce((total, id, index) =>
      total + (nodes.get(id)?.callFrame.functionName === "(idle)" ? 0 : profile.timeDeltas[index]), 0);
    batches.push({ sampledCpuMsPerRequest: activeUs / 1000 / samples,
      medianWallMs: median(responses.map(response => response.wallMs)),
      cacheHits: responses.filter(response => response.cache === "HIT").length });
    if (values.output) await writeFile(`${values.output}.${batch + 1}.cpuprofile`, JSON.stringify(profile));
  }
  const report = { measuredAt: new Date().toISOString(), baseUrl: base.href,
    metric: "Local workerd sampled active CPU per warm request; not production CPU or its Free limit",
    samplesPerBatch: samples, firstRequest: first, batches,
    medianSampledCpuMs: median(batches.map(batch => batch.sampledCpuMsPerRequest)) };
  if (values.output) await writeFile(values.output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (values.compare) {
    const before = JSON.parse(await readFile(values.compare, "utf8"));
    assert.equal(before.metric, report.metric, "Compare matching Worker CPU reports");
    assert.equal(before.samplesPerBatch, samples, "Compare reports with the same sample count");
    assert.ok(Number.isFinite(before.medianSampledCpuMs) && before.medianSampledCpuMs > 0, "Baseline CPU must be positive");
    const reduction = (1 - report.medianSampledCpuMs / before.medianSampledCpuMs) * 100;
    console.log(`Local sampled CPU change: ${reduction.toFixed(1)}% reduction (verify production separately).`);
  }
} finally {
  for (const request of pending.values()) clearTimeout(request.timeout);
  socket.terminate();
}
