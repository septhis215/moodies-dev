"use client";

import type { ComponentProps } from "react";
import { MediaShelf } from "@/components/media/MediaShelf";
import { readHomepageTitles } from "@/lib/homepage-sections";
import DeferredSectionData from "./DeferredSectionData";

function readTitles(data: unknown) {
  const rows = data && typeof data === "object" && "data" in data ? data.data : data;
  if (!Array.isArray(rows)) throw new Error("Invalid section titles");
  return readHomepageTitles(data);
}

export function DeferredMediaShelf({ endpoint, ...props }: Omit<ComponentProps<typeof MediaShelf>, "items"> & { endpoint: string }) {
  return <DeferredSectionData id={props.id} label={props.title} endpoint={endpoint} decode={readTitles}>
    {items => <MediaShelf {...props} items={items} />}
  </DeferredSectionData>;
}

export default DeferredMediaShelf;
