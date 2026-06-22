"use client";

import { motion } from "framer-motion";
import {
  Bookmark,
  Heart,
  Info,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonsProps {
  isPlaying: boolean;
  liked: boolean;
  saved: boolean;
  muted: boolean;
  panelOpen: boolean;
  togglePlayPause: () => void;
  onLike: () => void;
  setSaved: () => void;
  toggleMute: () => void;
  onInfo: () => void;
  className?: string;
}

export default function ActionButtons({
  isPlaying,
  liked,
  saved,
  muted,
  panelOpen,
  togglePlayPause,
  onLike,
  setSaved,
  toggleMute,
  onInfo,
  className,
}: ActionButtonsProps) {
  const buttons = [
    {
      key: "play",
      onClick: togglePlayPause,
      icon: isPlaying ? Pause : Play,
      label: isPlaying ? "Pause" : "Play",
      active: false,
      activeClass: "text-white",
      hoverClass: "group-hover:text-white",
      filled: false,
    },
    {
      key: "like",
      onClick: onLike,
      icon: Heart,
      label: "Like",
      active: liked,
      activeClass: "text-rose-500",
      hoverClass: "group-hover:text-rose-300",
      filled: liked,
    },
    {
      key: "save",
      onClick: setSaved,
      icon: Bookmark,
      label: "Save",
      active: saved,
      activeClass: "text-emerald-400",
      hoverClass: "group-hover:text-emerald-300",
      filled: saved,
    },
    {
      key: "sound",
      onClick: toggleMute,
      icon: muted ? VolumeX : Volume2,
      label: muted ? "Unmute" : "Sound",
      active: false,
      activeClass: "text-white",
      hoverClass: "group-hover:text-white",
      filled: false,
    },
    {
      key: "details",
      onClick: onInfo,
      icon: Info,
      label: "Details",
      active: panelOpen,
      activeClass: "text-sky-400",
      hoverClass: "group-hover:text-sky-300",
      filled: false,
    },
  ];

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 sm:gap-2.5 lg:gap-3",
        className,
      )}
      aria-label="Video actions"
    >
      {buttons.map((button, index) => {
        const Icon = button.icon;

        return (
          <motion.button
            key={button.key}
            type="button"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              delay: index * 0.045,
              duration: 0.22,
              ease: "easeOut",
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.86 }}
            onClick={button.onClick}
            aria-label={button.label}
            aria-pressed={button.active}
            className="group flex min-h-14 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-white/85 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:min-h-16 sm:min-w-14 sm:gap-1"
          >
            <motion.span
              animate={button.active ? { scale: [1, 1.18, 1] } : { scale: 1 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={cn(
                "grid h-9 w-10 place-items-center transition-colors duration-200 sm:h-10 sm:w-11",
                "drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)]",
                button.active
                  ? button.activeClass
                  : cn("text-white/90", button.hoverClass),
              )}
            >
              <Icon
                className={cn(
                  "h-6 w-6 transition-transform duration-200 group-hover:scale-110 sm:h-7 sm:w-7",
                  button.key === "play" && !isPlaying && "translate-x-px",
                )}
                fill={button.filled ? "currentColor" : "none"}
                strokeWidth={2.25}
                aria-hidden="true"
              />
            </motion.span>
            <span
              className={cn(
                "select-none text-[10px] font-semibold leading-none tracking-wide text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,1)] transition-colors sm:text-[11px]",
                button.active && button.activeClass,
              )}
            >
              {button.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
