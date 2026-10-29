import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, unavailable = false) {
  const data = new Map();
  const storage = {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (unavailable) throw new Error("Storage unavailable");
      data.set(key, value);
    },
    removeItem: (key) => data.delete(key),
  };
  const mod = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(`../lib/${file}.ts`, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    module: mod,
    exports: mod.exports,
    URL,
    sessionStorage: storage,
  });
  return { ...mod.exports, storage, data };
}

test("community return navigation accepts only internal community destinations", () => {
  const nav = load("community-navigation");
  const destination =
    "/community/c720a784-7476-4676-9c82-6fbe39f2bccf?page=2#join-discussion";
  assert.equal(nav.communityAuthReturnHref(destination), destination);
  assert.equal(
    nav.communityReturnHref("/community?sort=most-replies&page=2#topic-one"),
    "/community?sort=most-replies&page=2#topic-one",
  );
  assert.equal(nav.communityReturnHref(destination), "/community");
  for (const value of [
    "https://evil.test/community",
    "//evil.test/community",
    "/\\evil.test/community",
    "/community.evil.test",
    "/community/unknown",
    "/auth/login",
    "/community\n",
    "/%2f%2fevil.test/community",
    "javascript:alert(1)",
    null,
  ]) {
    assert.equal(nav.communityAuthReturnHref(value), "/", String(value));
  }
  const url = new URL(
    nav.communitySignInHref(destination),
    "https://moodies.test",
  );
  assert.equal(url.searchParams.get("returnTo"), destination);
});

test("OAuth return is validated, expires and is consumed only once", () => {
  const nav = load("community-navigation");
  nav.rememberCommunityAuthReturn("/community?compose=1");
  assert.equal(nav.consumeCommunityAuthReturn(), "/community?compose=1");
  assert.equal(nav.consumeCommunityAuthReturn(), null);
  nav.storage.setItem(
    "moodies:community-auth-return",
    JSON.stringify({ href: "//evil.test", savedAt: Date.now() }),
  );
  assert.equal(nav.consumeCommunityAuthReturn(), null);
  nav.storage.setItem(
    "moodies:community-auth-return",
    JSON.stringify({
      href: "/community",
      savedAt: Date.now() - 11 * 60 * 1000,
    }),
  );
  assert.equal(nav.consumeCommunityAuthReturn(), null);
  nav.storage.setItem("moodies:community-auth-return", "{");
  assert.equal(nav.consumeCommunityAuthReturn(), null);
});

test("drafts preserve text separately by author and discussion, and clearing leaves unrelated storage", () => {
  const drafts = load("community-drafts");
  const key = drafts.communityDraftKey("member", "topic");
  const other = drafts.communityDraftKey("someone-else", "topic");
  assert.notEqual(key, other);
  assert.notEqual(key, drafts.communityDraftKey("member"));
  drafts.saveCommunityDraft(key, {
    title: "",
    content: "  A thoughtful reply.  ",
  });
  assert.equal(
    drafts.readCommunityDraft(key).content,
    "  A thoughtful reply.  ",
  );
  assert.equal(drafts.readCommunityDraft(other), null);
  drafts.storage.setItem("unrelated", "keep me");
  drafts.clearCommunityDrafts();
  assert.equal(drafts.readCommunityDraft(key), null);
  assert.equal(drafts.storage.getItem("unrelated"), "keep me");
});

test("malformed or oversized drafts are ignored and storage failure does not break writing", () => {
  const drafts = load("community-drafts");
  for (const raw of [
    "{",
    "null",
    "[]",
    JSON.stringify({ title: 3, content: "text" }),
    JSON.stringify({ title: "ok", content: "a".repeat(3001) }),
  ]) {
    drafts.storage.setItem("draft", raw);
    assert.equal(drafts.readCommunityDraft("draft"), null);
  }
  const unavailable = load("community-drafts", true);
  assert.equal(
    unavailable.saveCommunityDraft("draft", {
      title: "Title",
      content: "Text",
    }),
    false,
  );
});
