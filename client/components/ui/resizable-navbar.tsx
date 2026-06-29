"use client";

import React, { useRef } from "react";
import { TmdbImage as Image } from "@/components/ui/TmdbImage";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: { name: string; link: string }[];
  className?: string;
  onItemClick?: () => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-x-0 top-0 z-[999] py-0 flex h-14 w-full items-start bg-gradient-to-b from-black/30 via-black/10 to-transparent px-0 backdrop-blur-[2px] md:h-24 lg:items-center lg:backdrop-blur-[3px]",
        "lg:[mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)] lg:[-webkit-mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => (
  <motion.div
    animate={{
      backdropFilter: visible ? "blur(10px)" : "none",
      backgroundColor: visible ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0)",
      boxShadow: visible ? "0 6px 20px rgba(0,0,0,0.25)" : "none",
    }}
    transition={{ type: "spring", stiffness: 200, damping: 30 }}
    className={cn(
      "relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 text-white lg:px-10",
      className,
    )}
  >
    {children}
  </motion.div>
);

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => (
  <nav
    aria-label="Primary navigation"
    className={cn("hidden items-center gap-1 text-[15px] font-medium lg:flex", className)}
  >
    {items.map((item) => (
      <Link
        key={item.link}
        href={item.link}
        onClick={onItemClick}
        className="rounded-xl px-3 py-2 text-white/68 outline-none transition hover:bg-white/[0.05] hover:text-white focus-visible:ring-2 focus-visible:ring-[#e94f37]/75"
      >
        {item.name}
      </Link>
    ))}
  </nav>
);

export const MobileNav = ({ children, className, visible }: MobileNavProps) => (
  <motion.div
    animate={{
      backdropFilter: visible ? "blur(16px)" : "blur(10px)",
      boxShadow: visible
        ? "0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 30px rgba(0,0,0,0.28)"
        : "none",
    }}
    transition={{ type: "spring", stiffness: 200, damping: 50 }}
    className={cn(
      "fixed inset-x-0 top-0 z-50 flex w-full flex-col items-center justify-between border-b border-white/[0.08] bg-[#090a0d]/88 px-2.5 py-2 backdrop-blur-xl lg:hidden",
      "pt-[max(0.5rem,env(safe-area-inset-top))]",
      className,
    )}
  >
    {children}
  </motion.div>
);

export const MobileNavHeader = ({ children, className }: MobileNavHeaderProps) => (
  <div className={cn("flex w-full flex-row items-center justify-between", className)}>
    {children}
  </div>
);

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="mobile-fullscreen-menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[9998] bg-black/75 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 28 }}
            className={cn(
              "absolute inset-0 z-[9999] flex flex-col overflow-auto bg-[#090a0d]/98 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl sm:p-6",
              className,
            )}
          >
            <div className="mx-auto flex w-full max-w-xl justify-end">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="ml-auto grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 outline-none transition hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-[#e94f37]/75"
              >
                <IconX className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 flex-1">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="ml-0.5 grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-white/75 outline-none transition hover:border-[#e94f37]/25 hover:bg-white/[0.075] hover:text-white focus-visible:ring-2 focus-visible:ring-[#e94f37]/75 active:scale-95"
    aria-label={isOpen ? "Close menu" : "Open menu"}
    aria-expanded={isOpen}
  >
    <IconMenu2 className="h-5 w-5" aria-hidden="true" />
  </button>
);

export const NavbarLogo = ({ className }: { className?: string }) => (
  <Link
    href="/"
    aria-label="Moodies home"
    className={cn(
      "relative z-20 mr-4 flex min-h-11 min-w-11 items-center justify-center rounded-xl px-2 py-1 outline-none transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-[#e94f37]/75",
      className,
    )}
  >
    <Image
      src="/images/moodies-transparent.png"
      alt=""
      width={80}
      height={80}
      className="h-8 w-8 object-contain lg:h-12 lg:w-12"
      priority
    />
  </Link>
);

export const NavbarButton = ({
  children,
  href,
  className,
  variant = "primary",
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
  variant?: "primary" | "secondary";
}) => {
  const base =
    "inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#e94f37]/75";
  const variantClass =
    variant === "secondary"
      ? "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
      : "border border-[#e94f37]/30 bg-[#e94f37]/15 text-white hover:bg-[#e94f37]/22";

  if (href) {
    return (
      <Link href={href} className={cn(base, variantClass, className)}>
        {children}
      </Link>
    );
  }

  return <button className={cn(base, variantClass, className)}>{children}</button>;
};
