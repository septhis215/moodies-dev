"use client";

import { useEffect, useRef, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconBookmark,
  IconChevronDown,
  IconCompass,
  IconDeviceTv,
  IconLogout,
  IconMenu2,
  IconMoodSmile,
  IconMovie,
  IconUsers,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { useAuth } from "@/app/context/AuthProvider";
import { appToast } from "@/lib/toast";
import DropdownPortal from "./ui/dropdownPortal";
import SearchBar from "./ui/searchbar";
import {
  MobileNav,
  MobileNavHeader,
  NavBody,
  Navbar,
  NavbarLogo,
} from "./ui/resizable-navbar";

type NavigationLink = { name: string; href: string };

const primaryLinks: NavigationLink[] = [
  { name: "Movies", href: "/movies" },
  { name: "TV shows", href: "/tv" },
  { name: "Moods", href: "/moods/explore" },
  { name: "Feed", href: "/feed" },
];

const navigationGroups = [
  {
    title: "Discover",
    icon: IconCompass,
    links: [
      { name: "Home", href: "/" },
      { name: "Trending", href: "/trending" },
      { name: "New releases", href: "/fresh-off-the-screen" },
      { name: "Coming soon", href: "/coming-soon" },
      { name: "Korean hits", href: "/korean-hits" },
    ],
  },
  {
    title: "Community & people",
    icon: IconUsers,
    links: [
      { name: "Community", href: "/community" },
      { name: "Celebrities", href: "/celeb" },
    ],
  },
  {
    title: "Mood tools",
    icon: IconMoodSmile,
    links: [
      { name: "Mood wheel", href: "/moods" },
      { name: "Personality quiz", href: "/quiz" },
      { name: "Movies for your mood", href: "/movies#moods" },
      { name: "TV for your mood", href: "/tv#moods" },
    ],
  },
  {
    title: "Your library",
    icon: IconBookmark,
    links: [
      { name: "Collection", href: "/collection" },
      { name: "Watchlist", href: "/watchlist" },
      { name: "Liked titles", href: "/liked" },
    ],
  },
];

const mobileRoutes = [
  { name: "Home", href: "/" },
  { name: "Movies", href: "/movies" },
  { name: "TV shows", href: "/tv" },
  { name: "Celebrities", href: "/celeb" },
  { name: "Moods", href: "/moods/explore" },
  { name: "Feed", href: "/feed" },
  { name: "Community", href: "/community" },
  { name: "Collection", href: "/collection" },
];

const mobileRouteOptions: Record<string, { label: string; path: string }[]> = {
  "/": [
    { label: "Movies", path: "/movies" },
    { label: "TV shows", path: "/tv" },
    { label: "Trending", path: "/trending" },
    { label: "New Releases", path: "/fresh-off-the-screen" },
    { label: "Korean Hits", path: "/korean-hits" },
    { label: "Moods", path: "/moods/explore" },
    { label: "Community", path: "/community" },
    { label: "Coming Soon", path: "/coming-soon" },
  ],
  "/movies": [
    { label: "Box Office Hits", path: "/movies/box-office" },
    { label: "New Releases", path: "/movies/new-releases" },
    { label: "Featured Now", path: "/movies/featured" },
    { label: "Korean Cinema", path: "/movies/korean-cinema" },
    { label: "Action", path: "/movies/action" },
    { label: "Award Winners", path: "/movies/award-winners" },
    { label: "Animation", path: "/movies/animated" },
    { label: "Indie Spotlight", path: "/movies/indie" },
    { label: "Match by mood", path: "/movies#moods" },
  ],
  "/tv": [
    { label: "Airing Today", path: "/tv/airing/today" },
    { label: "Trending Now", path: "/tv/trending" },
    { label: "New Releases", path: "/tv/new-releases" },
    { label: "Top Rated", path: "/tv/top-rated" },
    { label: "Airing This Week", path: "/tv/airing/week" },
    { label: "K-dramas", path: "/tv/k-drama" },
    { label: "Match by mood", path: "/tv#moods" },
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
    { label: "Mood wheel", path: "/moods" },
    { label: "Movies for your mood", path: "/movies#moods" },
    { label: "TV shows for your mood", path: "/tv#moods" },
    { label: "Personality Quiz", path: "/quiz" },
    { label: "Moodies Feed", path: "/feed" },
  ],
  "/collection": [
    { label: "Watchlist", path: "/watchlist" },
    { label: "Liked titles", path: "/liked" },
  ],
  "/feed": [
    { label: "Trending", path: "/trending" },
    { label: "Movies", path: "/movies" },
    { label: "TV shows", path: "/tv" },
  ],
  "/community": [
    { label: "Website feedback", path: "/community" },
    { label: "Moodies Feed", path: "/feed" },
  ],
};

const mobileMascotSources: Record<string, string> = {
  "/": "/images/moods/happy.png",
  "/movies": "/images/badges/movie-buff.png",
  "/tv": "/images/badges/binge-legend.png",
  "/celeb": "/images/moods/inspirational.png",
  "/moods/explore": "/images/badges/mood-starter.png",
  "/feed": "/images/mascot-feed.png",
  "/community": "/images/badges/community-star.png",
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]";
const controlStyle = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] ${focusRing}`;

export function NavbarComponent({
  sticky = false,
  transparent = false,
}: {
  sticky?: boolean;
  transparent?: boolean;
}) {
  const pathname = usePathname();
  const { user, isAuthenticated, logout: doLogout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [mobileExpandedRoute, setMobileExpandedRoute] = useState<string | null>(
    null,
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountContentRef = useRef<HTMLElement>(null);
  const previousPathRef = useRef(pathname);
  const displayName = user?.username ?? user?.name ?? "Account";
  const initial = (user?.username?.[0] || user?.name?.[0] || "M").toUpperCase();

  useEffect(() => {
    const element = document.createElement("div");
    element.id = "menu-portal";
    document.body.appendChild(element);
    setPortalRoot(element);
    return () => element.remove();
  }, []);

  useEffect(() => {
    if (previousPathRef.current !== pathname) {
      setIsMenuOpen(false);
      setMobileExpandedRoute(null);
      setIsProfileOpen(false);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 1024px)");
    const closeOverlays = () => {
      setIsMenuOpen(false);
      setMobileExpandedRoute(null);
      setIsProfileOpen(false);
    };
    breakpoint.addEventListener("change", closeOverlays);
    window.addEventListener("popstate", closeOverlays);
    return () => {
      breakpoint.removeEventListener("change", closeOverlays);
      window.removeEventListener("popstate", closeOverlays);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // Native modal behavior makes the page inert and contains keyboard focus.
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && previousFocus.getClientRects().length)
        previousFocus.focus({ preventScroll: true });
    };
  }, [isMenuOpen, portalRoot]);

  useEffect(() => {
    if (!isProfileOpen) return;
    const closeOutside = (event: Event) => {
      const target = event.target as Node;
      if (
        !accountTriggerRef.current?.contains(target) &&
        !accountContentRef.current?.contains(target)
      )
        setIsProfileOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
        accountTriggerRef.current?.focus();
      }
    };
    const openedAt = { x: window.scrollX, y: window.scrollY };
    const closeOnScroll = () => {
      if (window.scrollX !== openedAt.x || window.scrollY !== openedAt.y)
        setIsProfileOpen(false);
    };
    const closeOnResize = () => setIsProfileOpen(false);
    const frame = window.requestAnimationFrame(() =>
      accountContentRef.current
        ?.querySelector<HTMLElement>("a, button")
        ?.focus({ preventScroll: true }),
    );
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", escape);
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    window.addEventListener("resize", closeOnResize);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", closeOnScroll);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [isProfileOpen]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setMobileExpandedRoute(null);
  };
  const openMenu = () => {
    setIsProfileOpen(false);
    setIsMenuOpen(true);
  };
  const toggleAccount = () => {
    const rect = accountTriggerRef.current?.getBoundingClientRect();
    if (rect)
      setDropdownPosition({
        top: rect.bottom + 8,
        left: Math.max(12, rect.right - 240),
      });
    setIsProfileOpen((open) => !open);
  };

  const logout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setIsProfileOpen(false);
    closeMenu();
    try {
      await doLogout();
      appToast.info("You've been logged out successfully", {
        title: "See you next time",
        duration: 3000,
      });
    } catch {
      appToast.error("Could not sign out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const isPrimaryActive = (href: string) =>
    href === "/moods/explore"
      ? pathname === "/quiz" ||
        pathname === "/moods" ||
        pathname.startsWith("/moods/")
      : pathname === href || pathname.startsWith(`${href}/`);
  const isDestinationActive = (href: string) =>
    !href.includes("#") &&
    (pathname === href ||
      (href !== "/" && href !== "/moods" && pathname.startsWith(`${href}/`)));
  const isMoreActive =
    navigationGroups.some((group) =>
      group.links.some(
        (link) => link.href !== "/" && isDestinationActive(link.href),
      ),
    ) && !primaryLinks.some((link) => isPrimaryActive(link.href));
  const destinationClass = (href: string) =>
    `group flex min-h-11 items-center justify-between gap-2 rounded-lg border-l-2 px-3 py-2 text-sm leading-5 transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] ${isDestinationActive(href) ? "border-[var(--brand-coral-strong)] bg-[var(--surface-2)] font-semibold text-[var(--brand-coral-strong)]" : "border-transparent text-[var(--ink-muted)]"} ${focusRing}`;

  const avatar = () => (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--ink)]">
      {user?.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt=""
          width={32}
          height={32}
          unoptimized
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        initial
      )}
    </span>
  );

  const mobileAvatar = (large = false) => (
    <span
      className={`grid ${large ? "h-12 w-12" : "h-11 w-11"} shrink-0 place-items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.055] text-sm font-semibold text-white/80`}
    >
      {isAuthenticated && user?.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt=""
          width={large ? 48 : 44}
          height={large ? 48 : 44}
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

  const accountControl = isAuthenticated ? (
    <button
      ref={accountTriggerRef}
      type="button"
      aria-label="Account"
      aria-expanded={isProfileOpen}
      aria-controls="account-navigation"
      onClick={toggleAccount}
      className={`${controlStyle} pl-1.5 pr-2 text-[var(--ink)]`}
    >
      {avatar()}
      <span className="hidden max-w-28 truncate xl:block">{displayName}</span>
      <IconChevronDown
        className={`h-4 w-4 text-[var(--ink-muted)] ${isProfileOpen ? "rotate-180" : ""}`}
        aria-hidden="true"
      />
    </button>
  ) : (
    <Link
      href="/auth/login"
      className={`${controlStyle} border border-[var(--surface-border)] text-[var(--ink)]`}
    >
      Sign in
    </Link>
  );

  const search = (
    <SearchBar
      placeholder="Search movies, series..."
      onSearch={() => undefined}
    />
  );
  const modal = (
    <dialog
      ref={dialogRef}
      id="site-menu"
      aria-label="Navigation menu"
      onCancel={closeMenu}
      onClose={closeMenu}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const links = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled])",
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = links[0];
        const last = links[links.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeMenu();
      }}
      className="fixed inset-0 m-0 ml-auto h-dvh max-h-dvh w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-[var(--ink)] backdrop:bg-black/65 lg:m-auto lg:h-auto lg:max-h-[min(760px,calc(100dvh-3rem))] lg:w-[min(1000px,calc(100vw-3rem))] lg:max-w-none lg:rounded-2xl lg:backdrop:bg-black/45"
    >
      <div
        className="flex h-full max-h-dvh flex-col border-0 border-[var(--surface-border)] lg:border bg-[var(--surface-0)] lg:h-auto lg:max-h-[min(760px,calc(100dvh-3rem))] lg:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto flex w-full shrink-0 items-center justify-end gap-4 border-[var(--surface-border)] px-4 pb-0 sm:max-w-[calc(36rem+3rem)] sm:px-6 lg:max-w-none lg:justify-between lg:border-b lg:pb-4 pt-[max(1rem,env(safe-area-inset-top))] lg:px-6 lg:pt-5">
          <div className="hidden lg:block">
            <p className="ui-kicker">Explore Moodies</p>
            <h2 className="mt-2 text-xl font-bold leading-tight sm:text-2xl">
              What will you watch?
            </h2>
          </div>
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Close menu"
            className={`grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] lg:rounded-lg lg:border-0 lg:bg-transparent ${focusRing}`}
          >
            <IconX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 lg:flex-initial lg:px-6 lg:py-6">
          <div className="hidden lg:block">
            <nav
              aria-label="Main destinations"
              className="mb-6 grid grid-cols-2 gap-3 border-b border-[var(--surface-border)] pb-6 lg:grid-cols-[1fr_1fr_1.3fr]"
            >
              {primaryLinks.map((link, index) => {
                const HubIcon =
                  link.href === "/movies" ? IconMovie : IconDeviceTv;
                const isHub = index < 2;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    aria-current={
                      pathname === link.href
                        ? "page"
                        : isPrimaryActive(link.href)
                          ? "location"
                          : undefined
                    }
                    className={`group flex min-h-12 flex-col items-start justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-4 text-left transition-colors hover:border-[var(--brand-coral-strong)] hover:bg-[var(--surface-2)] ${isHub ? "lg:min-h-40" : "lg:hidden"} ${isPrimaryActive(link.href) ? "text-[var(--brand-coral-strong)]" : "text-[var(--ink)]"} ${focusRing}`}
                  >
                    {isHub && (
                      <HubIcon
                        className="mb-3 h-7 w-7 text-[var(--brand-coral-strong)]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="flex w-full items-center justify-between gap-2 text-base font-semibold leading-5">
                      {link.name}
                      <IconArrowRight
                        className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-colors group-hover:text-[var(--brand-coral-strong)]"
                        aria-hidden="true"
                      />
                    </span>
                    {isHub && (
                      <span className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                        {link.href === "/movies"
                          ? "Discover your next film."
                          : "Find your next series."}
                      </span>
                    )}
                  </Link>
                );
              })}
              <Link
                href="/moods"
                onClick={closeMenu}
                className={`group col-span-2 flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--brand-gold)_32%,var(--surface-border))] bg-[color-mix(in_srgb,var(--brand-gold)_8%,var(--surface-1))] p-4 transition-colors hover:border-[var(--brand-gold)] hover:bg-[color-mix(in_srgb,var(--brand-gold)_12%,var(--surface-1))] lg:col-span-1 ${focusRing}`}
              >
                <span className="min-w-0">
                  <span className="block text-base font-semibold leading-5 text-[var(--ink)]">
                    Let your mood lead
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-[var(--ink-muted)]">
                    Find a watch for how you feel.
                  </span>
                  <span className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--brand-gold)]">
                    Find my mood{" "}
                    <IconArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </span>
                <Image
                  src="/images/moodies-mascot.png"
                  alt=""
                  width={128}
                  height={128}
                  sizes="(min-width: 1024px) 160px, 120px"
                  className="h-24 w-24 shrink-0 scale-125 object-contain motion-safe:transition-transform motion-safe:group-hover:-rotate-3 lg:h-32 lg:w-32"
                />
              </Link>
            </nav>
            <nav
              aria-label="More destinations"
              className="grid grid-cols-1 gap-6 min-[360px]:grid-cols-2 lg:grid-cols-4 lg:gap-5"
            >
              {navigationGroups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <section key={group.title} aria-label={group.title}>
                    <h3 className="mb-2 flex items-center gap-2 px-3 text-sm font-semibold leading-5 text-[var(--ink)]">
                      <GroupIcon
                        className="h-4 w-4 shrink-0 text-[var(--brand-coral-strong)]"
                        aria-hidden="true"
                      />
                      {group.title}
                    </h3>
                    <ul className="space-y-0.5">
                      {group.links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={closeMenu}
                            aria-current={
                              pathname === link.href
                                ? "page"
                                : isDestinationActive(link.href)
                                  ? "location"
                                  : undefined
                            }
                            className={destinationClass(link.href)}
                          >
                            <span>{link.name}</span>
                            <IconArrowRight
                              className="h-3.5 w-3.5 shrink-0 text-[var(--brand-coral-strong)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </nav>
          </div>
          <div className="mx-auto w-full max-w-xl pb-6 lg:hidden">
            <div className="mb-5 flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0" aria-hidden="true">
                <Image
                  src="/images/moodies-transparent.png"
                  alt=""
                  fill
                  sizes="48px"
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-coral-strong)]">
                  Moodies guide
                </p>
                <h2 className="text-xl font-bold text-[var(--ink)]">
                  Where to next?
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  Find something to watch and explore your moods.
                </p>
              </div>
            </div>
            <nav aria-label="Mobile navigation" className="space-y-2">
              {mobileRoutes
                .filter((route) => route.href !== "/collection")
                .map((route) => {
                  const options = mobileRouteOptions[route.href] || [];
                  const isExpanded = mobileExpandedRoute === route.href;
                  const collectionId =
                    "mobile-collections-" + route.href.replaceAll("/", "-");
                  return (
                    <div
                      key={route.href}
                      className={`overflow-hidden rounded-2xl border transition-colors ${isExpanded ? "border-[var(--brand-coral)]/20 bg-white/[0.045]" : "border-white/[0.08] bg-white/[0.025]"}`}
                    >
                      <div className="flex min-h-14 items-center">
                        <Link
                          href={route.href}
                          onClick={closeMenu}
                          aria-current={
                            pathname === route.href ? "page" : undefined
                          }
                          className={`flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3.5 text-left ${focusRing}`}
                        >
                          <Image
                            src={mobileMascotSources[route.href]}
                            alt=""
                            aria-hidden="true"
                            width={48}
                            height={48}
                            unoptimized
                            className="h-10 w-10 shrink-0 object-contain"
                          />
                          <span className="text-sm font-semibold text-[var(--ink)]">
                            {route.name}
                          </span>
                        </Link>
                        <button
                          type="button"
                          aria-label={`${isExpanded ? "Hide" : "Show"} ${route.name} quick links`}
                          aria-expanded={isExpanded}
                          aria-controls={collectionId}
                          onClick={() =>
                            setMobileExpandedRoute(
                              isExpanded ? null : route.href,
                            )
                          }
                          className={`mr-2 flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-xl px-2 text-xs font-semibold text-[var(--ink-muted)] hover:bg-white/5 ${focusRing}`}
                        >
                          More{" "}
                          <IconChevronDown
                            className={`h-4 w-4 motion-safe:transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                      {isExpanded && (
                        <div
                          id={collectionId}
                          className="grid grid-cols-1 gap-1.5 border-t border-white/[0.06] p-2.5 sm:grid-cols-2"
                        >
                          {options.map((option) => (
                            <Link
                              key={option.path}
                              href={option.path}
                              onClick={closeMenu}
                              className={`flex min-h-12 items-center justify-between gap-2 rounded-xl px-3 text-sm font-medium text-[var(--ink-muted)] transition-colors hover:bg-white/[0.045] hover:text-[var(--ink)] ${focusRing}`}
                            >
                              {option.label}
                              <IconArrowUpRight
                                className="h-4 w-4 shrink-0 text-white/28"
                                aria-hidden="true"
                              />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </nav>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3">
              <Link
                href={isAuthenticated ? "/profile" : "/auth/login"}
                onClick={closeMenu}
                aria-label={
                  isAuthenticated ? "View your profile" : "Sign in to Moodies"
                }
                className={`rounded-xl ${focusRing}`}
              >
                {mobileAvatar(true)}
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
                  onClick={() => void logout()}
                  aria-label="Sign out of Moodies"
                  className={`grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-[var(--brand-coral-strong)] transition-colors hover:border-[var(--brand-coral)]/25 hover:bg-[var(--brand-coral)]/[0.07] disabled:cursor-wait disabled:opacity-55 ${focusRing}`}
                >
                  <IconLogout className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={closeMenu}
                  className={`inline-flex min-h-11 items-center rounded-xl border border-[var(--brand-coral)]/30 bg-[var(--brand-coral)]/12 px-3.5 text-sm font-semibold text-[var(--brand-coral-strong)] ${focusRing}`}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="hidden shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--surface-border)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 lg:flex lg:px-6 lg:pb-5">
          {isAuthenticated ? (
            <>
              <Link
                href="/profile"
                onClick={closeMenu}
                className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-1 text-sm font-semibold ${focusRing}`}
              >
                {avatar()}
                <span className="max-w-44 truncate">My profile</span>
              </Link>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => void logout()}
                className={`${controlStyle} cursor-pointer text-[var(--ink-muted)] disabled:cursor-wait disabled:opacity-50`}
              >
                <IconLogout className="h-4 w-4" aria-hidden="true" />
                {isLoggingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/signup"
                onClick={closeMenu}
                className={`${controlStyle} text-[var(--ink-muted)]`}
              >
                Create account
              </Link>
              <Link
                href="/auth/login"
                onClick={closeMenu}
                className={`${controlStyle} border border-[var(--surface-border)] bg-[var(--surface-2)] text-[var(--ink)]`}
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </dialog>
  );

  return (
    <>
      <Navbar sticky={sticky} transparent={transparent}>
        <NavBody className="hidden lg:flex lg:py-3">
          <NavbarLogo />
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-1"
          >
            {primaryLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={
                  pathname === link.href
                    ? "page"
                    : isPrimaryActive(link.href)
                      ? "location"
                      : undefined
                }
                className={`${controlStyle} ${isPrimaryActive(link.href) ? "bg-[var(--surface-2)] text-[var(--brand-coral-strong)]" : "text-[var(--ink-muted)]"}`}
              >
                {link.name}
              </Link>
            ))}
            <button
              type="button"
              onClick={openMenu}
              aria-expanded={isMenuOpen}
              aria-controls="site-menu"
              aria-haspopup="dialog"
              className={`${controlStyle} cursor-pointer ${isMoreActive ? "text-[var(--brand-coral-strong)]" : "text-[var(--ink-muted)]"}`}
            >
              More
              <IconChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {search}
            <span
              className="mx-1 h-6 w-px bg-[var(--surface-border)]"
              aria-hidden="true"
            />
            {accountControl}
          </div>
        </NavBody>
        <MobileNav visible transparent={transparent}>
          <MobileNavHeader>
            <NavbarLogo />
            <div className="flex shrink-0 items-center gap-2">
              {search}
              <Link
                href={isAuthenticated ? "/profile" : "/auth/login"}
                aria-label={
                  isAuthenticated ? "View your profile" : "Sign in to Moodies"
                }
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition active:scale-95 ${focusRing}`}
              >
                {mobileAvatar()}
              </Link>
              <button
                type="button"
                onClick={openMenu}
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMenuOpen}
                aria-controls="site-menu"
                aria-haspopup="dialog"
                className={`grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-white/70 outline-none transition-colors hover:border-[var(--brand-coral)]/25 hover:bg-white/[0.075] hover:text-white ${focusRing}`}
              >
                <IconMenu2 className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </MobileNavHeader>
        </MobileNav>
      </Navbar>
      <DropdownPortal>
        {isProfileOpen && (
          <nav
            ref={accountContentRef}
            id="account-navigation"
            aria-label="Account"
            className="fixed z-[9999] w-60 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-1)] p-2 text-[var(--ink)] shadow-xl"
            style={dropdownPosition}
          >
            <p className="truncate border-b border-[var(--surface-border)] px-3 py-3 text-sm font-semibold">
              {displayName}
            </p>
            {[
              { name: "My profile", href: "/profile" },
              { name: "Watchlist", href: "/watchlist" },
              { name: "Liked titles", href: "/liked" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsProfileOpen(false)}
                className={destinationClass(link.href)}
              >
                {link.name}
              </Link>
            ))}
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => void logout()}
              className={`${controlStyle} mt-1 w-full cursor-pointer justify-start border-t border-[var(--surface-border)] text-[var(--ink-muted)] disabled:cursor-wait disabled:opacity-50`}
            >
              <IconLogout className="h-4 w-4" aria-hidden="true" />
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
          </nav>
        )}
      </DropdownPortal>
      {portalRoot ? createPortal(modal, portalRoot) : null}
    </>
  );
}

export default NavbarComponent;
