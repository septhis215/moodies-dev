// File: Navbar.tsx
"use client";

import React, { useEffect, useRef, useState, Fragment } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  IconMenu2,
  IconX,
  IconUsers,
  IconMoodSmile,
  IconUser,
  IconSettings,
  IconLogout,
  IconLogin,
  IconUserPlus,
  IconChevronDown,
  IconMovie,
} from "@tabler/icons-react";
import {
  Tv
} from "lucide-react";
import {
  Navbar,
  NavBody,
  NavbarLogo,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
} from "./ui/resizable-navbar";
import SearchBar from "./ui/searchbar";
import Link from "next/link";
import {
  Bookmark,
  Heart,
  Infinity,
  List,
  Loader,
  MouseIcon,
  PhoneIcon,
  Repeat,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthProvider";
import DropdownPortal from "./ui/dropdownPortal";
import { useToast } from "@/app/context/ToastContext";

const routes = [
  { name: "Home", href: "/" },
  { name: "Movies", href: "/movies" },
  { name: "Series", href: "/tv" },
  // { name: "Community", href: "/community" },
  { name: "Your Moods", href: "/moods/explore", noLink: true },
  { name: "My Collection", href: "/collection", noLink: true },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
type User = {
  name: string;
  username?: string;
  email: string;
  avatarUrl?: string;
};

const MOODIES_LOGO = "/images/moodies-transparent.png";
const MOODIES_SIZE = { width: 30, height: 30 };

export function NavbarComponent() {
  const router = useRouter();

  const [isMenuOpen, setIsMenuOpen] = useState(false); // for the big site menu (menu-portal)
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const createdPortalRef = useRef<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string>(routes[0].href);
  const [activeMobileRoute, setActiveMobileRoute] = useState<string | null>(null);
  const [mobileExpandedRoute, setMobileExpandedRoute] = useState<string | null>(routes[0].href);
  const { user, isAuthenticated, logoutSilent } = useAuth();
  const { toast } = useToast();

  const routeOptions: Record<string, { label: string; path: string }[]> = {
    "/": [
      { label: "Trending", path: "/trending" },
      { label: "New Releases", path: "/new-releases" },
      { label: "Korean Hits", path: "/korea-hits" },
      { label: "Moods", path: "/moods/explore" },
      { label: "Coming Soon", path: "/coming-soon" },
    ],

    "/movies": [
      { label: "Box Office Hits", path: "/movies/box-office" },
      { label: "New Releases", path: "/movies/new-releases" },
      { label: "Featured Now", path: "/movies/featured" },
      { label: "Korean Cinema", path: "/movies/korean-cinema" },
      { label: "Action-Packed", path: "/movies/action" },
      { label: "Award Winners", path: "/movies/award-winners" },
      { label: "Animated Magic", path: "/movies/animated" },
      { label: "Indie Spotlight", path: "/movies/indie" },
      { label: "Moods Matcher", path: "/movies#moods" },
    ],

    "/tv": [
      { label: "Airing Today", path: "/tv/airing/today" },
      { label: "Trending Now", path: "/tv/trending" },
      { label: "New Releases", path: "/tv/new-releases" },
      { label: "Top Rated", path: "/tv/top-rated" },
      { label: "Airing This Week", path: "/tv/airing/week" },
      { label: "K-Drama Collection", path: "/tv/k-drama" },
      { label: "Moods Matcher", path: "/tv#moods" },
    ],

    "/moods": [
      { label: "Moodies Feed", path: "/feed" },
      { label: "Mood Wheels", path: "/moods" },
      { label: "Personality Quiz", path: "/quiz" },
    ],

    "/moods/explore": [
      { label: "Mood Wheels", path: "/moods" },
      { label: "Movie Matcher", path: "/movies#moods" },
      { label: "TV Matcher", path: "/tv#moods" },
      { label: "Personality Quiz", path: "/quiz" },
      { label: "Moodies Feed", path: "/feed" },
    ],

    "/collection": [
      { label: "My List", path: "/watchlist" },
      { label: "My Likes", path: "/liked" },
    ],
  };
  const dropdownTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownContentRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // hover timer to avoid flicker
  const hoverTimeoutRef = useRef<number | null>(null);

  const openProfile = (immediate = false) => {
    if (!dropdownTriggerRef.current) return;
    const rect = dropdownTriggerRef.current.getBoundingClientRect();

    setDropdownPosition({
      top: rect.bottom + 8,
      left: rect.right - 224,
    });

    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    if (immediate) setIsProfileOpen(true);
    else setIsProfileOpen(true);
  };

  const closeProfile = (delay = 120) => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsProfileOpen(false);
      hoverTimeoutRef.current = null;
    }, delay) as unknown as number;
  };

  const toggleProfile = () => {
    if (isProfileOpen) {
      setIsProfileOpen(false);
    } else {
      openProfile(true);
    }
  };

  const logout = () => {
    setIsProfileOpen(false);

    toast(
      "You've been logged out successfully",
      "info",
      3000,
      "Goodbye!",
      MOODIES_LOGO,
      MOODIES_SIZE
    );

    setTimeout(() => {
      logoutSilent();
    }, 500);
  };

  // Create/find portal root on mount. Clean up if we created it.
  useEffect(() => {
    if (typeof document === "undefined") return;

    let el = document.getElementById("menu-portal") as HTMLElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "menu-portal";
      document.body.appendChild(el);
      createdPortalRef.current = true;
    }
    setPortalRoot(el);

    return () => {
      if (createdPortalRef.current && el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    };
  }, []);

  // close on Escape (still closes both)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileOpen(false);
        setIsMenuOpen(false);
        setIsMobileOpen(false);
        setIsMobileSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // lock body scroll while desktop SITE menu is open (NOT the profile dropdown)
  useEffect(() => {
    if (isMenuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [isMenuOpen]);

  // close profile on outside click (works across portal boundary)
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      if (
        dropdownTriggerRef.current &&
        dropdownTriggerRef.current.contains(target)
      ) {
        // clicked trigger -> let button click handler handle toggling
        return;
      }
      if (
        dropdownContentRef.current &&
        dropdownContentRef.current.contains(target)
      ) {
        // clicked inside dropdown content -> keep open
        return;
      }

      // otherwise close profile dropdown
      setIsProfileOpen(false);
    };

    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  // The full dropdown panel (rendered into portalRoot)
  const menuNode = (
    <AnimatePresence>
      {isMenuOpen && (
        <motion.div
          key="menu-dropdown"
          id="site-menu"
          transition={{
            type: "spring",
            stiffness: 280,
            damping: 30,
            mass: 0.8,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4"
          style={{
            backdropFilter: "blur(24px)",
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.88) 0%, rgba(15,15,25,0.92) 100%)",
            willChange: "opacity",
          }}
          onClick={() => setIsMenuOpen(false)}
        >
          {/* Animated background particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(25)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: Math.random() * 3 + 1,
                  height: Math.random() * 3 + 1,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  background: `rgba(233, 79, 55, ${Math.random() * 0.3 + 0.1})`,
                }}
                animate={{
                  y: [0, -30, 0],
                  x: [0, Math.random() * 20 - 10, 0],
                  opacity: [0.2, 0.8, 0.2],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: Math.random() * 2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>

          {/* Main content card */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
              opacity: { duration: 0.25 },
            }}
            className="relative flex flex-col lg:flex-row w-full mx-auto rounded-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "min(960px, calc(100vw - 1.5rem))",
              height: "min(82svh, 560px)",
              minHeight: 0,
              background:
                "linear-gradient(135deg, rgba(20,20,30,0.98) 0%, rgba(10,10,15,0.96) 100%)",
              boxShadow:
                "0 50px 100px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 100px rgba(233,79,55,0.15)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Gradient overlay borders */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#e94f37]/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#e94f37]/30 to-transparent" />
            </div>

            {/* LEFT SECTION - Navigation */}
            <div
              className="flex-1 lg:basis-[45%] flex flex-col justify-start relative"
              style={{
                padding: "clamp(1rem, 2.5vw, 1.75rem) clamp(1rem, 2.5vw, 1.6rem)",
                gap: "clamp(0.5rem, 1.5vh, 1.1rem)",
                background:
                  "radial-gradient(circle at top left, rgba(233,79,55,0.12), transparent 70%)",
              }}
            >
              {/* Decorative corner element */}
              <div className="absolute top-0 left-0 w-32 h-32 opacity-20">
                <div className="absolute inset-0 bg-gradient-to-br from-[#e94f37] to-transparent blur-3xl" />
              </div>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative z-10"
              >
                <h2
                  className="font-bold leading-tight mb-1"
                  style={{
                    fontSize: "clamp(1.25rem, 2.5vw, 2rem)",
                    background:
                      "linear-gradient(135deg, #ffffff 0%, #e0e0e0 50%, #888 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Explore
                </h2>
                <p
                  className="text-gray-400 font-light"
                  style={{ fontSize: "clamp(0.7rem, 1.2vw, 0.82rem)" }}
                >
                  Discover what moves you
                </p>
              </motion.div>

              {/* Navigation Links */}

              <nav
                className="flex flex-col relative z-10 mt-4"
                style={{ gap: "clamp(0.2rem, 0.8vh, 0.6rem)" }}
              >
                {routes.map((r, idx) => {
                  const isActive = activeRoute === r.href;

                  return (
                    <motion.div
                      key={r.href}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + idx * 0.05, duration: 0.4 }}
                      className="relative"
                    >
                      <div className="flex items-center justify-between">
                        {/* ROOT OPTION (button, not link) */}
                        <button
                          type="button"
                          onClick={() => setActiveRoute(r.href)}
                          className="group relative flex items-center flex-1 text-left pl-4 py-2 rounded-2xl transition-all"
                        >
                          {/* Active glow bar */}
                          <motion.div
                            className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 rounded-full bg-gradient-to-b from-[#e94f37] to-orange-500"
                            initial={false}
                            animate={{
                              height: isActive ? "2.5rem" : 0,
                              opacity: isActive ? 1 : 0,
                            }}
                            transition={{ duration: 0.25 }}
                          />

                          <span
                            className={`font-semibold transition-colors ${isActive
                              ? "text-[#e94f37]"
                              : "text-gray-300 group-hover:text-white"
                              }`}
                            style={{
                              fontSize: "clamp(0.8rem, 1.6vw, 1.15rem)",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {r.name}
                          </span>
                        </button>

                        {/* GO TO ROOT BUTTON */}
                        {!r.noLink && (
                          <Link
                            href={r.href}
                            onClick={() => setIsMenuOpen(false)}
                            className="
                              ml-3 px-3 py-1 rounded-full text-sm font-medium
                              text-[#e94f37]
                              bg-[#e94f37]/10
                              border border-[#e94f37]/30
                              hover:bg-[#e94f37]/20
                              hover:border-[#e94f37]/50
                              transition
                            "
                          >
                            Go to {r.name}
                          </Link>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </nav>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-auto text-gray-500 text-sm font-light relative z-10"
              >
                © {new Date().getFullYear()} Moodies • All rights reserved
              </motion.div>
            </div>

            {/* DIVIDER */}
            <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

            {/* RIGHT SECTION - Dynamic Content */}
            <div
              className="lg:basis-[55%] flex flex-col relative overflow-hidden min-h-0"
              style={{
                padding: "clamp(1rem, 2.5vw, 1.75rem) clamp(1rem, 2.5vw, 1.6rem)",
                background:
                  "radial-gradient(circle at bottom right, rgba(233,79,55,0.08), transparent 60%)",
                flex: "0 0 55%",
              }}
            >
              {/* Decorative corner element */}
              <div className="absolute bottom-0 right-0 w-40 h-40 opacity-15">
                <div className="absolute inset-0 bg-gradient-to-tl from-orange-500 to-transparent blur-3xl" />
              </div>

              {/* Content area */}
              <motion.div
                key={activeRoute}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex-1 flex flex-col relative z-10 min-h-0 overflow-y-auto hide-scrollbar"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  overflowY: "auto",
                }}
              >
                {/* Section Title */}
                <div className="mb-3">
                  <motion.div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e94f37]/10 border border-[#e94f37]/30 mb-2"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="w-2 h-2 rounded-full bg-[#e94f37] animate-pulse" />
                    <span className="text-[#e94f37] text-sm font-medium">
                      {routes.find((x) => x.href === activeRoute)?.name}
                    </span>
                  </motion.div>

                  <h3
                    className="font-bold text-white leading-tight"
                    style={{ fontSize: "clamp(0.95rem, 1.6vw, 1.3rem)" }}
                  >
                    Quick Actions
                  </h3>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2">
                  {(routeOptions[activeRoute] || []).map((opt, idx) => (
                    <motion.div
                      key={opt.path}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.05 }}
                    >
                      <Link
                        href={opt.path}
                        onClick={() => setIsMenuOpen(false)}
                        className="group relative block p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-[#e94f37]/50 transition-all duration-300 overflow-hidden"
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-br from-[#e94f37]/10 via-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          initial={false}
                        />
                        <div className="relative z-10">
                          <span className="text-white font-medium block mb-1 group-hover:text-[#e94f37] transition-colors">
                            {opt.label}
                          </span>
                          <span className="text-gray-500 text-sm">
                            Explore →
                          </span>
                        </div>
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#e94f37]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Profile Section - pinned to bottom */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative z-10 flex-shrink-0 pt-4 mt-2 border-t border-white/[0.08]"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar with gradient ring */}
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#e94f37] to-orange-500 blur-md opacity-50" />
                    <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-[#e94f37] to-orange-500 p-[2px]">
                      <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden">
                        {user?.provider === 'google' && user?.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.username || "User"}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-xl font-bold text-gray-300">
                            {(
                              user?.username?.[0] ||
                              user?.name?.[0] ||
                              "G"
                            ).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* User info */}
                  <div className="flex-1">
                    <h4 className="text-white font-semibold text-base">
                      {user?.username ?? user?.name ?? "Guest"}
                    </h4>
                    <p className="text-gray-400 text-sm">
                      {user?.email || "Sign in for more features"}
                    </p>
                  </div>

                  {/* Action button */}
                  {isAuthenticated ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setIsMenuOpen(false);
                        logout();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-medium transition-all"
                    >
                      Logout
                    </motion.button>
                  ) : (
                    <Link
                      href="/auth/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#e94f37] to-orange-500 hover:from-[#e94f37]/90 hover:to-orange-500/90 text-white font-medium transition-all"
                    >
                      Sign In
                    </Link>
                  )}
                </div>
              </motion.div>
            </div>


          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <Navbar className="">
      <NavBody className="hidden lg:flex">
        <NavbarLogo />

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          <Link
            href="/movies"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            title="Movies"
          >
            <IconMovie size={20} className="!w-5 !h-5" />
            <span className="text-sm font-medium">Movies</span>
          </Link>

          <Link
            href="/tv"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            title="Series"
          >
            <Tv size={20} className="!w-5 !h-5" />
            <span className="text-sm font-medium">Series</span>
          </Link>

          <Link
            href="/feed"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            title="Your Feed"
          >
            <MouseIcon size={20} className="!w-5 !h-5" />
            <span className="text-sm font-medium">Feed</span>
          </Link>

          <Link
            href="/moods/explore"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            title="Your Moods"
          >
            <IconMoodSmile size={20} className="!w-5 !h-5" />
            <span className="text-sm font-medium">Moods</span>
          </Link>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="inline-flex items-center">
            <SearchBar
              placeholder="Search movies, series..."
              onSearch={(q) => {
                console.log("search:", q);
              }}
            />
          </div>

          {/* Menu Button */}
          <button
            aria-expanded={isMenuOpen}
            aria-controls="site-menu"
            onClick={() => setIsMenuOpen((s) => !s)}
            className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-600 transition-all"
            title="Open menu"
          >
            <IconMenu2 size={20} />
          </button>

          {/* Divider */}
          <div className="h-8 w-px bg-slate-700/50" />

          {/* Profile Section */}
          <div
            className="relative"
            onMouseEnter={() => openProfile()}
            onMouseLeave={() => closeProfile()}
          >
            <button
              ref={dropdownTriggerRef}
              onClick={toggleProfile}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-all"
            >
              {/* Avatar */}
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden ring-2 ring-slate-800 group-hover:ring-slate-600 transition-all">
                {user?.provider === 'google' && user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username || "User"}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-300">
                    {(
                      user?.username?.[0] ||
                      user?.name?.[0] ||
                      "G"
                    ).toUpperCase()}
                  </span>
                )}
              </div>

              {/* User Info */}
              <div className="hidden xl:block text-left">
                <div className="text-sm font-semibold text-white leading-tight">
                  {user?.username ?? user?.name ?? "Guest"}
                </div>
                <div className="text-xs text-gray-400">
                  {isAuthenticated ? "View Profile" : "Sign In"}
                </div>
              </div>

              {/* Dropdown Icon */}
              <IconChevronDown
                size={16}
                className="text-gray-400 hidden xl:block"
              />
            </button>

            <DropdownPortal>
              {isProfileOpen && (
                <div
                  ref={dropdownContentRef}
                  onMouseEnter={() => {
                    // keep open while hovering dropdown content
                    if (hoverTimeoutRef.current) {
                      window.clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    setIsProfileOpen(true);
                  }}
                  onMouseLeave={() => closeProfile()}
                  className="fixed z-[999999] w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden backdrop-blur-sm transition-all"
                  style={{
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                  }}
                >
                  {/* Header */}
                  <div className="p-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                        {user?.provider === 'google' && user?.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.username || "User"}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-sm font-bold text-slate-300">
                            {(
                              user?.username?.[0] ||
                              user?.name?.[0] ||
                              "G"
                            ).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {user?.username ?? user?.name ?? "Guest"}
                        </div>
                        <div className="text-xs text-gray-400 truncate">
                          {user?.email || "Sign in for more features"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-2">
                    {isAuthenticated ? (
                      <>
                        <Link
                          href="/profile"
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <IconUser size={18} />
                          <span>My Profile</span>
                        </Link>

                        <Link
                          href="/watchlist"
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <Bookmark size={18} />
                          <span>My List</span>
                        </Link>

                        <Link
                          href="/liked"
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <Heart size={18} />
                          <span>My Likes</span>
                        </Link>

                        <div className="my-2 h-px bg-slate-800" />

                        <button
                          onClick={() => {
                            setIsProfileOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                        >
                          <IconLogout size={18} />
                          <span>Logout</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/auth/login"
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <IconLogin size={18} />
                          <span>Login</span>
                        </Link>

                        <Link
                          href="/auth/signup"
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <IconUserPlus size={18} />
                          <span>Sign Up</span>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </DropdownPortal>
          </div>
        </div>
      </NavBody>

      {/* MOBILE NAV */}
      <MobileNav visible>
        <MobileNavHeader className="w-full px-1">
          <div className="flex items-center">
            <NavbarLogo className="mr-0" />
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex">
              <SearchBar
                placeholder="Search movies, series..."
                onSearch={(q) => console.log("search", q)}
              />
            </div>

            <MobileNavToggle
              isOpen={isMobileOpen}
              onClick={() => setIsMobileOpen((s) => !s)}
            />
          </div>
        </MobileNavHeader>
      </MobileNav>

      {/* Mobile menu content */}
      <MobileNavMenu
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      >
        <div className="w-full px-4 pb-6">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            className="relative flex flex-col gap-1 py-2"
          >
            {/* Header */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: -10 }, visible: { opacity: 1, y: 0 } }}
              className="mb-3"
            >
              <h3 className="text-2xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
                Explore
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Tap a section to expand</p>
            </motion.div>

            {/* Accordion nav */}
            {routes.map((r) => {
              const subOptions = routeOptions[r.href] || [];
              const isExpanded = mobileExpandedRoute === r.href;
              const hasOptions = subOptions.length > 0;

              return (
                <motion.div
                  key={r.href}
                  variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                  className="rounded-xl overflow-hidden border border-white/[0.06]"
                >
                  {/* Row header */}
                  <button
                    type="button"
                    onClick={() =>
                      setMobileExpandedRoute(isExpanded ? null : r.href)
                    }
                    className={`w-full flex items-center justify-between px-4 py-3 transition-all ${isExpanded
                      ? "bg-white/[0.07]"
                      : "bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded && (
                        <span className="w-1 h-4 rounded-full bg-gradient-to-b from-[#e94f37] to-orange-500 inline-block" />
                      )}
                      <span
                        className={`font-semibold text-base transition-colors ${isExpanded ? "text-[#e94f37]" : "text-gray-200"
                          }`}
                      >
                        {r.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!r.noLink && (
                        <Link
                          href={r.href}
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsMobileOpen(false);
                          }}
                          className="text-xs px-2.5 py-1 rounded-full text-[#e94f37] bg-[#e94f37]/10 border border-[#e94f37]/30 hover:bg-[#e94f37]/20 transition"
                        >
                          Go →
                        </Link>
                      )}
                      {hasOptions && (
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <IconChevronDown size={16} className="text-gray-400" />
                        </motion.div>
                      )}
                    </div>
                  </button>

                  {/* Sub-options */}
                  <AnimatePresence initial={false}>
                    {isExpanded && hasOptions && (
                      <motion.div
                        key="sub"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-2 p-3 bg-black/20">
                          {subOptions.map((opt) => (
                            <Link
                              key={opt.path}
                              href={opt.path}
                              onClick={() => setIsMobileOpen(false)}
                              className="group flex flex-col p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-[#e94f37]/40 hover:bg-white/[0.07] transition-all"
                            >
                              <span className="text-sm font-medium text-white group-hover:text-[#e94f37] transition-colors">
                                {opt.label}
                              </span>
                              <span className="text-xs text-gray-500 mt-0.5">Explore →</span>
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {/* Profile section */}
            <motion.div
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              className="mt-4 pt-4 border-t border-white/[0.08]"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#e94f37] to-orange-500 blur-md opacity-40" />
                  <div className="relative h-11 w-11 rounded-xl bg-gradient-to-br from-[#e94f37] to-orange-500 p-[2px]">
                    <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center overflow-hidden">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username || "User"} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-gray-300">
                          {(user?.username?.[0] || user?.name?.[0] || "G").toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {user?.username ?? user?.name ?? "Guest"}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {user?.email || "Sign in for more features"}
                  </div>
                </div>
                {isAuthenticated ? (
                  <button
                    onClick={() => { setIsMobileOpen(false); logout(); }}
                    className="text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition"
                  >
                    Logout
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMobileOpen(false)}
                    className="text-sm px-3 py-2 rounded-lg bg-gradient-to-r from-[#e94f37] to-orange-500 text-white font-medium transition"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </motion.div>

            <motion.div
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              className="mt-4 text-xs text-gray-600 text-center"
            >
              © {new Date().getFullYear()} Moodies
            </motion.div>
          </motion.div>
        </div>
      </MobileNavMenu>

      {/* Portal render */}
      {portalRoot ? createPortal(menuNode, portalRoot) : null}

      {/* Mobile search full-screen modal */}
      <AnimatePresence>
        {isMobileSearchOpen && (
          <motion.div
            key="mobile-search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 bg-[rgba(0,0,0,0.65)]"
            onClick={() => setIsMobileSearchOpen(false)}
          >
            <motion.form
              onClick={(e) => e.stopPropagation()}
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              exit={{ y: -20 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}
              className="w-full max-w-xl px-6"
              onSubmit={(e) => {
                e.preventDefault();
                setIsMobileSearchOpen(false);
              }}
            >
              <input
                autoFocus
                placeholder="Search movies, series..."
                className="w-full rounded-full px-4 py-3 bg-white/6 text-white placeholder:text-gray-300 outline-none"
              />
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </Navbar>
  );
}

export default NavbarComponent;
