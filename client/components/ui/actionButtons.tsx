import { cloneElement } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Heart, Bookmark, Volume2, VolumeX, Info } from "lucide-react";

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
}: {
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
}) {
  const buttons = [
    {
      onClick: togglePlayPause,
      icon: isPlaying ? <Pause /> : <Play />,
      label: isPlaying ? "Pause" : "Play",
      active: isPlaying,
      activeColor: "from-white/20 to-white/10 border-white/40",
      glowColor: null as string | null,
      iconClass: null as string | null,
    },
    {
      onClick: onLike,
      icon: <Heart fill={liked ? "currentColor" : "none"} />,
      label: "Like",
      active: liked,
      activeColor: "from-rose-500/80 to-red-600/80 border-rose-400/60",
      glowColor: "rgba(244,63,94,0.5)",
      iconClass: null,
    },
    {
      onClick: () => setSaved(),
      icon: <Bookmark fill={saved ? "currentColor" : "none"} />,
      label: "Save",
      active: saved,
      activeColor: "from-amber-400/80 to-orange-500/80 border-amber-300/60",
      glowColor: "rgba(251,191,36,0.45)",
      iconClass: null,
    },
    {
      onClick: toggleMute,
      icon: muted ? <VolumeX /> : <Volume2 />,
      label: muted ? "Unmute" : "Sound",
      active: !muted,
      activeColor: "from-white/20 to-white/10 border-white/40",
      glowColor: null,
      iconClass: null,
    },
    {
      onClick: onInfo,
      icon: <Info />,
      label: "Details",
      active: panelOpen,
      // Solid white background when active so it's clearly "open"
      activeColor: "from-white/95 to-white/85 border-white/60",
      glowColor: "rgba(255,255,255,0.18)",
      // Invert icon colour on white background
      iconClass: panelOpen ? "text-black" : null,
    },
  ];

  return (
    <div className="absolute right-4 bottom-28 sm:right-5 sm:bottom-32 md:right-7 md:bottom-36 flex flex-col gap-2 z-30">
      {buttons.map((btn, idx) => (
        <motion.button
          key={idx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.055, duration: 0.3, ease: "easeOut" }}
          whileHover={{ scale: 1.08, x: -2 }}
          whileTap={{ scale: 0.93 }}
          onClick={btn.onClick}
          aria-label={btn.label}
          className="group flex flex-col items-center gap-1"
        >
          <div
            className={`
              relative flex items-center justify-center rounded-full border
              backdrop-blur-md transition-all duration-300 shadow-lg
              w-11 h-11 sm:w-12 sm:h-12
              ${btn.active
                ? `bg-gradient-to-br ${btn.activeColor} shadow-black/40`
                : "bg-black/50 border-white/15 group-hover:border-white/35 group-hover:bg-black/60"
              }
            `}
          >
            {btn.icon &&
              cloneElement(btn.icon as React.ReactElement, {
                className: [
                  "transition-transform duration-200 group-hover:scale-110 w-4 h-4 sm:w-5 sm:h-5",
                  btn.iconClass ?? (btn.active ? "text-white" : "text-white/80 group-hover:text-white"),
                ].join(" "),
              })}

            {btn.active && btn.glowColor && (
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ boxShadow: `0 0 12px ${btn.glowColor}` }}
              />
            )}
          </div>

          <span
            className={`text-[10px] font-semibold tracking-wide transition-colors duration-200 select-none
              ${btn.active ? "text-white" : "text-white/55 group-hover:text-white/80"}`}
          >
            {btn.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}