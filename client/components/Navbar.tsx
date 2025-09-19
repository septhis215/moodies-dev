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
  IconSearch,
} from "@tabler/icons-react";
import {
  Navbar,
  NavBody,
  NavItems,
  NavbarLogo,
  NavbarButton,
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
} from "./ui/resizable-navbar";
import SearchBar from "./ui/searchbar";

const routes = [
  { name: "Home", href: "/" },
  { name: "Movies", href: "/movies" },
  { name: "Series", href: "/series" },
  { name: "Community", href: "/community" },
  { name: "Your Moods", href: "/your-moods" },
];

export function NavbarComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const createdPortalRef = useRef<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState<string>(routes[0].href);
  const [activeMobileRoute, setActiveMobileRoute] = useState<string | null>(
    null
  );

  const routeOptions: Record<string, string[]> = {
    "/": [
      "Overview",
      "Highlights",
      "Recommendations",
      "What's New",
      "Trending Now",
      "Staff Picks",
    ],
    "/movies": [
      "Now Playing",
      "Top Rated",
      "Upcoming",
      "Genres",
      "Box Office",
      "Trailers",
      "Collections",
      "Browse by Year",
    ],
    "/series": [
      "Trending",
      "Top Rated",
      "New Seasons",
      "By Network",
      "Watchlist",
      "New Episodes",
      "Top Comedies",
    ],
    "/community": [
      "Forums",
      "Events",
      "Guides",
      "User Reviews",
      "Clubs",
      "Contests",
      "Meetups",
    ],
    "/your-moods": [
      "Saved Moods",
      "Create Mood",
      "History",
      "Recommendations",
      "Shared Moods",
      "Export",
      "Reset Moods",
    ],
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
          className="fixed inset-0 z-[9999] flex items-stretch"
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
            className="relative flex flex-col md:flex-row w-full mx-auto my-4 md:my-8 rounded-2xl"
            style={{
              boxShadow: "0 30px 80px rgba(0,0,0,0.65)",
              border: "1px solid rgba(255,255,255,0.04)",
              background:
                "linear-gradient(180deg, rgba(6,6,8,0.94), rgba(8,8,10,0.9))",
              // slightly smaller overall but still fits
              maxWidth: "min(1100px, calc(100vw - 96px))",
              maxHeight: "calc(100vh - 96px)",
              overflow: "hidden",
              willChange: "transform, opacity",
            }}
          >
            {/* LEFT: routes */}
            <div
              className="flex-1 md:basis-1/2 min-w-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02),transparent)] px-6 md:px-10 py-6 md:py-10 flex flex-col justify-between gap-3 md:gap-6"
              style={{
                boxSizing: "border-box",
                background:
                  "radial-gradient(circle at top left, rgba(233,79,55,0.1), transparent)",
              }}
            >
              <div className="pb-1">
                <h2
                  className="font-semibold text-white leading-tight"
                  style={{ fontSize: "clamp(1.75rem, 6.5vh, 3rem)" }}
                >
                  Explore
                </h2>
                <p
                  className="mt-1 text-gray-300"
                  style={{ fontSize: "clamp(0.9rem, 1.6vh, 1.05rem)" }}
                >
                  Quick links to the main sections
                </p>
              </div>

              {/* nav — on hover/focus set activeRoute */}
              <nav className="flex-1 flex flex-col justify-center gap-2 md:gap-4">
                {routes.map((r) => (
                  <a
                    key={r.href}
                    href={r.href}
                    onMouseEnter={() => setActiveRoute(r.href)}
                    onFocus={() => setActiveRoute(r.href)}
                    onClick={() => setIsOpen(false)}
                    className={`relative font-medium transition-all duration-100 ease-out leading-snug group ${
                      activeRoute === r.href
                        ? "text-[#e94f37]"
                        : "text-gray-100 hover:text-[#e94f37]"
                    } pl-4`} // ⬅️ padding-left so line sits outside
                    style={{
                      fontSize: "clamp(1.125rem, 4.2vh, 1.75rem)",
                      paddingTop: "0.35rem",
                      paddingBottom: "0.35rem",
                    }}
                  >
                    {/* active/hover indicator line */}
                    <span
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-[#e94f37] transition-all duration-200 ${
                        activeRoute === r.href
                          ? "h-6 opacity-100"
                          : "h-0 opacity-0 group-hover:h-4 group-hover:opacity-100"
                      }`}
                    />
                    {r.name}
                  </a>
                ))}
              </nav>

              <div
                className="pt-1 text-sm text-gray-400"
                style={{ fontSize: "clamp(0.8rem,1.2vh,0.95rem)" }}
              >
                © {new Date().getFullYear()} Your App
              </div>
            </div>

            {/* CENTER: options panel (uses the gap). Visible on md+ only. */}
            <div
              className="hidden md:flex md:basis-1/2 flex-col items-start justify-center p-6"
              style={{
                background:
                  "radial-gradient(circle at top left, rgba(233,79,55,0.1), transparent)",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
                borderRight: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="w-full max-w-[260px]">
                <h3 className="text-md font-semibold text-[#e94f37] mb-4">
                  {routes.find((x) => x.href === activeRoute)?.name ??
                    "Options"}
                </h3>

                <div className="flex flex-col gap-3">
                  {(routeOptions[activeRoute] || []).map((opt) => (
                    <a
                      key={opt}
                      href="#"
                      className="relative px-4 py-2 rounded-lg text-gray-200
           hover:text-white transition-all duration-300
           before:absolute before:inset-0 before:rounded-lg before:border
           before:border-[#e94f37]/30 hover:before:border-[#e94f37]
           before:transition-all before:duration-300"
                    >
                      {opt}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: profile — visible on lg and above */}
            <div
              className="hidden lg:flex w-1/3 flex-none min-w-0 bg-[rgba(255,255,255,0.02)] px-6 py-8 items-center justify-center"
              style={{
                boxSizing: "border-box",
                background:
                  "radial-gradient(circle at top left, rgba(233,79,55,0.1), transparent)",
              }}
            >
              <div className="w-full max-w-xs text-center">
                <div
                  className="mx-auto rounded-full overflow-hidden"
                  style={{ height: 88, width: 88 }}
                >
                  <Image
                    src="/images/facebook.png"
                    alt="avatar"
                    width={96}
                    height={96}
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <h3
                  className="mt-3 font-medium text-white"
                  style={{ fontSize: "clamp(0.95rem,1.6vh,1.15rem)" }}
                >
                  Guest
                </h3>
                <p
                  className="mt-1"
                  style={{
                    color: "rgba(255,255,255,0.75)",
                    fontSize: "clamp(0.85rem,1.2vh,0.95rem)",
                  }}
                >
                  guest@example.com
                </p>

                <div className="mt-4">
                  <a
                    href="/auth/login"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/5 transition"
                  >
                    Login
                  </a>
                </div>
              </div>
            </div>

            {/* Close X */}
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
              className="absolute right-4 top-4 md:right-6 md:top-6 rounded-full bg-white/10 p-2 hover:bg-white/20 focus:outline-none"
              style={{ backdropFilter: "blur(6px)" }}
            >
              <IconX className="text-white" />
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
          <a
            href="/community"
            className="hidden md:inline-flex items-center gap-2 text-gray-200 hover:text-white"
          >
            <IconUsers size={24} className="!w-6 !h-6" />
            <span className="sr-only">Community</span>
          </a>

          <a
            href="/your-moods"
            className="hidden md:inline-flex items-center gap-2 text-gray-200 hover:text-white"
          >
            <IconMoodSmile size={24} className="!w-6 !h-6" />
            <span className="sr-only">Your Moods</span>
          </a>

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

            <nav className="flex flex-col gap-3 mt-4">
              {routes.map((r) => (
                <div key={r.href} className="flex flex-col">
                  <button
                    onClick={() =>
                      setActiveMobileRoute((prev) =>
                        prev === r.href ? null : r.href
                      )
                    }
                    className={`flex justify-between items-center py-3 px-2 rounded-md text-lg transition ${
                      activeMobileRoute === r.href
                        ? "text-[#e94f37] bg-[#e94f37]/10"
                        : "text-gray-100 hover:text-[#e94f37] hover:bg-[#e94f37]/10"
                    }`}
                  >
                    <span>{r.name}</span>
                    <span className="text-[#e94f37]">
                      {activeMobileRoute === r.href ? "−" : "+"}
                    </span>
                  </button>

                  {/* Sub-options (routeOptions) */}
                  {activeMobileRoute === r.href && (
                    <ul className="pl-4 mt-1 flex flex-col gap-2">
                      {(routeOptions[r.href] || []).map((opt) => (
                        <li key={opt}>
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setIsMobileOpen(false);
                            }}
                            className="block text-sm px-2 py-1 rounded-md transition
    text-gray-300 hover:text-[#e94f37] hover:bg-[#e94f37]/10"
                          >
                            {opt}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </nav>

            <div className="mt-6 border-t border-white/6 pt-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/5 overflow-hidden" />
                <div>
                  <div className="text-sm font-medium text-white">Guest</div>
                  <div className="text-xs text-gray-300">guest@example.com</div>
                </div>
              </div>

              <div className="mt-4">
                <a
                  href="/auth/login"
                  onClick={() => setIsMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
                >
                  Login
                </a>
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
