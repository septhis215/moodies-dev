"use client";

import { TrailerShelf, type TrailerShelfOptions } from "./TrailerShelf";

export default function PremiereHighlights({
  title = "Fresh Off the Screen",
  subtitle = "Brand-new releases to set the mood.",
  endpoint = "/all/trailers",
  data,
}: TrailerShelfOptions) {
  return <TrailerShelf title={title} subtitle={subtitle} endpoint={endpoint} data={data} />;
}
