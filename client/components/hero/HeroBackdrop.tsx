"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TmdbImage } from "@/components/ui/TmdbImage";

type Artwork = {
  slideKey: string;
  src: string;
  mobileSrc: string;
  wideSrc?: string | null;
};

export function HeroBackdrop({
  priority = false,
  ...artwork
}: Artwork & { priority?: boolean }) {
  const reduceMotion = useReducedMotion();
  const key = JSON.stringify(artwork);
  const [layers, setLayers] = useState(() => [{ ...artwork, key, id: 0, ready: true }]);

  if (layers.at(-1)?.key !== key) {
    setLayers(current => [
      ...current.filter(layer => layer.ready),
      { ...artwork, key, id: current.at(-1)!.id + 1, ready: false },
    ]);
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" data-hero-backdrop>
      {layers.map((layer, index) => (
        <motion.div
          key={layer.id}
          initial={index === 0 ? false : { opacity: 0 }}
          animate={{ opacity: layer.ready ? 1 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => {
            if (!layer.ready) return;
            // Keep the outgoing artwork opaque until its replacement covers it.
            setLayers(current => current.at(-1)?.id === layer.id
              ? current.filter(item => item.id === layer.id)
              : current);
          }}
          className="absolute inset-0"
        >
          <picture>
            <source media="(width < 640px)" srcSet={layer.mobileSrc} />
            {layer.wideSrc && <source media="(width >= 1600px)" srcSet={layer.wideSrc} />}
            <TmdbImage
              src={layer.src}
              alt=""
              fill
              sizes="100vw"
              loading="eager"
              fetchPriority={priority ? "high" : "auto"}
              onLoad={async event => {
                await event.currentTarget.decode().catch(() => {});
                setLayers(current => current.at(-1)?.id === layer.id
                  ? current.map(item => item.id === layer.id ? { ...item, ready: true } : item)
                  : current);
              }}
              onError={event => {
                const image = event.currentTarget;
                if (image.src.endsWith("/placeholder-backdrop.svg")) return;
                image.closest("picture")?.querySelectorAll("source").forEach(source => source.remove());
                image.srcset = "";
                image.src = "/placeholder-backdrop.svg";
              }}
              className="object-cover object-[center_25%] sm:object-center"
            />
          </picture>
        </motion.div>
      ))}
    </div>
  );
}
