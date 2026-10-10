import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../../components/selected-content/extended/allCredits.tsx", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const info = { title: "Dexter", content_type: "tv", first_air_date: "2006-10-01" };
const cast = [
  { id: 1, name: "Michael C. Hall", roles: [{ character: "Dexter Morgan" }], order: 0 },
  { id: 2, name: "Jennifer Carpenter", character: "Debra Morgan", order: 1 },
];
const crew = [
  { id: 3, name: "Alex", department: "Writing", job: "Writer" },
  { id: 3, name: "Alex", department: "Writing", job: "Screenplay" },
  { id: 3, name: "Alex", department: "Directing", job: "Director" },
  { id: 4, name: "Sam", department: "Production", jobs: [{ job: "Producer" }] },
];

function harness(props = { credits: { cast, crew }, info, id: "1405" }) {
  const mod = { exports: {} }, states = [], effects = [], timers = new Map(), scrolls = [];
  let cursor = 0, nextTimer = 0;
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports,
    window: {
      setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
      clearTimeout(id) { timers.delete(id); },
      matchMedia: () => ({ matches: true }),
    },
    document: { getElementById: (id) => ({ scrollIntoView: (options) => scrolls.push({ id, ...options }) }) },
    require(name) {
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "react") return {
        useMemo: (fn) => fn(), useEffect: (fn) => effects.push(fn),
        useState(initial) {
          const index = cursor++;
          if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
          return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
        },
      };
      if (name === "next/link") return { default: "Link" };
      if (name === "@/components/ui/TmdbImage") return { TmdbImage: "Image" };
      if (name === "@/lib/tmdb") return { tmdbImage: (path) => path || null };
      return {};
    },
  });
  return { effects, timers, scrolls, render() {
    cursor = 0;
    const nodes = [];
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      [node.props?.children].flat(Infinity).forEach(walk);
    };
    walk(mod.exports.default(props));
    return nodes;
  } };
}
const cards = (nodes) => nodes.filter((node) => node.type === "li");
const input = (nodes) => nodes.find((node) => node.type === "input");
const select = (nodes) => nodes.find((node) => node.type === "select");
function switchCrew(app) {
  app.render().find((node) => node.type === "button" && node.props.children?.[1] === "Crew").props.onClick();
  return app.render();
}

test("TV and movie credits retain contextual navigation and responsive portrait galleries", () => {
  for (const type of ["tv", "movie"]) {
    const nodes = harness({ credits: { cast }, info: { ...info, content_type: type }, id: "1405" }).render();
    const href = type === "movie" ? "/movies/1405" : "/tv/1405";
    assert.ok(nodes.some((node) => node.type === "nav" && node.props["aria-label"] === "Title navigation"));
    assert.ok(nodes.some((node) => node.type === "Link" && node.props.href === `${href}/reviews`));
    assert.ok(nodes.some((node) => node.props["aria-current"] === "page"));
    assert.equal(nodes.find((node) => node.type === "h1").props.children, "Dexter");
    assert.match(nodes.find((node) => node.type === "ul").props.className, /grid-cols-2.*xl:grid-cols-6/);
    assert.ok(nodes.some((node) => node.type === "Link" && node.props.href === "/celeb/1" && node.props.prefetch === false));
    assert.ok(nodes.some((node) => node.type === "Image" && node.props.src === "/placeholder-person.svg"));
    assert.equal(nodes.some((node) => node.type === "span" && /absolute.*left-2.*top-2/.test(node.props.className)), false, "Portraits should not have billing-number badges");
  }
});

test("cast search includes aggregate TV roles and sorting never mutates input", () => {
  const app = harness();
  let nodes = app.render();
  select(nodes).props.onChange({ target: { value: "name" } });
  assert.deepEqual(cards(app.render()).map((node) => node.props.id), ["credit-cast-2", "credit-cast-1"]);
  assert.deepEqual(cast.map((person) => person.id), [1, 2]);
  input(app.render()).props.onChange({ target: { value: " dexter morgan " } });
  assert.deepEqual(cards(app.render()).map((node) => node.props.id), ["credit-cast-1"]);
  app.render().find((node) => node.props["aria-label"] === "Clear search").props.onClick();
  assert.equal(cards(app.render()).length, 2);
});

test("crew search, department filtering and merged jobs preserve separate departments", () => {
  const app = harness();
  let nodes = switchCrew(app);
  assert.equal(cards(nodes).length, 3);
  assert.equal(new Set(cards(nodes).map((node) => node.props.id)).size, 3);
  input(nodes).props.onChange({ target: { value: "screenplay" } });
  assert.deepEqual(cards(app.render()).map((node) => node.props.id), ["credit-crew-Writing-3"]);
  app.render().find((node) => node.props["aria-label"] === "Clear search").props.onClick();
  select(app.render()).props.onChange({ target: { value: "Production" } });
  nodes = app.render();
  assert.equal(cards(nodes).length, 1);
  assert.ok(nodes.some((node) => node.type === "p" && node.props.children === "Producer"));
  assert.equal(crew.length, 4);
});

test("large lists reveal 24 entries at a time and reset after a search", () => {
  const many = Array.from({ length: 55 }, (_, index) => ({ id: index, name: `Person ${index}`, order: index }));
  const app = harness({ credits: { cast: many }, info, id: "1405" });
  const more = () => app.render().find((node) => node.type === "button" && node.props["aria-controls"] === "credit-results");
  assert.equal(cards(app.render()).length, 24);
  more().props.onClick();
  assert.equal(cards(app.render()).length, 48);
  more().props.onClick();
  assert.equal(cards(app.render()).length, 55);
  assert.equal(more(), undefined);
  input(app.render()).props.onChange({ target: { value: "Person" } });
  assert.equal(cards(app.render()).length, 24);
});

test("highlight links reveal a person beyond the first batch and clean up timers", () => {
  const many = Array.from({ length: 55 }, (_, index) => ({ id: index, name: `Person ${index}`, order: index }));
  const app = harness({ credits: { cast: many }, info, id: "1405", highlight: "50" });
  assert.equal(cards(app.render()).length, 55);
  const cleanup = app.effects[0]();
  [...app.timers.values()][0]();
  assert.deepEqual(app.scrolls, [{ id: "credit-cast-50", behavior: "instant", block: "center" }]);
  cleanup();
  assert.equal(app.timers.size, 0);
});

test("crew-only highlight automatically opens crew and uses unique department IDs", () => {
  const app = harness({ credits: { cast, crew }, info, id: "1405", highlight: "3" });
  assert.ok(cards(app.render()).some((node) => node.props.id === "credit-crew-Directing-3"));
  app.effects[0]();
  [...app.timers.values()][0]();
  assert.equal(app.scrolls[0].id, "credit-crew-Directing-3");
});

test("missing credits and unmatched searches offer intentional empty and reset states", () => {
  assert.ok(harness({ credits: {}, info }).render().some((node) => node.props.children === "No cast available"));
  const app = harness();
  input(app.render()).props.onChange({ target: { value: "not-a-person" } });
  assert.ok(app.render().some((node) => node.props.children === "No matches"));
  app.render().find((node) => node.type === "button" && node.props.children?.[0] === "Reset ").props.onClick();
  assert.equal(cards(app.render()).length, 2);
});
