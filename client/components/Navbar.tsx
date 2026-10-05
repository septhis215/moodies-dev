"use client";

import React, { useEffect, useRef, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconArrowUpRight,
  IconChevronDown,
  IconLogin,
  IconLogout,
  IconMenu2,
  IconSparkles,
  IconUser,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import { Bookmark, Heart } from "lucide-react";
import { useAuth } from "@/app/context/AuthProvider";
import { appToast } from "@/lib/toast";
import DropdownPortal from "./ui/dropdownPortal";
import SearchBar from "./ui/searchbar";
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  Navbar,
  NavbarLogo,
} from "./ui/resizable-navbar";

const routes = [
  { name: "Home", href: "/" },
  { name: "Movies", href: "/movies" },
  { name: "TV shows", href: "/tv" },
  ...(process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? []
    : [{ name: "Celebrities", href: "/celeb" }]),
  { name: "Your Moods", href: "/moods/explore" },
  { name: "My Collection", href: "/collection" },
];

const routeOptions: Record<string, { label: string; path: string }[]> = {
  "/": [
    { label: "Movies homepage", path: "/movies" },
    { label: "TV shows homepage", path: "/tv" },
    { label: "Trending", path: "/trending" },
    { label: "New Releases", path: "/fresh-off-the-screen" },
    { label: "Korean Hits", path: "/korean-hits" },
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
  "/celeb": [
    { label: "Trending", path: "/celeb?category=trending&page=1" },
    { label: "Actors", path: "/celeb?category=actors&page=1" },
    { label: "Actresses", path: "/celeb?category=actresses&page=1" },
    { label: "Directors", path: "/celeb?category=directors&page=1" },
    { label: "Movie Stars", path: "/celeb?category=movie-stars&page=1" },
    { label: "TV Stars", path: "/celeb?category=tv-stars&page=1" },
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

const MOODIES_LOGO = "/images/moodies-transparent.png";
const MOODIES_SIZE = { width: 30, height: 30 };
const sectionIntroductions: Record<
  string,
  { title: string; description: string; mascot: string }
> = {
  "/": {
    title: "Moodies home",
    description:
      "A little of everything: movies, TV shows, and mood-led picks.",
    mascot: "happy",
  },
  "/movies": {
    title: "Movies homepage",
    description:
      "Find your next film: fresh releases, favourites, and picks for your mood.",
    mascot: "thrilling",
  },
  "/tv": {
    title: "TV shows homepage",
    description:
      "Find a series to settle into, from new arrivals to returning favourites.",
    mascot: "chill",
  },
  "/moods/explore": {
    title: "Explore your moods",
    description: "Let how you feel guide your next movie or TV show.",
    mascot: "mind-bending",
  },
  "/collection": {
    title: "My collection",
    description: "Keep your discoveries together: saved titles and favourites.",
    mascot: "nostalgic",
  },
  "/celeb": {
    title: "Explore people",
    description: "Discover the people behind your favourite stories.",
    mascot: "inspirational",
  },
  "/feed": {
    title: "Moodies Feed",
    description: "See what the Moodies community is sharing.",
    mascot: "funny",
  },
};
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]";

export function NavbarComponent({
  sticky = false,
  transparent = false,
}: {
  sticky?: boolean;
  transparent?: boolean;
}) {
  const pathname = usePathname();
  const currentRoute =
    routes.find((route) =>
      route.href === "/"
        ? pathname === "/"
        : pathname === route.href || pathname.startsWith(`${route.href}/`),
    )?.href ?? (pathname === "/moods" ? "/moods/explore" : "/");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState(currentRoute);
  const [mobileExpandedRoute, setMobileExpandedRoute] = useState<string | null>(
    null,
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const createdPortalRef = useRef(false);
  const dropdownTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownContentRef = useRef<HTMLDivElement | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const { user, isAuthenticated, logout: doLogout } = useAuth();

  const profileHref = isAuthenticated ? "/profile" : "/auth/login";
  const displayName = user?.username ?? user?.name ?? "Guest";
  const initial = (user?.username?.[0] || user?.name?.[0] || "M").toUpperCase();
  const activeIntroduction = sectionIntroductions[activeRoute];
  const openExploreMenu = () => {
    setActiveRoute(currentRoute);
    setIsMenuOpen((open) => !open);
  };

  const openProfile = () => {
    if (!dropdownTriggerRef.current) return;
    const rect = dropdownTriggerRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 10,
      left: Math.max(12, rect.right - 256),
    });
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = null;
    setIsProfileOpen(true);
  };

  const closeProfile = (delay = 120) => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(() => {
      setIsProfileOpen(false);
      hoverTimeoutRef.current = null;
    }, delay);
  };

  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setIsProfileOpen(false);

    try {
      await doLogout();
      appToast.info("You've been logged out successfully", {
        title: "See you next time",
        duration: 3000,
        posterUrl: MOODIES_LOGO,
        imageSize: MOODIES_SIZE,
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    let element = document.getElementById("menu-portal");
    if (!element) {
      element = document.createElement("div");
      element.id = "menu-portal";
      document.body.appendChild(element);
      createdPortalRef.current = true;
    }
    setPortalRoot(element);

    return () => {
      if (createdPortalRef.current && element?.parentNode) {
        element.parentNode.removeChild(element);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsMobileOpen(false);
        setIsProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isMenuOpen || isMobileOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen, isMobileOpen]);

  useEffect(() => {
    if (!isMenuOpen && !isMobileOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(
      isMenuOpen
        ? "#site-menu"
        : '[role="dialog"][aria-label="Mobile navigation"]',
    );
    if (!dialog) return;
    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isMenuOpen, isMobileOpen]);

  useEffect(() => {
    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownTriggerRef.current?.contains(target) ||
        dropdownContentRef.current?.contains(target)
      ) {
        return;
      }
      setIsProfileOpen(false);
    };
    document.addEventListener("mousedown", onDocumentPointerDown);
    return () =>
      document.removeEventListener("mousedown", onDocumentPointerDown);
  }, []);

  useEffect(() => {
    // The navbar scrolls with the page, so the fixed-positioned profile
    // dropdown would detach from its trigger — close it as soon as scrolling
    // starts.
    const onWindowScroll = () => {
      if (hoverTimeoutRef.current) {
        window.clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setIsProfileOpen(false);
    };
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    return () => window.removeEventListener("scroll", onWindowScroll);
  }, []);

  const avatar = (size: "small" | "large" = "small") => {
    const dimensions = size === "large" ? "h-12 w-12" : "h-9 w-9";
    return (
      <span
        className={`grid ${dimensions} shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.055] text-sm font-semibold text-white/80`}
      >
        {isAuthenticated && user?.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={size === "large" ? 48 : 36}
            height={size === "large" ? 48 : 36}
            unoptimized
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : isAuthenticated ? (
          initial
        ) : (
          <IconUser className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
    );
  };

  const desktopMenu = (
    <AnimatePresence>
      {isMenuOpen && (
        <motion.div
          id="site-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Explore Moodies"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-5"
          onClick={() => setIsMenuOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative grid h-[min(640px,88svh)] min-h-0 w-full max-w-5xl grid-cols-[minmax(230px,0.78fr)_minmax(0,1.45fr)] overflow-hidden rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-0)] text-[var(--ink)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <aside className="flex min-h-0 flex-col border-r border-white/[0.08] bg-white/[0.025] p-5 xl:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#ef775f]">
                    <IconSparkles className="h-4 w-4" aria-hidden="true" />
                    Moodies guide
                  </div>
                  <h2 className="text-2xl font-bold">Explore</h2>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    Find your next watch by story or mood.
                  </p>
                </div>
                <div
                  className="relative hidden h-16 w-16 shrink-0 sm:block"
                  aria-hidden="true"
                >
                  <div className="absolute inset-2 rounded-full bg-[#e94f37]/10 blur-xl" />
                  <Image
                    src={MOODIES_LOGO}
                    alt=""
                    fill
                    sizes="64px"
                    className="relative object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.35)]"
                  />
                </div>
              </div>

              <nav
                aria-label="Explore sections"
                className="min-h-0 space-y-1.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgba(255,255,255,0.16)_transparent] [scrollbar-width:thin]"
              >
                {routes.map((route, index) => {
                  const isActive = activeRoute === route.href;

                  return (
                    <motion.div
                      key={route.href}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + index * 0.035 }}
                      className={`group flex items-center rounded-xl border transition-colors ${
                        isActive
                          ? "border-[#e94f37]/25 bg-[#e94f37]/10"
                          : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.045]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveRoute(route.href)}
                        aria-pressed={isActive}
                        className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-1 text-left ${focusRing}`}
                      >
                        <NavigationMascot
                          href={route.href}
                          className="h-12 w-12"
                        />
                        <span
                          className={`truncate text-sm font-medium ${
                            isActive ? "text-white" : "text-white/68"
                          }`}
                        >
                          {route.name}
                        </span>
                      </button>
                      <IconChevronDown
                        className="mr-3 h-4 w-4 -rotate-90 text-[var(--ink-muted)]"
                        aria-hidden="true"
                      />
                    </motion.div>
                  );
                })}
              </nav>

              <p className="mt-auto pt-5 text-xs text-white/28">
                © {new Date().getFullYear()} Moodies
              </p>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden p-5 xl:p-6">
              <div className="mb-4 flex shrink-0 items-center justify-between gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#ef775f]">
                    {routes.find((route) => route.href === activeRoute)?.name}
                  </p>
                  <h3 className="text-xl font-bold">
                    Explore{" "}
                    {activeRoute === "/tv"
                      ? "TV shows"
                      : routes
                          .find((route) => route.href === activeRoute)
                          ?.name.toLowerCase()}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Close explore menu"
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--ink-muted)] hover:bg-white/5 ${focusRing}`}
                >
                  <IconX className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <motion.div
                key={activeRoute}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                aria-label={`${routes.find((route) => route.href === activeRoute)?.name} destinations`}
                tabIndex={0}
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.07] bg-black/10 p-2 pr-1.5 [scrollbar-color:rgba(233,79,55,0.38)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] ${focusRing}`}
              >
                <Link
                  href={activeRoute}
                  onClick={() => setIsMenuOpen(false)}
                  className={`mb-4 flex min-h-28 items-center gap-4 rounded-xl border border-[var(--brand-coral)]/35 bg-[var(--surface-2)] p-4 transition-colors hover:border-[var(--brand-coral-strong)] ${focusRing}`}
                >
                  {activeIntroduction.mascot && (
                    <Image
                      src={`/images/moods/${activeIntroduction.mascot}.png`}
                      alt={`${activeIntroduction.mascot} mood mascot`}
                      width={80}
                      height={80}
                      unoptimized
                      className="h-20 w-20 shrink-0 object-contain"
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-[var(--ink)]">
                      {activeIntroduction.title}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-[var(--ink-muted)]">
                      {activeIntroduction.description}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-[var(--brand-coral-strong)]">
                      Go to {activeIntroduction.title.toLowerCase()}
                    </span>
                  </span>
                  <IconArrowUpRight
                    className="h-5 w-5 shrink-0 text-[var(--brand-coral-strong)]"
                    aria-hidden="true"
                  />
                </Link>
                <p className="mb-2 px-2 text-xs font-semibold text-[var(--ink-muted)]">
                  Browse collections
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(routeOptions[activeRoute] || []).map((option, index) => (
                    <motion.div
                      key={option.path}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.025 }}
                    >
                      <Link
                        href={option.path}
                        onClick={() => setIsMenuOpen(false)}
                        className={`group flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--surface-2)] ${focusRing}`}
                      >
                        <div className="min-w-0">
                          <span className="block text-sm font-medium text-[var(--ink)] transition-colors group-hover:text-[var(--brand-coral-strong)]">
                            {option.label}
                          </span>
                        </div>
                        <IconArrowUpRight
                          className="h-4 w-4 shrink-0 text-white/25 transition group-hover:text-[#f2836d]"
                          aria-hidden="true"
                        />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <div className="mt-4 flex shrink-0 items-center gap-3 border-t border-white/[0.08] pt-4">
                <Link
                  href={profileHref}
                  onClick={() => setIsMenuOpen(false)}
                  aria-label={
                    isAuthenticated
                      ? "View your Moodies profile"
                      : "Sign in to Moodies"
                  }
                  className={`rounded-xl transition hover:border-[#e94f37]/35 ${focusRing}`}
                >
                  {avatar("large")}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {isAuthenticated ? displayName : "Welcome to Moodies"}
                  </p>
                  <p className="truncate text-xs text-white/42">
                    {user?.email || "Sign in to save your discoveries"}
                  </p>
                </div>
                {isAuthenticated ? (
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={() => {
                      setIsMenuOpen(false);
                      void logout();
                    }}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-sm font-medium text-white/65 transition hover:border-[#e94f37]/25 hover:bg-[#e94f37]/[0.07] hover:text-white disabled:cursor-wait disabled:opacity-55 ${focusRing}`}
                  >
                    <IconLogout
                      className="h-[18px] w-[18px]"
                      aria-hidden="true"
                    />
                    {isLoggingOut ? "Signing out…" : "Sign out"}
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMenuOpen(false)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e94f37]/30 bg-[#e94f37]/12 px-4 text-sm font-semibold text-[#ffb09f] transition hover:bg-[#e94f37]/18 hover:text-white ${focusRing}`}
                  >
                    <IconLogin
                      className="h-[18px] w-[18px]"
                      aria-hidden="true"
                    />
                    Sign in
                  </Link>
                )}
              </div>
            </section>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <Navbar sticky={sticky} transparent={transparent}>
      <NavBody className="hidden lg:flex">
        <NavbarLogo />

        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-1"
        >
          {[
            { label: "Movies", href: "/movies" },
            { label: "TV shows", href: "/tv" },
            ...(process.env.NEXT_PUBLIC_APP_ENV === "staging"
              ? []
              : [{ label: "Celebs", href: "/celeb" }]),
            { label: "Feed", href: "/feed" },
            { label: "Moods", href: "/moods/explore" },
          ].map((item) => {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold transition-colors hover:bg-white/[0.055] hover:text-[var(--ink)] ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-[var(--surface-2)] text-[var(--brand-coral-strong)]" : "text-[var(--ink-muted)]"} ${focusRing}`}
              >
                <NavigationMascot href={item.href} className="h-8 w-8" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <SearchBar
            placeholder="Search movies, series..."
            onSearch={() => undefined}
          />
          <button
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="site-menu"
            aria-label={isMenuOpen ? "Close explore menu" : "Open explore menu"}
            onClick={openExploreMenu}
            className={`grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-white/70 transition hover:border-[#e94f37]/25 hover:bg-white/[0.075] hover:text-white ${focusRing}`}
          >
            <IconMenu2 className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="mx-1 h-7 w-px bg-white/10" />

          <div
            className="relative flex items-center"
            onMouseEnter={openProfile}
            onMouseLeave={() => closeProfile()}
          >
            <Link
              href={profileHref}
              aria-label={
                isAuthenticated ? "View your profile" : "Sign in to Moodies"
              }
              className={`rounded-xl transition hover:ring-1 hover:ring-[#e94f37]/35 ${focusRing}`}
            >
              {avatar()}
            </Link>
            <button
              ref={dropdownTriggerRef}
              type="button"
              onClick={() =>
                isProfileOpen ? setIsProfileOpen(false) : openProfile()
              }
              aria-haspopup="menu"
              aria-expanded={isProfileOpen}
              aria-label="Open account menu"
              className={`ml-1 flex min-h-10 items-center gap-2 rounded-xl px-2 text-left transition hover:bg-white/[0.05] ${focusRing}`}
            >
              <span className="hidden xl:block">
                <span className="block max-w-28 truncate text-sm font-semibold text-white">
                  {displayName}
                </span>
                <span className="block text-xs text-white/40">
                  {isAuthenticated ? "View account" : "Sign in"}
                </span>
              </span>
              <IconChevronDown
                className={`hidden h-4 w-4 text-white/40 transition-transform xl:block ${
                  isProfileOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            <DropdownPortal>
              {isProfileOpen && (
                <div
                  ref={dropdownContentRef}
                  role="menu"
                  onMouseEnter={openProfile}
                  onMouseLeave={() => closeProfile()}
                  className="fixed z-[999999] w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d10]/95 p-2 text-white shadow-[0_18px_55px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                  style={{
                    top: dropdownPosition.top,
                    left: dropdownPosition.left,
                  }}
                >
                  <Link
                    href={profileHref}
                    onClick={() => setIsProfileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:bg-white/[0.055] ${focusRing}`}
                  >
                    {avatar()}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {displayName}
                      </span>
                      <span className="block truncate text-xs text-white/42">
                        {user?.email || "Sign in for your Moodies profile"}
                      </span>
                    </span>
                  </Link>

                  <div className="mt-1 space-y-0.5">
                    {isAuthenticated ? (
                      <>
                        <ProfileMenuLink
                          href="/profile"
                          icon={IconUser}
                          onClick={() => setIsProfileOpen(false)}
                        >
                          My profile
                        </ProfileMenuLink>
                        <ProfileMenuLink
                          href="/watchlist"
                          icon={Bookmark}
                          onClick={() => setIsProfileOpen(false)}
                        >
                          My list
                        </ProfileMenuLink>
                        <ProfileMenuLink
                          href="/liked"
                          icon={Heart}
                          onClick={() => setIsProfileOpen(false)}
                        >
                          My likes
                        </ProfileMenuLink>
                        <div className="my-1.5 h-px bg-white/[0.08]" />
                        <button
                          type="button"
                          role="menuitem"
                          disabled={isLoggingOut}
                          onClick={() => void logout()}
                          className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/62 transition hover:bg-[#e94f37]/[0.07] hover:text-white disabled:cursor-wait disabled:opacity-55 ${focusRing}`}
                        >
                          <IconLogout
                            className="h-[18px] w-[18px] text-[#ef775f]"
                            aria-hidden="true"
                          />
                          {isLoggingOut ? "Signing out…" : "Sign out"}
                        </button>
                      </>
                    ) : (
                      <>
                        <ProfileMenuLink
                          href="/auth/login"
                          icon={IconLogin}
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Sign in
                        </ProfileMenuLink>
                        <ProfileMenuLink
                          href="/auth/signup"
                          icon={IconUserPlus}
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Create account
                        </ProfileMenuLink>
                      </>
                    )}
                  </div>
                </div>
              )}
            </DropdownPortal>
          </div>
        </div>
      </NavBody>

      <MobileNav visible transparent={transparent}>
        <MobileNavHeader>
          <NavbarLogo className="mr-0 px-1" />
          <div className="flex items-center gap-1.5">
            <SearchBar
              placeholder="Search movies, series..."
              onSearch={() => undefined}
            />
            <Link
              href={profileHref}
              aria-label={
                isAuthenticated ? "View your profile" : "Sign in to Moodies"
              }
              className={`grid min-h-11 min-w-11 place-items-center rounded-xl transition active:scale-95 ${focusRing}`}
            >
              {avatar()}
            </Link>
            <MobileNavToggle
              isOpen={isMobileOpen}
              onClick={() => setIsMobileOpen((open) => !open)}
            />
          </div>
        </MobileNavHeader>
      </MobileNav>

      <MobileNavMenu
        isOpen={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
      >
        <div className="mx-auto w-full max-w-xl pb-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0" aria-hidden="true">
              <Image
                src={MOODIES_LOGO}
                alt=""
                fill
                sizes="48px"
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ef775f]">
                Moodies guide
              </p>
              <h2 className="text-xl font-bold text-[var(--ink)]">
                Where to next?
              </h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                Browse a homepage or open its collections.
              </p>
            </div>
          </div>

          <nav aria-label="Mobile navigation" className="space-y-2">
            {routes.map((route) => {
              const subOptions = routeOptions[route.href] || [];
              const isExpanded = mobileExpandedRoute === route.href;

              return (
                <div
                  key={route.href}
                  className={`overflow-hidden rounded-2xl border transition-colors ${
                    isExpanded
                      ? "border-[#e94f37]/20 bg-white/[0.045]"
                      : "border-white/[0.08] bg-white/[0.025]"
                  }`}
                >
                  <div className="flex min-h-14 items-center">
                    <Link
                      href={route.href}
                      onClick={() => setIsMobileOpen(false)}
                      aria-current={
                        pathname === route.href ? "page" : undefined
                      }
                      className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 text-left ${focusRing}`}
                    >
                      <NavigationMascot
                        href={route.href}
                        className="h-10 w-10"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--ink)]">
                          {route.name}
                        </span>
                        {(route.href === "/movies" || route.href === "/tv") && (
                          <span className="block text-xs text-[var(--ink-muted)]">
                            Explore the homepage
                          </span>
                        )}
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`${isExpanded ? "Hide" : "Show"} ${route.name} collections`}
                      aria-expanded={isExpanded}
                      aria-controls={`mobile-collections-${route.href.replaceAll("/", "-")}`}
                      onClick={() =>
                        setMobileExpandedRoute(isExpanded ? null : route.href)
                      }
                      className={`mr-2 flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-[var(--ink-muted)] hover:bg-white/5 ${focusRing}`}
                    >
                      Collections
                      <IconChevronDown
                        className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        id={`mobile-collections-${route.href.replaceAll("/", "-")}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-1 gap-1.5 border-t border-white/[0.06] p-2.5 sm:grid-cols-2">
                          {subOptions.map((option) => (
                            <Link
                              key={option.path}
                              href={option.path}
                              onClick={() => setIsMobileOpen(false)}
                              className={`flex min-h-12 items-center justify-between rounded-xl px-3 text-sm font-medium text-[var(--ink-muted)] transition-colors hover:bg-white/[0.045] hover:text-[var(--ink)] ${focusRing}`}
                            >
                              {option.label}
                              <IconArrowUpRight
                                className="h-4 w-4 text-white/28"
                                aria-hidden="true"
                              />
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
            <Link
              href={profileHref}
              onClick={() => setIsMobileOpen(false)}
              aria-label={
                isAuthenticated ? "View your profile" : "Sign in to Moodies"
              }
              className={`rounded-xl ${focusRing}`}
            >
              {avatar("large")}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {isAuthenticated ? displayName : "Welcome to Moodies"}
              </p>
              <p className="truncate text-xs text-white/42">
                {user?.email || "Sign in to save your discoveries"}
              </p>
            </div>
            {isAuthenticated ? (
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => {
                  setIsMobileOpen(false);
                  void logout();
                }}
                aria-label="Sign out of Moodies"
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-[#ef775f] transition hover:border-[#e94f37]/25 hover:bg-[#e94f37]/[0.07] disabled:cursor-wait disabled:opacity-55 ${focusRing}`}
              >
                <IconLogout className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : (
              <Link
                href="/auth/login"
                onClick={() => setIsMobileOpen(false)}
                className={`inline-flex min-h-11 items-center rounded-xl border border-[#e94f37]/30 bg-[#e94f37]/12 px-3.5 text-sm font-semibold text-[#ffb09f] ${focusRing}`}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </MobileNavMenu>

      {portalRoot ? createPortal(desktopMenu, portalRoot) : null}
    </Navbar>
  );
}

function NavigationMascot({
  href,
  className,
}: {
  href: string;
  className: string;
}) {
  return (
    <Image
      src={`/images/moods/${sectionIntroductions[href].mascot}.png`}
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      unoptimized
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

function ProfileMenuLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/62 transition hover:bg-white/[0.05] hover:text-white ${focusRing}`}
    >
      <Icon className="h-[18px] w-[18px] text-white/42" aria-hidden="true" />
      {children}
    </Link>
  );
}

export default NavbarComponent;
