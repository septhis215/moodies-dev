import { cloneElement, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Heart, Bookmark, Volume2, VolumeX } from "lucide-react";

export default function ActionButtons({
  isPlaying,
  liked,
  saved,
  muted,
  togglePlayPause,
  setLiked,
  setSaved,
  toggleMute,
}) {
  const [visible, setVisible] = useState(false);
  const [idleTimer, setIdleTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const show = () => {
      setVisible(true);
      if (idleTimer) clearTimeout(idleTimer);
      setIdleTimer(setTimeout(() => setVisible(false), 2500));
    };
    window.addEventListener("touchstart", show);
    return () => window.removeEventListener("touchstart", show);
  }, [idleTimer]);

  // Show buttons when cursor moves near right edge
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nearRight = window.innerWidth - e.clientX < 300;
      if (nearRight) {
        setVisible(true);
        if (idleTimer) clearTimeout(idleTimer);
        setIdleTimer(setTimeout(() => setVisible(false), 2500));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [idleTimer]);

  // Define button configs
  const buttons = [
    {
      onClick: togglePlayPause,
      icon: isPlaying ? <Pause /> : <Play />,
      label: isPlaying ? "Playing" : "Paused",
      active: isPlaying,
    },
    {
      onClick: () => setLiked((l) => !l),
      icon: <Heart />,
      label: liked ? "Liked" : "Like",
      active: liked,
    },
    {
      onClick: () => setSaved((s) => !s),
      icon: <Bookmark />,
      label: saved ? "Saved" : "Save",
      active: saved,
    },
    {
      onClick: toggleMute,
      icon: muted ? <VolumeX /> : <Volume2 />,
      label: muted ? "Muted" : "Sound",
      active: !muted,
    },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="actions"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute right-3 sm:right-6 bottom-12 sm:bottom-20 flex flex-col gap-3 sm:gap-4 z-30"
        >
          {buttons.map((btn, idx) => (
            <motion.button
              key={idx}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={btn.onClick}
              className="group flex flex-col items-center gap-0.5 sm:gap-1"
            >
              <div
                className={`flex items-center justify-center rounded-full border transition-all duration-300 backdrop-blur-sm
                  ${btn.active
                    ? "bg-gradient-to-r from-[#e94f37] to-[#ff6b58] border-transparent shadow-[0_0_8px_rgba(233,79,55,0.6)]"
                    : "bg-black/40 border-white/20 group-hover:border-white/40 group-hover:bg-white/10"}
                  w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14
                `}
              >
                {btn.icon &&
                  cloneElement(btn.icon, {
                    className:
                      "text-white w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7",
                  })}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] md:text-xs lg:text-sm font-medium transition-colors duration-200 ${
                  btn.active
                    ? "text-white"
                    : "text-white/75 group-hover:text-white"
                }`}
              >
                {btn.label}
              </span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
