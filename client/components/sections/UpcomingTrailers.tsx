"use client";

import { TrailerShelf, type TrailerShelfOptions } from "./TrailerShelf";

export function UpcomingTrailers({
  title = "Coming Soon",
  subtitle = "Release dates and first looks for titles arriving next.",
  endpoint = "/all/upcoming-trailers",
  data,
}: TrailerShelfOptions) {
  return <TrailerShelf title={title} subtitle={subtitle} endpoint={endpoint} data={data} upcoming />;
}
