"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Link>, "prefetch">;

// Large shelves should warm destinations on intent, not as every poster enters view.
export default function IntentPrefetchLink({ href, onMouseEnter, onFocus, ...props }: Props) {
  const [intentHref, setIntentHref] = useState<Props["href"] | null>(null);

  return (
    <Link
      {...props}
      href={href}
      prefetch={intentHref === href ? null : false}
      onMouseEnter={event => {
        onMouseEnter?.(event);
        if (!event.defaultPrevented) setIntentHref(href);
      }}
      onFocus={event => {
        onFocus?.(event);
        if (!event.defaultPrevented) setIntentHref(href);
      }}
    />
  );
}
