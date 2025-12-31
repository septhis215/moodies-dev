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
} from "@tabler/icons-react";
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
  { name: "Your Moods", href: "/moods" },
  { name: "Your List", href: "/watchlist" },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
type User = {
  name: string;
  username?: string;
  email: string;
  avatarUrl?: string;
};

const MOODIES_LOGO = "/images/moodies.png";
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
  const [activeMobileRoute, setActiveMobileRoute] = useState<string | null>(
    null
  );
  const { user, isAuthenticated, logoutSilent } = useAuth();
  const { toast } = useToast();

  const routeOptions: Record<string, { label: string; path: string }[]> = {
    "/": [
      { label: "Trending", path: "/trending" },
      { label: "New Releases", path: "/new-releases" },
      { label: "Korean Hits", path: "/korea-hits" },
      { label: "Moods", path: "/moods" },
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
      { label: "Moods Matcher", path: "/movies/moods" },
    ],

    "/tv": [
      { label: "Airing Today", path: "/tv/airing/today" },
      { label: "Trending Now", path: "/tv/trending" },
      { label: "New Releases", path: "/tv/new-releases" },
      { label: "Top Rated", path: "/tv/top-rated" },
      { label: "Airing This Week", path: "/tv/airing/week" },
      { label: "K-Drama Collection", path: "/tv/k-drama" },
      { label: "Moods Matcher", path: "/tv/moods" },
    ],

    "/moods": [
      { label: "Moodies Feed", path: "/feed" },
      { label: "Mood Wheels", path: "/moods/mood-wheels" },
      { label: "Categories", path: "/moods/categories" },
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
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backdropFilter: "blur(24px)",
            background:
              "linear-gradient(135deg, rgba(0,0,0,0.88) 0%, rgba(15,15,25,0.92) 100%)",
            willChange: "opacity",
          }}
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
            style={{
              maxWidth: "min(1300px, calc(100vw - 2rem))",
              maxHeight: "min(85vh, 820px)",
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
              className="flex-1 lg:basis-[45%] flex flex-col justify-between relative"
              style={{
                padding: "clamp(2rem, 4vw, 3.5rem) clamp(2rem, 4vw, 3rem)",
                gap: "clamp(1.5rem, 3vh, 2.5rem)",
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
                  className="font-bold leading-tight mb-3"
                  style={{
                    fontSize: "clamp(2rem, 5vw, 3.5rem)",
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
                  style={{ fontSize: "clamp(0.9rem, 2vw, 1.1rem)" }}
                >
                  Discover what moves you
                </p>
              </motion.div>

              {/* Navigation Links */}

              <nav
                className="flex-1 flex flex-col justify-center relative z-10"
                style={{ gap: "clamp(0.6rem, 2vh, 1.6rem)" }}
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
                            className={`font-semibold transition-colors ${
                              isActive
                                ? "text-[#e94f37]"
                                : "text-gray-300 group-hover:text-white"
                            }`}
                            style={{
                              fontSize: "clamp(1.1rem, 3.2vw, 2rem)",
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {r.name}
                          </span>
                        </button>

                        {/* GO TO ROOT BUTTON */}
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
                      </div>
                    </motion.div>
                  );
                })}
              </nav>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-gray-500 text-sm font-light relative z-10"
              >
                © {new Date().getFullYear()} Moodies • All rights reserved
              </motion.div>
            </div>

            {/* DIVIDER */}
            <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

            {/* RIGHT SECTION - Dynamic Content */}
            <div
              className="flex-1 lg:basis-[55%] flex flex-col relative overflow-hidden"
              style={{
                padding: "clamp(2rem, 4vw, 3.5rem) clamp(2rem, 4vw, 3rem)",
                background:
                  "radial-gradient(circle at bottom right, rgba(233,79,55,0.08), transparent 60%)",
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
                className="flex-1 flex flex-col relative z-10 h-full overflow-y-auto pr-12 hide-scrollbar"
                style={{
                  scrollbarGutter: "stable both-edges",
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                {/* Section Title */}
                <div className="mb-8">
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e94f37]/10 border border-[#e94f37]/30 mb-4"
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
                    style={{ fontSize: "clamp(1.5rem, 3vw, 2.2rem)" }}
                  >
                    Quick Actions
                  </h3>
                </div>

                {/* Options Grid */}
                <div className="pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
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
                          className="group relative block p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-[#e94f37]/50 transition-all duration-300 overflow-hidden"
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

                  {/* Profile Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="pt-6 border-t border-white/[0.08]"
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar with gradient ring */}
                      <div className="relative">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#e94f37] to-orange-500 blur-md opacity-50" />
                        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e94f37] to-orange-500 p-[2px]">
                          <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden">
                            {user?.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.username || "User"}
                                className="w-full h-full object-cover"
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
                        <h4 className="text-white font-semibold text-lg">
                          {user?.username ?? user?.name ?? "Guest"}
                        </h4>
                        <p className="text-gray-400 text-sm">
                          {user?.email || "guest@example.com"}
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
            </div>

            {/* Close Button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMenuOpen(false)}
              aria-label="Close menu"
              className="absolute top-6 right-10 p-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 backdrop-blur-xl focus:outline-none transition-all group"
            >
              <IconX className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <Navbar className="fixed top-0 left-0 right-0 z-999">
      <NavBody className="hidden lg:flex">
        <NavbarLogo />

        {/* Navigation Links */}
        <div className="flex items-center gap-1">
          <Link
            href="/watchlist"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-all"
            title="Watchlist"
          >
            <Bookmark size={20} className="!w-5 !h-5" />
            <span className="text-sm font-medium">Watchlist</span>
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
            href="/#your-moods"
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
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.username || "User"}
                    className="w-full h-full object-cover"
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
                        {user?.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.username || "User"}
                            className="w-full h-full object-cover"
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
                          {user?.email || "guest@example.com"}
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
                          href="/settings"
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <IconSettings size={18} />
                          <span>Settings</span>
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
        <MobileNavHeader className="w-full px-4">
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
        <div className="w-full px-4">
          {/* Animated particles background inside menu */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-[#e94f37] rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -100, 0],
                  x: [0, Math.random() * 50 - 25, 0],
                  opacity: [0, 0.6, 0],
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Number.POSITIVE_INFINITY,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.07 } },
            }}
            className="relative flex flex-col gap-6 py-2"
          >
            <motion.h3
              variants={{
                hidden: { opacity: 0, y: -10 },
                visible: { opacity: 1, y: 0 },
              }}
              className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent"
            >
              Explore
            </motion.h3>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: -10 },
                visible: { opacity: 1, y: 0 },
              }}
              className="text-sm text-gray-400"
            >
              Quick links
            </motion.p>

            <nav
              className="flex-1 flex flex-col justify-center"
              style={{ gap: "clamp(0.25rem, 1.5vh, 1rem)" }}
            >
              {routes.map((r, idx) => (
                <motion.div
                  key={r.href}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 },
                  }}
                >
                  <Link
                    href={r.href}
                    onMouseEnter={() => setActiveRoute(r.href)}
                    onFocus={() => setActiveRoute(r.href)}
                    onClick={() => setIsMobileOpen(false)}
                    className={`relative font-semibold transition-all duration-200 ease-out leading-snug group flex items-center ${
                      activeRoute === r.href
                        ? "text-[#e94f37]"
                        : "text-gray-100 hover:text-[#e94f37]"
                    } pl-3 py-2 rounded-lg`}
                    style={{
                      fontSize: "clamp(0.95rem, 2.8vw, 1.5rem)",
                      paddingTop: "clamp(0.3rem, 0.8vh, 0.5rem)",
                      paddingBottom: "clamp(0.3rem, 0.8vh, 0.5rem)",
                    }}
                  >
                    {/* Gradient background on hover */}
                    <motion.div
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#e94f37]/10 to-transparent"
                      initial={{ opacity: 0, x: -10 }}
                      whileHover={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                    />

                    {/* Active/hover indicator line */}
                    <motion.span
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#e94f37] to-orange-500"
                      animate={{
                        width: activeRoute === r.href ? "4px" : "0px",
                        height:
                          activeRoute === r.href
                            ? "clamp(1rem, 3vh, 1.5rem)"
                            : "0",
                        opacity: activeRoute === r.href ? 1 : 0,
                      }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />

                    <span className="relative z-10">{r.name}</span>
                  </Link>
                </motion.div>
              ))}
            </nav>

            <motion.div
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1 },
              }}
              className="mt-6 pt-6 border-t border-white/[0.08]"
            >
              <div className="flex items-center gap-3">
                {/* Avatar with gradient ring */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#e94f37] to-orange-500 blur-md opacity-50" />
                  <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-[#e94f37] to-orange-500 p-[2px]">
                    <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center overflow-hidden">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username || "User"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-gray-300">
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

                <div>
                  <div className="text-sm font-semibold text-white">
                    {user?.username ?? user?.name ?? "Guest"}
                  </div>
                  <div className="text-xs text-gray-400">
                    {user?.email || "guest@example.com"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {isAuthenticated ? (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setIsMobileOpen(false);
                      logout();
                    }}
                    className="inline-flex items-center justify-center rounded-xl border border-white/20 px-4 py-2.5 text-sm text-white hover:bg-white/5 backdrop-blur-sm transition-all w-full"
                  >
                    Logout
                  </motion.button>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMobileOpen(false)}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#e94f37] to-orange-500 hover:from-[#e94f37]/90 hover:to-orange-500/90 px-4 py-2.5 text-sm text-white transition-all w-full"
                  >
                    Get Started
                  </Link>
                )}
              </div>
            </motion.div>

            <motion.div
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1 },
              }}
              className="mt-6 text-xs text-gray-500 text-center"
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
