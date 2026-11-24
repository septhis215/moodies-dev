import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(readFileSync(new URL("../lib/toast/app-toast.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function store() {
  const mod = { exports: {} };
  vm.runInNewContext(compiled, { module: mod, exports: mod.exports, Date, performance,
    require: () => ({ TOAST_DURATIONS: { success: 4500, info: 5000, warning: 6000, error: 8000 } }),
  });
  return mod.exports;
}

test("explicit null durations stay persistent for every toast variant", () => {
  for (const variant of ["success", "info", "warning", "error"]) {
    const { appToast, appToastStore } = store();
    appToast[variant]("Needs attention", { duration: null });
    assert.equal(appToastStore.getSnapshot()[0].duration, null, variant);
  }
});

test("default durations and persistent loading remain unchanged", () => {
  for (const [variant, duration] of Object.entries({ success: 4500, info: 5000, warning: 6000, error: 8000, loading: null })) {
    const { appToast, appToastStore } = store();
    appToast[variant]("A notification");
    assert.equal(appToastStore.getSnapshot()[0].duration, duration);
  }
});

test("new notifications queue without evicting active loading or error messages", () => {
  const { appToast, appToastStore } = store();
  appToast.loading("Saving", { id: "saving" });
  appToast.error("An error", { id: "error", duration: null });
  appToast.info("First update", { id: "first" });
  appToast.success("Second update", { id: "second" });
  appToast.info("Third update", { id: "third" });
  assert.equal(Array.from(appToastStore.getSnapshot(), item => item.id).join(","), "saving,error,first");
  appToast.dismiss("first");
  assert.equal(Array.from(appToastStore.getSnapshot(), item => item.id).join(","), "saving,error,second");
  appToast.dismiss("second");
  assert.equal(appToastStore.getSnapshot().at(-1).id, "third");
});

test("queued loading can resolve in place before it becomes visible", () => {
  const { appToast, appToastStore } = store();
  for (let index = 0; index < 3; index++) appToast.info(`Visible ${index}`, { id: `visible-${index}` });
  appToast.loading("Saving", { id: "queued" });
  appToast.success("Saved", { id: "queued" });
  appToast.dismiss("visible-0");
  const promoted = appToastStore.getSnapshot().at(-1);
  assert.equal(promoted.id, "queued");
  assert.equal(promoted.message, "Saved");
  assert.equal(promoted.loading, false);
  assert.equal(promoted.duration, 4500);
});

test("dismissing queued messages and clearing the stack prevents later resurrection", () => {
  const { appToast, appToastStore } = store();
  for (let index = 0; index < 5; index++) appToast.info(`Update ${index}`, { id: `item-${index}` });
  appToast.dismiss("item-3");
  appToast.dismiss("item-0");
  assert.equal(appToastStore.getSnapshot().at(-1).id, "item-4");
  appToast.info("Still queued", { id: "later" });
  appToast.dismiss();
  appToast.success("Fresh", { id: "fresh" });
  assert.equal(appToastStore.getSnapshot().length, 1);
  assert.equal(appToastStore.getSnapshot()[0].id, "fresh");
});

test("repeated queued IDs update rather than adding duplicate notifications", () => {
  const { appToast, appToastStore } = store();
  for (let index = 0; index < 3; index++) appToast.info(`Visible ${index}`, { id: `item-${index}` });
  appToast.info("Queued", { id: "repeat" });
  appToast.info("Updated", { id: "repeat" });
  appToast.dismiss("item-0");
  assert.equal(appToastStore.getSnapshot().at(-1).message, "Updated");
  appToast.dismiss("repeat");
  assert.equal(appToastStore.getSnapshot().length, 2);
});
