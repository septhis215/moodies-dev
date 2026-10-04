import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(
  new URL("../app/search/search-state.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const {
  emptyFilters,
  readFilters,
  searchParamsFor,
  filterError,
  forType,
  filterSearchPage,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("unset date and rating bounds are really unbounded", () => {
  const params = searchParamsFor("bad", emptyFilters());
  assert.equal(params.get("year_min"), null);
  assert.equal(params.get("year_max"), null);
  assert.equal(params.get("rating_min"), null);
});
test("all applied filters round-trip through a shareable URL", () => {
  const filters = {
    ...emptyFilters(),
    type: "movie",
    sort: "rating",
    genres: ["Crime", "Drama"],
    countries: ["GB", "US"],
    yearMin: "1960",
    yearMax: "2027",
    ratingMin: "7",
    ratingMax: "9",
    adult: true,
  };
  const params = searchParamsFor(" bad ", filters, 3);
  assert.deepEqual(readFilters(params), filters);
  assert.equal(params.get("q"), "bad");
  assert.equal(params.get("page"), "3");
});
test("genre order does not create a new request identity", () => {
  assert.equal(
    searchParamsFor("bad", {
      ...emptyFilters(),
      genres: ["Drama", "Crime"],
    }).toString(),
    searchParamsFor("bad", {
      ...emptyFilters(),
      genres: ["Crime", "Drama"],
    }).toString(),
  );
});
test("crossed boundaries are rejected, not silently adjusted", () => {
  assert.match(
    filterError({ ...emptyFilters(), yearMin: "2020", yearMax: "1960" }),
    /From year/,
  );
  assert.match(
    filterError({ ...emptyFilters(), ratingMin: "9", ratingMax: "7" }),
    /Minimum rating/,
  );
});
test("People mode removes incompatible title filters", () => {
  const filters = forType(
    {
      ...emptyFilters(),
      genres: ["Crime"],
      yearMin: "1960",
      ratingMin: "7",
      sort: "rating",
      adult: true,
    },
    "person",
  );
  assert.equal(filters.type, "person");
  assert.deepEqual(filters.genres, []);
  assert.equal(filters.yearMin, "");
  assert.equal(filters.sort, "relevance");
  assert.equal(filters.adult, true);
});
test("invalid URL values do not reach the API", () => {
  const filters = readFilters(
    new URLSearchParams(
      "type=invalid&year_min=bad&rating_min=11&year_max=1960.5&genres=Crime,Crime",
    ),
  );
  assert.equal(filters.type, "all");
  assert.equal(filters.yearMin, "");
  assert.equal(filters.yearMax, "");
  assert.equal(filters.ratingMin, "");
  assert.deepEqual(filters.genres, ["Crime"]);
});

test("query constraints preserve people and match any selected genre", () => {
  const items = [
    {
      type: "movie",
      id: 1,
      release_date: "1966-01-01",
      vote_average: 8,
      genres: ["Crime"],
      origin_country: ["US"],
    },
    {
      type: "tv",
      id: 2,
      first_air_date: "2020-01-01",
      vote_average: 6,
      genres: ["Drama"],
    },
    { type: "movie", id: 3, vote_average: 8, genres: ["Drama"] },
    { type: "person", id: 4 },
  ];
  assert.deepEqual(
    filterSearchPage(items, {
      ...emptyFilters(),
      genres: ["Crime", "Drama"],
      yearMin: "1960",
      ratingMin: "7",
    }).map((item) => item.id),
    [1, 4],
  );
  assert.deepEqual(
    filterSearchPage(items, {
      ...emptyFilters(),
      type: "movie",
      countries: ["US"],
    }).map((item) => item.id),
    [1],
  );
});
