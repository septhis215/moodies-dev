import NextImage, { type ImageProps } from "next/image";
import { isTmdbImageUrl } from "@/lib/tmdb";

export function TmdbImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : null;
  const shouldBypassOptimizer = isTmdbImageUrl(src);

  return (
    <NextImage
      {...props}
      unoptimized={shouldBypassOptimizer || props.unoptimized}
    />
  );
}

export default TmdbImage;
