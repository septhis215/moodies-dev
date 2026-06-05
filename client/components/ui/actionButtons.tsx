import { cloneElement } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Heart,
  Bookmark,
  Volume2,
  VolumeX,
  Info,
} from "lucide-react";

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
    <div className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[52%] z-30 flex -translate-y-1/2 flex-col items-center gap-2 max-[420px]:right-2 max-[420px]:top-[49%] max-[420px]:gap-1.5 sm:right-5 sm:top-1/2 sm:gap-2.5 md:right-7 xl:right-9 xl:gap-3 2xl:right-12 2xl:gap-3.5 min-[1800px]:right-16 min-[1800px]:gap-4 min-[2200px]:right-[5.5rem] min-[2200px]:gap-5">
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
          className="group flex flex-col items-center gap-1 max-[420px]:gap-0.5 2xl:gap-1.5 min-[1800px]:gap-2"
        >
          <div
            className={`
              relative flex items-center justify-center rounded-full border
              backdrop-blur-md transition-all duration-300 shadow-lg
              h-11 w-11 max-[420px]:h-10 max-[420px]:w-10 max-[360px]:h-9 max-[360px]:w-9 sm:h-12 sm:w-12 md:h-[3.25rem] md:w-[3.25rem] xl:h-14 xl:w-14 2xl:h-16 2xl:w-16 min-[1800px]:h-[4.5rem] min-[1800px]:w-[4.5rem] min-[2200px]:h-20 min-[2200px]:w-20
              ${
                btn.active
                  ? `bg-gradient-to-br ${btn.activeColor} shadow-black/40`
                  : "bg-black/50 border-white/15 group-hover:border-white/35 group-hover:bg-black/60"
              }
            `}
          >
            {btn.icon &&
              cloneElement(btn.icon as React.ReactElement, {
                className: [
                  "h-4 w-4 transition-transform duration-200 group-hover:scale-110 max-[360px]:h-3.5 max-[360px]:w-3.5 sm:h-5 sm:w-5 xl:h-5.5 xl:w-5.5 2xl:h-6 2xl:w-6 min-[1800px]:h-7 min-[1800px]:w-7 min-[2200px]:h-8 min-[2200px]:w-8",
                  btn.iconClass ??
                    (btn.active
                      ? "text-white"
                      : "text-white/80 group-hover:text-white"),
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
            className={`text-[10px] font-semibold tracking-wide transition-colors duration-200 select-none max-[420px]:text-[9px] max-[360px]:text-[8px] sm:text-[10px] xl:text-[11px] 2xl:text-xs min-[1800px]:text-[13px] min-[2200px]:text-sm
              ${btn.active ? "text-white" : "text-white/55 group-hover:text-white/80"}`}
          >
            {btn.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
