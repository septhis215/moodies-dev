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
  Infinity,
  List,
  Loader,
  MouseIcon,
  PhoneIcon,
  Repeat,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthProvider";
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

export function NavbarComponent() {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const createdPortalRef = useRef<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string>(routes[0].href);
  const [activeMobileRoute, setActiveMobileRoute] = useState<string | null>(
    null
  );
  const { user, isAuthenticated, logoutSilent } = useAuth();

  const routeOptions: Record<string, { label: string; path: string }[]> = {
    "/": [
      { label: "Trending", path: "/trending" },
      { label: "New Releases", path: "/new-releases" },
      { label: "Korean Hits", path: "/korea-hits" },
      { label: "Moods", path: "/moods" },
      { label: "Coming Soon", path: "/coming-soon" },
    ],

    "/movies": [
      { label: "Trending", path: "/movies/trending" },
      { label: "Top Rated", path: "/movies/top-rated" },
      { label: "New Releases", path: "/movies/new-releases" },
      { label: "Korean", path: "/movies/korean" },
      { label: "Upcoming", path: "/movies/upcoming" },
      { label: "Moods Matcher", path: "/movies/moods" },
    ],

    "/tv": [
      { label: "Trending", path: "/tv/trending" },
      { label: "Top Rated", path: "/tv/top-rated" },
      { label: "New Releases", path: "/tv/new-releases" },
      { label: "Korean", path: "/tv/korean" },
      { label: "Upcoming", path: "/tv/upcoming" },
      { label: "Moods Matcher", path: "/tv/moods" },
    ],

    "/moods": [
      { label: "Moodies Feed", path: "/feed" },
      { label: "Mood Wheels", path: "/moods/mood-wheels" },
      { label: "Categories", path: "/moods/categories" },
    ],
  };

  const logout = () => {
    setIsOpen(false);
    logoutSilent(); // clears token & user silently
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

  // close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsMobileOpen(false);
        setIsMobileSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // lock body scroll while desktop menu is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [isOpen]);

  // The full dropdown panel (rendered into portalRoot)
  const menuNode = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="menu-dropdown"
          id="site-menu"
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 32,
            mass: 0.8,
          }}
          initial={{ y: "-12%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-12%", opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            backdropFilter: "blur(14px)",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.65) 100%)",
            willChange: "transform, opacity",
          }}
        >
          {/* inner card: 3-column layout (left nav / center options / right profile) */}
          <motion.div
            initial={{ scale: 0.995, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.995, opacity: 0 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
            className="relative flex flex-col md:flex-row w-full mx-auto rounded-2xl"
            style={{
              boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.04)",
              background:
                "linear-gradient(180deg, rgba(6,6,8,0.94), rgba(8,8,10,0.9))",
              maxWidth: "min(1100px, calc(100vw - 2rem))",
              minWidth: "300px", // Add this
              maxHeight: "min(85vh, calc(100vh - 2rem))",
              margin: "clamp(0.5rem, 2vh, 2rem)",
              overflow: "hidden",
              willChange: "transform, opacity",
            }}
          >
            {/* LEFT: routes */}
            <div
              className="flex-1 md:basis-1/2 min-w-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02),transparent)] flex flex-col justify-between"
              style={{
                padding: "clamp(1rem, 3vw, 2.5rem) clamp(1.25rem, 4vw, 2.5rem)",
                gap: "clamp(0.75rem, 2vh, 1.5rem)",
                boxSizing: "border-box",
                background:
                  "radial-gradient(circle at top left, rgba(233,79,55,0.1), transparent)",
              }}
            >
              <div className="pb-1">
                <h2
                  className="font-semibold text-white leading-tight"
                  style={{ fontSize: "clamp(1.25rem, 4vw, 2.5rem)" }}
                >
                  Explore
                </h2>
                <p
                  className="mt-1 text-gray-300"
                  style={{ fontSize: "clamp(0.75rem, 1.8vw, 1rem)" }}
                >
                  Quick links to the main sections
                </p>
              </div>

              {/* nav — on hover/focus set activeRoute */}
              <nav
                className="flex-1 flex flex-col justify-center"
                style={{ gap: "clamp(0.25rem, 1.5vh, 1rem)" }}
              >
                {routes.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    onMouseEnter={() => setActiveRoute(r.href)}
                    onFocus={() => setActiveRoute(r.href)}
                    onClick={() => setIsOpen(false)}
                    className={`relative font-medium transition-all duration-100 ease-out leading-snug group ${
                      activeRoute === r.href
                        ? "text-[#e94f37]"
                        : "text-gray-100 hover:text-[#e94f37]"
                    } pl-3`}
                    style={{
                      fontSize: "clamp(0.95rem, 2.8vw, 1.5rem)",
                      paddingTop: "clamp(0.2rem, 0.8vh, 0.35rem)",
                      paddingBottom: "clamp(0.2rem, 0.8vh, 0.35rem)",
                    }}
                  >
                    {/* active/hover indicator line */}
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-[#e94f37] transition-all duration-200`}
                      style={{
                        width: "clamp(2px, 0.3vw, 3px)",
                        height:
                          activeRoute === r.href
                            ? "clamp(1rem, 3vh, 1.5rem)"
                            : "0",
                        opacity: activeRoute === r.href ? 1 : 0,
                      }}
                    />
                    {r.name}
                  </Link>
                ))}
              </nav>

              <div
                className="pt-1 text-gray-400"
                style={{ fontSize: "clamp(0.7rem, 1.5vw, 0.875rem)" }}
              >
                © {new Date().getFullYear()} Your App
              </div>
            </div>

            {/* CENTER: options panel. Visible on md+ only. */}
            <div
              className="hidden md:flex md:basis-1/2 flex-col items-start justify-center"
              style={{
                padding: "clamp(1rem, 2.5vw, 1.5rem)",
                background:
                  "radial-gradient(circle at top left, rgba(233,79,55,0.1), transparent)",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
                borderRight: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                className="w-full"
                style={{ maxWidth: "clamp(200px, 25vw, 280px)" }}
              >
                <h3
                  className="font-semibold text-[#e94f37]"
                  style={{
                    fontSize: "clamp(0.8rem, 1.8vw, 1rem)",
                    marginBottom: "clamp(0.75rem, 2vh, 1rem)",
                  }}
                >
                  {routes.find((x) => x.href === activeRoute)?.name ??
                    "Options"}
                </h3>

                <div
                  className="flex flex-col"
                  style={{ gap: "clamp(0.5rem, 1.5vh, 0.75rem)" }}
                >
                  {(routeOptions[activeRoute] || []).map((opt) => (
                    <Link
                      key={opt.path}
                      href={opt.path}
                      onClick={() => setIsOpen(false)}
                      className="relative rounded-lg text-gray-200
        hover:text-white transition-all duration-300
        before:absolute before:inset-0 before:rounded-lg before:border
        before:border-[#e94f37]/30 hover:before:border-[#e94f37]
        before:transition-all before:duration-300"
                      style={{
                        padding:
                          "clamp(0.4rem, 1.2vh, 0.5rem) clamp(0.75rem, 2vw, 1rem)",
                        fontSize: "clamp(0.8rem, 1.6vw, 0.95rem)",
                      }}
                    >
                      {opt.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: profile — visible on lg and above */}
            <div
              className="hidden lg:flex w-1/3 flex-none min-w-0 bg-[rgba(255,255,255,0.02)] items-center justify-center"
              style={{
                padding: "clamp(1rem, 2.5vw, 2rem) clamp(1rem, 2vw, 1.5rem)",
                boxSizing: "border-box",
                background:
                  "radial-gradient(circle at top left, rgba(233,79,55,0.1), transparent)",
              }}
            >
              <div className="w-full max-w-xs text-center">
                <div
                  className="mx-auto rounded-full overflow-hidden"
                  style={{
                    height: "clamp(64px, 10vw, 88px)",
                    width: "clamp(64px, 10vw, 88px)",
                  }}
                >
                  {/* <Image
                    src="/images/facebook.png"
                    alt="avatar"
                    width={96}
                    height={96}
                    style={{ objectFit: "cover" }}
                  /> */}
                </div>
                <h3
                  className="mt-3 font-medium text-white"
                  style={{ fontSize: "clamp(0.85rem, 1.8vw, 1.1rem)" }}
                >
                  {user?.username ?? user?.name ?? "Guest"}
                </h3>
                <p
                  className="mt-1"
                  style={{
                    color: "rgba(255,255,255,0.75)",
                    fontSize: "clamp(0.75rem, 1.5vw, 0.9rem)",
                  }}
                >
                  {user?.email || "guest@example.com"}
                </p>

                <div className="mt-4">
                  {isAuthenticated ? (
                    <button
                      onClick={() => {
                        setIsMobileOpen(false);
                        logout();
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/5"
                      style={{
                        padding:
                          "clamp(0.4rem, 1vh, 0.5rem) clamp(0.75rem, 2vw, 1rem)",
                        fontSize: "clamp(0.75rem, 1.5vw, 0.875rem)",
                      }}
                    >
                      Logout
                    </button>
                  ) : (
                    <Link
                      href="/auth/login"
                      onClick={() => setIsMobileOpen(false)}
                      className="inline-flex items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/5"
                      style={{
                        padding:
                          "clamp(0.4rem, 1vh, 0.5rem) clamp(0.75rem, 2vw, 1rem)",
                        fontSize: "clamp(0.75rem, 1.5vw, 0.875rem)",
                      }}
                    >
                      Login
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Close X */}
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
              className="absolute rounded-full bg-white/10 hover:bg-white/20 focus:outline-none"
              style={{
                right: "clamp(0.75rem, 2vw, 1.5rem)",
                top: "clamp(0.75rem, 2vw, 1.5rem)",
                padding: "clamp(0.4rem, 1vw, 0.5rem)",
                backdropFilter: "blur(6px)",
              }}
            >
              <IconX
                className="text-white"
                style={{
                  width: "clamp(18px, 3vw, 24px)",
                  height: "clamp(18px, 3vw, 24px)",
                }}
              />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <Navbar className="fixed top-0 left-0 right-0 z-50">
      <NavBody className="hidden lg:flex">
        <NavbarLogo />

        {/* Placeholder - inline nav left empty since menu contains links */}
        <div />

        <div className="flex items-center gap-3">
          <Link
            href="/community"
            className="hidden md:inline-flex items-center gap-2 text-gray-200 hover:text-white"
          >
            <IconUsers size={24} className="!w-6 !h-6" />
            <span className="sr-only">Community</span>
          </Link>
          <Link
            href="/feed"
            className="hidden md:inline-flex items-center gap-2 text-gray-200 hover:text-white"
          >
            <MouseIcon size={24} className="!w-6 !h-6" />
            <span className="sr-only">Your Feeds</span>
          </Link>

          <Link
            href="/#your-moods"
            className="hidden md:inline-flex items-center gap-2 text-gray-200 hover:text-white"
          >
            <IconMoodSmile size={24} className="!w-6 !h-6" />
            <span className="sr-only">Your Moods</span>
          </Link>

          <div className="hidden sm:inline-flex items-center">
            <SearchBar
              placeholder="Search movies, series..."
              onSearch={(q) => {
                console.log("search:", q);
              }}
            />
          </div>

          <button
            aria-expanded={isOpen}
            aria-controls="site-menu"
            onClick={() => setIsOpen((s) => !s)}
            className="ml-2 rounded-md border border-[#e94f37]/40 bg-[#e94f37]/10 px-3 py-2 text-white hover:bg-[#e94f37]/20 focus:outline-none focus:ring-2 focus:ring-[#e94f37]"
            title="Open menu"
          >
            <IconMenu2 className="text-[#e94f37]" />
          </button>
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
          <div className="flex flex-col gap-6 py-2">
            <h3 className="text-2xl font-semibold text-white">Explore</h3>
            <p className="text-sm text-gray-300">Quick links</p>

            <nav
              className="flex-1 flex flex-col justify-center"
              style={{ gap: "clamp(0.25rem, 1.5vh, 1rem)" }}
            >
              {routes.map((r) => (
                <Link
                  key={r.href}
                  href={r.href} // Directly linking to the page URL
                  onMouseEnter={() => setActiveRoute(r.href)}
                  onFocus={() => setActiveRoute(r.href)}
                  onClick={() => setIsOpen(false)}
                  className={`relative font-medium transition-all duration-100 ease-out leading-snug group ${
                    activeRoute === r.href
                      ? "text-[#e94f37]"
                      : "text-gray-100 hover:text-[#e94f37]"
                  } pl-3`}
                  style={{
                    fontSize: "clamp(0.95rem, 2.8vw, 1.5rem)",
                    paddingTop: "clamp(0.2rem, 0.8vh, 0.35rem)",
                    paddingBottom: "clamp(0.2rem, 0.8vh, 0.35rem)",
                  }}
                >
                  {/* active/hover indicator line */}
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-[#e94f37] transition-all duration-200`}
                    style={{
                      width: "clamp(2px, 0.3vw, 3px)",
                      height:
                        activeRoute === r.href
                          ? "clamp(1rem, 3vh, 1.5rem)"
                          : "0",
                      opacity: activeRoute === r.href ? 1 : 0,
                    }}
                  />
                  {r.name}
                </Link>
              ))}
            </nav>

            <div className="mt-6 border-t border-white/6 pt-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/5 overflow-hidden" />
                <div>
                  <div className="text-sm font-medium text-white">
                    {user?.username ?? user?.name ?? "Guest"}
                  </div>
                  <div className="text-xs text-gray-300">
                    {user?.email || "guest@example.com"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {isAuthenticated ? (
                  <button
                    onClick={() => {
                      setIsMobileOpen(false);
                      logout();
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
                  >
                    Logout
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMobileOpen(false)}
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-6 text-xs text-gray-400">
              © {new Date().getFullYear()} Your App
            </div>
          </div>
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
