import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(
  new URL("../components/library/library-state.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  emptyLibraryFilters,
  filterLibrary,
  libraryFilterError,
  restoreLibraryEntry,
} = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const entry = (id, kind = "movie", summary = {}) => ({
  id: String(id),
  kind,
  order: id,
  summary:
    summary === null
      ? null
      : {
          title: "Title " + id,
          release_date: "2024-01-01",
          vote_average: 8,
          ...summary,
        },
});

test("search trims spaces and format filters combine", () => {
  const entries = [entry(1), entry(2, "tv")];
  assert.deepEqual(
    filterLibrary(entries, {
      ...emptyLibraryFilters(),
      search: "  TITLE 2  ",
      format: "tv",
    }).map((item) => item.id),
    ["2"],
  );
});
test("unknown metadata is browsable but excluded by explicit ranges", () => {
  const entries = [
    entry(1),
    entry(2, "movie", null),
    entry(3, "movie", { release_date: null, vote_average: 0 }),
  ];
  assert.equal(filterLibrary(entries, emptyLibraryFilters()).length, 3);
  assert.equal(
    filterLibrary(entries, { ...emptyLibraryFilters(), yearMin: "2020" })
      .length,
    1,
  );
  assert.equal(
    filterLibrary(entries, { ...emptyLibraryFilters(), ratingMin: "0" }).length,
    1,
  );
});
test("crossed and out-of-bounds ranges are invalid", () => {
  assert.match(
    libraryFilterError({
      ...emptyLibraryFilters(),
      yearMin: "2050",
      yearMax: "2020",
    }),
    /earliest/,
  );
  assert.match(
    libraryFilterError({
      ...emptyLibraryFilters(),
      ratingMin: "9",
      ratingMax: "3",
    }),
    /minimum/,
  );
  assert.match(
    libraryFilterError({ ...emptyLibraryFilters(), ratingMax: "11" }),
    /between/,
  );
  assert.match(
    libraryFilterError({ ...emptyLibraryFilters(), yearMin: "2020.5" }),
    /year/,
  );
});
test("release sorts are chronological and missing dates are last in both directions", () => {
  const entries = [
    entry(1, "movie", { release_date: "2020-01-01" }),
    entry(2, "movie", null),
    entry(3),
  ];
  assert.deepEqual(
    filterLibrary(entries, { ...emptyLibraryFilters(), sort: "date_desc" }).map(
      (item) => item.id,
    ),
    ["3", "1", "2"],
  );
  assert.deepEqual(
    filterLibrary(entries, { ...emptyLibraryFilters(), sort: "date_asc" }).map(
      (item) => item.id,
    ),
    ["1", "3", "2"],
  );
});
test("failed removal restores only that title and never duplicates it", () => {
  const a = entry(1),
    b = entry(2),
    c = entry(3);
  const result = restoreLibraryEntry([c], a);
  assert.deepEqual(
    result.map((item) => item.id),
    [a.id, c.id],
  );
  assert.ok(!result.some((item) => item.id === b.id));
  assert.equal(restoreLibraryEntry(result, a), result);
});
test("movie and series IDs do not collide", () => {
  assert.equal(restoreLibraryEntry([entry(1, "tv")], entry(1)).length, 2);
});
