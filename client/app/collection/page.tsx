import type { Metadata } from "next";
import CollectionClient from "@/components/collection/CollectionClient";

export const metadata: Metadata = {
  title: "My collection",
  description: "Your saved movies, series, and favorites in one place.",
};

export default function CollectionPage() {
  return <CollectionClient />;
}
