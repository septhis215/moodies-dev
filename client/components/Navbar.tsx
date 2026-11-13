"use client";

import { useEffect, useRef, useState } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  IconArrowUpRight,
  IconChevronDown,
  IconDeviceTv,
  IconLogout,
  IconMenu2,
  IconMoodSmile,
  IconMovie,
  IconPlayerPlay,
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

const primaryLinks = [
  { name: "Movies", href: "/movies", icon: IconMovie },
  { name: "TV shows", href: "/tv", icon: IconDeviceTv },
  { name: "Moods", menuName: "Explore moods", href: "/moods/explore", icon: IconMoodSmile },
  { name: "Feed", menuName: "Video feed", href: "/feed", icon: IconPlayerPlay },
];

const navigationGroups = [
  {
    title: "What to watch",
    links: [
      { name: "Home", href: "/" },
      { name: "Trending", href: "/trending" },
      { name: "New releases", href: "/fresh-off-the-screen" },
      { name: "Coming soon", href: "/coming-soon" },
      { name: "Korean hits", href: "/korean-hits" },
    ],
  },
  {
    title: "Mood tools",
    links: [
      { name: "Mood wheel", href: "/moods" },
      { name: "Personality quiz", href: "/quiz" },
      { name: "Movies for your mood", href: "/movies#moods" },
      { name: "TV for your mood", href: "/tv#moods" },
    ],
  },
  {
    title: "People & community",
    links: [
      { name: "Discussions", href: "/community" },
      { name: "Celebrities", href: "/celeb" },
    ],
  },
  {
    title: "Your library",
    links: [
      { name: "Collection", href: "/collection" },
      { name: "Watchlist", href: "/watchlist" },
      { name: "Liked titles", href: "/liked" },
    ],
  },
];

