import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function compile(file) {
  return ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}
const mod = { exports: {} };
vm.runInNewContext(compile("../../components/selected-content/keyCrew.ts"), { module: mod, exports: mod.exports });
const { selectKeyCrewGroups } = mod.exports;
const person = (id, job) => ({ id, name: `Person ${id}`, job, department: "Directing" });
const directors = Array.from({ length: 30 }, (_, index) => person(index, "Director"));

test("large movie crews retain each key craft with at most two names per label", () => {
  const crew = [...directors, person(50, "Screenplay"), person(51, "Producer"), person(52, "Original Music Composer")];
  const before = JSON.stringify(crew);
  const groups = selectKeyCrewGroups(crew, "movie");
  assert.deepEqual(Array.from(groups, (group) => group.label), ["Directors", "Writing", "Producing", "Music"]);
  assert.deepEqual(Array.from(groups[0].people, (item) => item.id), [0, 1]);
  assert.ok(groups.every((group) => group.people.length <= 2));
  assert.equal(groups.flatMap((group) => group.people).length, 5);
  assert.equal(JSON.stringify(crew), before);
});

test("series creators lead the shortlist even when absent from crew credits", () => {
  const crew = [...directors, person(50, "Writer"), person(51, "Executive Producer")];
  const groups = selectKeyCrewGroups(crew, "tv", [{ id: 70, name: "The Creator", profile_path: "/creator.jpg" }]);
  assert.deepEqual(Array.from(groups, (group) => group.label), ["Creators", "Writing", "Producing", "Directors"]);
  assert.equal(groups[0].people[0].roles[0], "Creator");
  assert.equal(groups[0].people[0].profile_path, "/creator.jpg");
});

test("duplicate people merge roles without repeating within a label", () => {
  const groups = selectKeyCrewGroups([
    person(1, "Director"), person(1, "Writer"), person(2, "Writer"),
    person(3, "Producer"), person(4, "Original Music Composer"), person(5, "Director of Photography"),
  ], "movie");
  assert.equal(groups.length, 5);
  assert.deepEqual(Array.from(groups[1].people, (item) => item.id), [1, 2]);
  assert.deepEqual(Array.from(groups[0].people[0].roles), ["Director", "Writer"]);
});

test("aggregate series jobs include both job fields and preserve creator portraits", () => {
  const groups = selectKeyCrewGroups([
    { ...person(1, "Executive Producer"), profile_path: "/crew.jpg", jobs: [{ job: "Writer" }] },
    person(2, "Director"),
  ], "tv", [{ id: 1, name: "Creator" }]);
  assert.deepEqual(Array.from(groups[0].people[0].roles), ["Creator", "Writer", "Executive Producer"]);
  assert.equal(groups[0].people[0].profile_path, "/crew.jpg");
  assert.equal(groups.length, 4);
});

test("missing or non-key credits don’t fabricate labels; director lists remain bounded", () => {
  assert.equal(selectKeyCrewGroups([], "movie").length, 0);
  assert.equal(selectKeyCrewGroups([person(1, "Assistant")], "movie").length, 0);
  assert.equal(selectKeyCrewGroups(directors, "tv")[0].people.length, 2);
});

test("crew renders vertical labels without images and cast actions match the Credits styling", () => {
  const exports = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(compile("../../components/selected-content/sections/extras.tsx"), {
    module: exports, exports: exports.exports,
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return { useMemo: (fn) => fn(), useState: (value) => [value, () => {}] };
      if (name === "next/link") return { default: "Link" };
      if (name === "@/components/selected-content/keyCrew") return { selectKeyCrewGroups };
      if (name === "@/components/ui/TmdbImage") return { TmdbImage: "Image" };
      if (name === "@/lib/tmdb") return { tmdbImage: (path) => path || null };
      return {};
    },
  });
  const cast = Array.from({ length: 13 }, (_, id) => ({ id: id + 100, name: `Actor ${id}` }));
  const data = { info: { content_type: "tv", production_countries: [], production_companies: [] }, credits: { cast, crew: directors } };
  const tree = exports.exports.default({ data, contentId: "1405" });
  const nodes = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    [node.props?.children].flat(Infinity).forEach(walk);
  }
  walk(tree);
  const links = nodes.filter((node) => node.props?.["aria-label"] === "View full cast and crew");
  assert.equal(links.length, 2);
  for (const link of links) {
    assert.equal(link.props.href, "/tv/1405/credits");
    assert.equal(link.props.children[0], "Credits ");
    assert.match(link.props.className, /^ui-secondary-action leading-none/);
  }
  assert.match(links[0].props.className, /ml-auto sm:ml-0/);
  assert.equal(links[1].props.className, "ui-secondary-action leading-none");
  const more = nodes.find((node) => node.type === "button" && node.props.children[0]?.trim() === "More");
  assert.equal(more.props.className, links[1].props.className);
  const crewSection = nodes.find((node) => node.type === "section" && node.props["aria-labelledby"] === "key-crew-heading");
  nodes.length = 0;
  walk(crewSection);
  assert.equal(nodes.filter((node) => node.type === "Image").length, 0);
  assert.equal(nodes.filter((node) => node.type === "dl").length, 1);
  assert.equal(nodes.find((node) => node.type === "dt").props.children, "Directors");
  assert.ok(nodes.some((node) => /sm:grid-cols-\[10rem_minmax\(0,1fr\)\]/.test(node.props.className)));
  assert.equal(nodes.filter((node) => node.type === "Link" && node.props.href.startsWith("/celeb/")).length, 2);
});
