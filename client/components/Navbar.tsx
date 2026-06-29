"use client";

import React, { useEffect, useRef, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconArrowUpRight,
  IconChevronDown,
  IconHome,
  IconLogin,
  IconLogout,
  IconMenu2,
  IconMoodSmile,
  IconMovie,
  IconPhoto,
  IconSparkles,
  IconUser,
  IconUserPlus,
} from "@tabler/icons-react";
import { Bookmark, Heart, MouseIcon, Tv, Users } from "lucide-react";
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
  { name: "Series", href: "/tv" },
  { name: "Celebrities", href: "/celeb" },
  { name: "Your Moods", href: "/moods/explore", noLink: true },
  { name: "My Collection", href: "/collection", noLink: true },
];

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

const routeIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "/": IconHome,
  "/movies": IconMovie,
  "/tv": Tv,
  "/celeb": Users,
  "/moods/explore": IconMoodSmile,
  "/collection": Bookmark,
};

const MOODIES_LOGO = "/images/moodies-transparent.png";
const MOODIES_SIZE = { width: 30, height: 30 };
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#e94f37]/75 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c0f]";

export function NavbarComponent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState(routes[0].href);
  const [mobileExpandedRoute, setMobileExpandedRoute] = useState<string | null>(
    routes[0].href,
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
            className="relative grid h-[min(720px,88svh)] min-h-0 w-full max-w-5xl grid-cols-[minmax(230px,0.78fr)_minmax(0,1.45fr)] overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0c0f]/95 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <aside className="flex min-h-0 flex-col border-r border-white/[0.08] bg-white/[0.025] p-5 xl:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#ef775f]">
                    <IconSparkles className="h-4 w-4" aria-hidden="true" />
                    Moodies guide
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Explore
                  </h2>
                  <p className="mt-1 text-sm text-white/45">
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
                  const RouteIcon = routeIcons[route.href] || IconPhoto;

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
                        className={`flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left ${focusRing}`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                            isActive
                              ? "border-[#e94f37]/25 bg-[#e94f37]/10 text-[#f2836d]"
                              : "border-white/[0.08] bg-white/[0.035] text-white/55 group-hover:text-white/80"
                          }`}
                        >
                          <RouteIcon
                            className="h-[18px] w-[18px]"
                            aria-hidden="true"
                          />
                        </span>
                        <span
                          className={`truncate text-sm font-medium ${
                            isActive ? "text-white" : "text-white/68"
                          }`}
                        >
                          {route.name}
                        </span>
                      </button>
                      {!route.noLink && (
                        <Link
                          href={route.href}
                          onClick={() => setIsMenuOpen(false)}
                          aria-label={`Go to ${route.name}`}
                          className={`mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-[#f2836d] ${focusRing}`}
                        >
                          <IconArrowUpRight
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </Link>
                      )}
                    </motion.div>
                  );
                })}
              </nav>

              <p className="mt-auto pt-5 text-xs text-white/28">
                © {new Date().getFullYear()} Moodies
              </p>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden p-5 xl:p-6">
              <div className="mb-4 flex shrink-0 items-end justify-between gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#ef775f]">
                    {routes.find((route) => route.href === activeRoute)?.name}
                  </p>
                  <h3 className="text-xl font-semibold tracking-tight">
                    Pick a destination
                  </h3>
                </div>
                <span className="hidden text-xs text-white/35 sm:block">
                  {routeOptions[activeRoute]?.length || 0} places to explore
                </span>
              </div>

              <motion.div
                key={activeRoute}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                role="tabpanel"
                aria-label={`${routes.find((route) => route.href === activeRoute)?.name} destinations`}
                tabIndex={0}
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.07] bg-black/10 p-2 pr-1.5 [scrollbar-color:rgba(233,79,55,0.38)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] ${focusRing}`}
              >
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
                        className={`group flex min-h-[76px] items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#e94f37]/25 hover:bg-white/[0.055] ${focusRing}`}
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white/82 transition-colors group-hover:text-white">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs text-white/35">
                            Explore this collection
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
    <Navbar>
      <NavBody className="hidden lg:flex">
        <NavbarLogo />

        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-1"
        >
          {[
            { label: "Movies", href: "/movies", icon: IconMovie },
            { label: "Series", href: "/tv", icon: Tv },
            { label: "Celebs", href: "/celeb", icon: Users },
            { label: "Feed", href: "/feed", icon: MouseIcon },
            { label: "Moods", href: "/moods/explore", icon: IconMoodSmile },
          ].map((item) => {
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white/68 transition hover:bg-white/[0.055] hover:text-white ${focusRing}`}
              >
                <ItemIcon className="h-5 w-5" aria-hidden="true" />
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
            onClick={() => setIsMenuOpen((open) => !open)}
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

      <MobileNav visible>
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
              <h2 className="text-xl font-semibold text-white">
                Where to next?
              </h2>
            </div>
          </div>

          <nav aria-label="Mobile navigation" className="space-y-2">
            {routes.map((route) => {
              const subOptions = routeOptions[route.href] || [];
              const isExpanded = mobileExpandedRoute === route.href;
              const RouteIcon = routeIcons[route.href] || IconPhoto;

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
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setMobileExpandedRoute(isExpanded ? null : route.href)
                      }
                      className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 text-left ${focusRing}`}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                          isExpanded
                            ? "border-[#e94f37]/25 bg-[#e94f37]/10 text-[#f2836d]"
                            : "border-white/[0.08] bg-white/[0.035] text-white/55"
                        }`}
                      >
                        <RouteIcon
                          className="h-[18px] w-[18px]"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="truncate text-sm font-semibold text-white/85">
                        {route.name}
                      </span>
                      <IconChevronDown
                        className={`ml-auto h-4 w-4 text-white/38 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    {!route.noLink && (
                      <Link
                        href={route.href}
                        onClick={() => setIsMobileOpen(false)}
                        aria-label={`Go to ${route.name}`}
                        className={`mr-2 grid h-10 w-10 place-items-center rounded-xl text-white/45 transition hover:bg-white/[0.06] hover:text-[#f2836d] ${focusRing}`}
                      >
                        <IconArrowUpRight
                          className="h-4 w-4"
                          aria-hidden="true"
                        />
                      </Link>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
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
                              className={`flex min-h-12 items-center justify-between rounded-xl border border-white/[0.06] bg-black/15 px-3 text-sm font-medium text-white/72 transition hover:border-[#e94f37]/20 hover:bg-white/[0.045] hover:text-white ${focusRing}`}
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
