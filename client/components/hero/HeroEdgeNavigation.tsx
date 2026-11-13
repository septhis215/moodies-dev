"use client";

import { IconChevronCompactLeft, IconChevronCompactRight } from "@tabler/icons-react";

export function HeroEdgeNavigation({ onNavigate }: { onNavigate: (offset: number) => void }) {
  return (
    <div role="group" aria-label="Featured title navigation" className="pointer-events-none absolute inset-0 z-[9]">
      {[
        { offset: -1, label: "Previous featured title", side: "left-0 before:bg-[radial-gradient(ellipse_at_left_center,black_0%,transparent_72%)]", Icon: IconChevronCompactLeft },
        { offset: 1, label: "Next featured title", side: "right-0 before:bg-[radial-gradient(ellipse_at_right_center,black_0%,transparent_72%)]", Icon: IconChevronCompactRight },
      ].map(({ offset, label, side, Icon }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          onClick={() => onNavigate(offset)}
          className={`group pointer-events-auto absolute inset-y-0 grid w-14 cursor-pointer place-items-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white xl:w-32 ${side} before:absolute before:inset-0 before:opacity-55 hover:before:opacity-100 focus-visible:before:opacity-100 motion-safe:before:transition-opacity motion-safe:before:duration-300`}
        >
          <Icon aria-hidden="true" stroke={2} className="relative size-11 text-white opacity-85 drop-shadow-[0_1px_4px_black] group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:transition-opacity motion-safe:duration-300" />
        </button>
      ))}
    </div>
  );
}