const accountLinks = [
  { name: "My profile", href: "/profile" },
  { name: "Collection", href: "/collection" },
  { name: "Watchlist", href: "/watchlist" },
  { name: "Liked titles", href: "/liked" },
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]";
const controlStyle = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-[0.9375rem] font-semibold ${focusRing}`;

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
  const [menuAnchor, setMenuAnchor] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0, mobile: false });
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
      setIsProfileOpen(false);
      previousPathRef.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 1024px)");
    const closeOverlays = () => {
      setIsMenuOpen(false);
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
  };
  const openMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMenuAnchor(event.currentTarget.getBoundingClientRect().left);
    setIsProfileOpen(false);
    setIsMenuOpen(true);
  };
  const toggleAccount = (trigger: HTMLButtonElement, mobile: boolean) => {
    accountTriggerRef.current = trigger;
    const rect = trigger.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
      mobile,
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
  const getCurrent = (href: string) => {
    if (href.includes("#")) return undefined;
    if (pathname === href) return "page";
    if (!["/", "/moods", "/profile"].includes(href) && pathname.startsWith(`${href}/`)) return "location";
    return undefined;
  };
  const isMoreActive =
    !primaryLinks.some((link) => isPrimaryActive(link.href)) &&
    navigationGroups.some((group) =>
      group.links.some((link) => link.href !== "/" && getCurrent(link.href)),
    );
  const destinationClass = (href: string) =>
    `flex min-h-11 items-center rounded-md px-2 py-2 text-[0.9375rem] font-medium leading-5 ${getCurrent(href) ? "text-[var(--brand-coral-strong)]" : "text-[var(--ink)]"} ${focusRing}`;

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

  const renderAccountControl = (mobile = false) => {
    const isOpen = isProfileOpen && dropdownPosition.mobile === mobile;
    return isAuthenticated ? (
      <button
        type="button"
        aria-label="Account"
        aria-expanded={isOpen}
        aria-controls={isOpen ? "account-navigation" : undefined}
        onClick={(event) => toggleAccount(event.currentTarget, mobile)}
        className={`${controlStyle} ${mobile ? "size-11 p-0" : "pl-1.5 pr-2"} text-[var(--ink)]`}
      >
        {avatar()}
        {!mobile && (
          <>
            <span className="ui-nav-label hidden max-w-24 xl:block">
              <span className="ui-text-reveal block truncate">{displayName}</span>
            </span>
            <IconChevronDown
              className={`size-4 text-[var(--ink-muted)] motion-safe:transition-transform ${isOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </>
        )}
      </button>
    ) : (
      <Link href="/auth/login" className={controlStyle}><span className="ui-text-reveal ui-nav-label">Sign in</span></Link>
    );
  };

  const search = (
    <SearchBar
      placeholder="Search movies, series..."
      onSearch={() => undefined}
    />
  );
  const renderLinks = (links: NavigationLink[], onNavigate = closeMenu) => (
    <ul>
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            onNavigate={onNavigate}
            aria-current={getCurrent(link.href)}
            className={destinationClass(link.href)}
          >
            <span className="ui-text-reveal ui-nav-label">{link.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const modal = (
    <dialog
      ref={dialogRef}
      id="site-menu"
      aria-labelledby="site-menu-title"
      style={{ "--menu-anchor": `${menuAnchor}px` } as React.CSSProperties}
      onCancel={(event) => {
        event.preventDefault();
        closeMenu();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>("a[href], button"),
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
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
      className="ui-overlay-enter fixed inset-0 m-0 h-dvh max-h-dvh w-full max-w-none overflow-hidden bg-[var(--surface-0)] p-0 text-[var(--ink)] backdrop:bg-black/50 lg:bottom-auto lg:left-[clamp(2rem,var(--menu-anchor),calc(100vw-50rem))] lg:right-auto lg:top-20 lg:h-fit lg:max-h-[calc(100dvh-6rem)] lg:w-[48rem] lg:rounded-md lg:border lg:border-[var(--surface-border)] lg:shadow-xl"
    >
      <div className="flex h-full min-h-0 flex-col lg:h-auto lg:max-h-[calc(100dvh-6rem)]">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-[var(--surface-1)] px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
          <h2 id="site-menu-title" className="text-xl font-bold leading-tight sm:text-2xl">
            Navigation menu
          </h2>
          <button type="button" onClick={closeMenu} aria-label="Close menu" className={`${controlStyle} size-11 shrink-0 border border-[var(--surface-border)] p-0`}>
            <IconX className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav
          aria-label="Browse Moodies"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8"
        >
          <ul aria-label="Main destinations" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {primaryLinks.map(({ name, menuName, href, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onNavigate={closeMenu}
                  aria-current={getCurrent(href)}
                  className={`${destinationClass(href)} h-full gap-2 px-3 font-semibold`}
                >
                  <Icon className="size-5 shrink-0 text-[var(--brand-coral-strong)]" aria-hidden="true" stroke={1.7} />
                  <span className="ui-text-reveal ui-nav-label">{menuName ?? name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 lg:mt-6 lg:grid-cols-4 lg:gap-x-4">
            {navigationGroups.map((group) => (
              <section key={group.title} aria-label={group.title} className="min-w-0">
                <h3 className="mb-1 px-2 text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">{group.title}</h3>
                {renderLinks(group.links)}
              </section>
            ))}
          </div>
          {!isAuthenticated && (
            <div className="mt-4 border-t border-[var(--surface-border)] pt-2">
              <Link href="/auth/signup" onNavigate={closeMenu} className={`${controlStyle} text-[var(--brand-coral-strong)]`}>
                <span className="ui-text-reveal ui-nav-label">Create account</span>
                <IconArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </nav>
      </div>
    </dialog>
  );

  return (
    <>
      <Navbar
        sticky={sticky}
        transparent={transparent}
        className={`backdrop-blur-none lg:backdrop-blur-none lg:[mask-image:none] lg:[-webkit-mask-image:none] ${transparent ? "" : "lg:bg-[linear-gradient(to_bottom,rgba(11,9,9,0.94),rgba(11,9,9,0.7)_62%,transparent)]"}`}
      >
        <NavBody className="hidden lg:flex lg:justify-start lg:gap-6 lg:py-3">
          <NavbarLogo wordmark />
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
                className={`${controlStyle} ${isPrimaryActive(link.href) ? "text-[var(--brand-coral-strong)]" : "text-white/80"}`}
              >
                <span className="ui-text-reveal ui-nav-label">{link.name}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={openMenu}
              aria-expanded={isMenuOpen}
              aria-controls="site-menu"
              aria-haspopup="dialog"
              className={`${controlStyle} ${isMoreActive || isMenuOpen ? "text-[var(--brand-coral-strong)]" : "text-white/80"}`}
            >
              <span className="ui-text-reveal ui-nav-label">More</span>
              <IconChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {search}
            <span
              className="mx-1 h-6 w-px bg-[var(--surface-border)]"
              aria-hidden="true"
            />
            {renderAccountControl()}
          </div>
        </NavBody>
        <MobileNav
          visible
          transparent={transparent}
          backdropBlur="blur(2px)"
          className={transparent ? undefined : "bg-[var(--surface-0)]/90"}
        >
          <MobileNavHeader>
            <NavbarLogo wordmark />
            <div className="flex shrink-0 items-center gap-2">
              {search}
              {renderAccountControl(true)}
              <button
                type="button"
                onClick={openMenu}
                aria-label={isMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={isMenuOpen}
                aria-controls="site-menu"
                aria-haspopup="dialog"
                className={`${controlStyle} shrink-0 gap-1.5 px-2.5 text-[var(--ink)]`}
              >
                <IconMenu2 className="h-5 w-5" aria-hidden="true" />
                <span className="ui-text-reveal ui-nav-label">Menu</span>
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
            className="ui-overlay-enter fixed z-[9999] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-lg border border-[var(--surface-border)] bg-[var(--surface-1)] p-1.5 text-[var(--ink)] shadow-lg"
            style={{
              top: dropdownPosition.top,
              right: dropdownPosition.right,
              maxHeight: `calc(100dvh - ${dropdownPosition.top + 8}px)`,
            }}
          >
            <p className="mb-1 truncate border-b border-[var(--surface-border)] px-2 py-2.5 text-sm font-semibold">
              {displayName}
            </p>
            {renderLinks(accountLinks, () => setIsProfileOpen(false))}
            <div className="mt-1 border-t border-[var(--surface-border)] pt-1">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => void logout()}
                className={`${controlStyle} w-full justify-start px-2 text-[var(--ink-muted)] disabled:cursor-wait disabled:opacity-50`}
              >
                <IconLogout className="h-4 w-4" aria-hidden="true" />
                <span className="ui-text-reveal ui-nav-label">{isLoggingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </div>
          </nav>
        )}
      </DropdownPortal>
      {portalRoot ? createPortal(modal, portalRoot) : null}
    </>
  );
}

export default NavbarComponent;
