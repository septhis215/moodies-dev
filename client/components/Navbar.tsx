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
  NavItems,
  NavbarLogo,
  NavbarButton,
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
      if (e.key === "Escape") setIsOpen(false);
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
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
          className="fixed inset-0 z-[9999] flex items-stretch"
          style={{
            backdropFilter: "blur(12px)",
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.6) 100%)",
          }}
        >
          <div className="relative flex w-full max-w-7xl mx-auto my-12 h-[calc(100%-96px)] rounded-2xl overflow-hidden shadow-2xl">
            {/* Left 2/3: routes */}
            <div className="w-2/3 bg-[linear-gradient(90deg,rgba(255,255,255,0.02),transparent)] px-10 py-12 flex flex-col gap-8">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-4xl md:text-5xl font-semibold text-white">
                    Explore
                  </h2>
                  <p className="mt-2 text-gray-300">
                    Quick links to the main sections
                  </p>
                </div>
              </div>

              <nav className="mt-6 flex flex-col gap-6">
                {routes.map((r) => (
                  <a
                    key={r.href}
                    href={r.href}
                    onClick={() => setIsOpen(false)}
                    className="text-2xl md:text-3xl font-medium text-gray-100 hover:text-white transition-colors"
                  >
                    {r.name}
                  </a>
                ))}
              </nav>

              <div className="mt-auto text-sm text-gray-400">
                © {new Date().getFullYear()} Your App
              </div>
            </div>

            {/* Right 1/3: user profile card centered */}
            <div className="w-1/3 bg-[rgba(255,255,255,0.02)] px-8 py-12 flex items-center justify-center">
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-full max-w-xs text-center">
                  <div className="mx-auto h-24 w-24 rounded-full overflow-hidden bg-white/5 ring-1 ring-white/10">
                    {/* If next/image causes trouble, swap to <img /> temporarily */}
                    <Image
                      src="/images/facebook.png"
                      alt="avatar"
                      width={96}
                      height={96}
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-white">Guest</h3>
                  <p className="mt-1 text-sm text-gray-300">
                    guest@example.com
                  </p>

                  <div className="mt-6">
                    <a
                      href="/auth/login"
                      onClick={() => setIsOpen(false)}
                      className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-2 text-white hover:bg-white/5 transition"
                    >
                      Login
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Close X - top right corner (inside card) */}
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close menu"
              className="absolute right-6 top-6 rounded-full bg-white/6 p-2 hover:bg-white/10 focus:outline-none"
            >
              <IconX />
            </button>
          </div>
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

      {/* Portal render: menuNode is mounted into portalRoot (body-level) to avoid clipping */}
      {portalRoot ? createPortal(menuNode, portalRoot) : null}
    </Navbar>
  );
}

export default NavbarComponent;
