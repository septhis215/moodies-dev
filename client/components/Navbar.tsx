// File: Navbar.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
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

  // Create (or find) a portal root on mount. Clean up if we created it.
  useEffect(() => {
    // avoid running on server
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

  // lock body scroll while menu is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
  }, [isOpen]);

  // The actual dropdown markup (keeps your original design)
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
            // slightly darker backdrop to make the panel pop more
            backdropFilter: "blur(14px)",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.65) 100%)",
            willChange: "transform, opacity",
          }}
        >
          {/* inner panel: responsive scaling but capped maximums */}
          {/* inner panel: slightly smaller overall, still responsive and fits all screens */}
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
              // slightly smaller than before: caps at 1100px and also keeps a 48px margin each side on narrow viewports
              maxWidth: "min(1100px, calc(100vw - 96px))",
              // give more breathing room vertically while still fitting the viewport
              maxHeight: "calc(100vh - 96px)",
              overflow: "hidden",
              willChange: "transform, opacity",
            }}
          >
            {/* LEFT: routes — occupies full width on small screens (since right pane hidden) */}
            <div
              className="flex-1 md:basis-2/3 min-w-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.02),transparent)] px-5 md:px-8 py-5 md:py-8 flex flex-col justify-between gap-3 md:gap-6"
              style={{ boxSizing: "border-box" }}
            >
              {/* Header */}
              <div className="pb-1">
                <h2
                  className="font-semibold text-white leading-tight"
                  style={{
                    // MIN 1.75rem, ideal 6.5vh, MAX 3rem
                    fontSize: "clamp(1.75rem, 6.5vh, 3rem)",
                  }}
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

              {/* Center nav — capped so it doesn't grow infinitely on large screens */}
              <nav className="flex-1 flex flex-col justify-center gap-2 md:gap-4">
                {routes.map((r) => (
                  <a
                    key={r.href}
                    href={r.href}
                    onClick={() => setIsOpen(false)}
                    className="font-medium text-gray-100 hover:text-white transition-colors leading-snug"
                    style={{
                      // MIN ~18px, ideal scales, MAX ~28px
                      fontSize: "clamp(1.125rem, 4.2vh, 2rem)",
                      paddingTop: "0.35rem",
                      paddingBottom: "0.35rem",
                    }}
                  >
                    {r.name}
                  </a>
                ))}
              </nav>

              {/* Footer */}
              <div
                className="pt-1 text-sm text-gray-400"
                style={{ fontSize: "clamp(0.8rem,1.2vh,0.95rem)" }}
              >
                © {new Date().getFullYear()} Your App
              </div>
            </div>

            {/* RIGHT: profile — hidden on small/medium screens so nav never needs to shrink/scroll */}
            <div
              className="hidden lg:flex w-1/3 flex-none min-w-0 bg-[rgba(255,255,255,0.02)] px-6 py-8 items-center justify-center"
              style={{ boxSizing: "border-box" }}
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

        {/* Placeholder - we keep inline nav empty since menu contains links */}
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

          {/* Add search bar here */}
          <div className="hidden sm:inline-flex items-center">
            <SearchBar
              placeholder="Search movies, series..."
              onSearch={(q) => {
                // example: navigate or call your search handler
                console.log("search:", q);
              }}
            />
          </div>

          <button
            aria-expanded={isOpen}
            aria-controls="site-menu"
            onClick={() => setIsOpen((s) => !s)}
            className="ml-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
            title="Open menu"
          >
            <IconMenu2 />
          </button>
        </div>
      </NavBody>
      {/* MOBILE NAV — show on small screens */}
      <MobileNav visible>
        <MobileNavHeader className="w-full px-4">
          {/* Left: logo (smaller) */}
          <div className="flex items-center">
            <NavbarLogo className="mr-0" />
          </div>

          {/* Right: small icons — community, moods, search icon, menu toggle */}
          <div className="flex items-center gap-2">
            {/* Community & moods kept as icons (tap to open page) */}
            <a
              href="/community"
              className="inline-flex items-center p-2 text-gray-200 hover:text-white"
            >
              <IconUsers size={20} />
            </a>

            <a
              href="/your-moods"
              className="inline-flex items-center p-2 text-gray-200 hover:text-white"
            >
              <IconMoodSmile size={20} />
            </a>

            {/* Mobile search icon: toggles a simple full-screen search overlay */}
            <div className="inline-flex">
              <SearchBar
                placeholder="Search movies, series..."
                onSearch={(q) => console.log("search", q)}
              />
            </div>

            {/* Mobile menu toggle */}
            <MobileNavToggle
              isOpen={isMobileOpen}
              onClick={() => setIsMobileOpen((s) => !s)}
            />
          </div>
        </MobileNavHeader>
      </MobileNav>
      {/* Mobile menu overlay — uses same routes/profile content but stacked for mobile */}
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
                <a
                  key={r.href}
                  href={r.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="py-3 px-2 rounded-md text-lg text-gray-100 hover:text-white hover:bg-white/3 transition"
                >
                  {r.name}
                </a>
              ))}
            </nav>

            <div className="mt-6 border-t border-white/6 pt-4">
              {/* Profile card simplified for mobile */}
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
      {/* Portal render: menuNode is mounted into portalRoot (body-level) to avoid clipping */}
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
                /* handle search */ setIsMobileSearchOpen(false);
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
