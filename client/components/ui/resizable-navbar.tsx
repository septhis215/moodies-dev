"use client";
import { cn } from "@/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
  motion,
  AnimatePresence,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import React, { useRef } from "react";
import { createPortal } from "react-dom";

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
        "absolute inset-x-0 top-0 z-[999] flex w-full items-start px-0 lg:items-center lg:px-4",
        "bg-gradient-to-b from-black/50 via-black/20 to-transparent backdrop-blur-[3px] lg:backdrop-blur-[4px]",
        "h-14 md:h-24",
        "lg:[mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)] lg:[-webkit-mask-image:linear-gradient(to_bottom,black_70%,transparent_100%)]",
        className
      )}
    >
      {children}
    </div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(10px)" : "none",
        backgroundColor: visible ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0)",
        boxShadow: visible ? "0 6px 20px rgba(0,0,0,0.25)" : "none",
      }}
      transition={{ type: "spring", stiffness: 200, damping: 30 }}
      className={cn(
        "relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10 text-white",
        // Ensure content is above the fade mask
        "z-20",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  return (
    <div
      className={cn(
        "hidden lg:flex items-center space-x-6 font-medium text-[15px]",
        className
      )}
    >
      {items.map((item, idx) => (
        <Link
          key={idx}
          href={item.link}
          onClick={onItemClick}
          className="relative text-gray-200 hover:text-white transition-colors"
        >
          {item.name}
          <span className="absolute left-0 -bottom-1 h-0.5 w-0 bg-blue-400 transition-all group-hover:w-full" />
        </Link>
      ))}
    </div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(12px)" : "none",
        boxShadow: visible
          ? "0 1px 0 rgba(255,255,255,0.08) inset, 0 10px 28px rgba(0,0,0,0.24)"
          : "none",
        width: "100%",
        paddingRight: visible ? "10px" : "0px",
        paddingLeft: visible ? "10px" : "0px",
        borderRadius: "0px",
        y: 0,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex w-full max-w-none flex-col items-center justify-between border-b border-white/10 bg-black/42 py-2 lg:hidden",
        "pt-[max(0.5rem,env(safe-area-inset-top))]",
        visible && "bg-black/42 dark:bg-black/42",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  if (!isOpen) return null;

  // Render full-screen modal via portal. Note: backdrop DOES NOT close on click.
  return createPortal(
    <AnimatePresence>
      <motion.div
        key="mobile-fullscreen-menu-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[9998] bg-black/60"
        // no onClick here — we don't close when pressing outside
        aria-hidden={!isOpen}
      >
        {/* Inner container holds the full content and the top-right close button */}
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className={cn(
            "absolute inset-0 z-[9999] flex flex-col overflow-auto",
            "bg-[linear-gradient(180deg,rgba(6,6,8,0.98),rgba(0,0,0,0.95))] backdrop-blur-md",
            "px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6",
            className
          )}
          style={{
            background:
              "radial-gradient(circle at top left, rgba(233,79,55,0.1), black)",
          }}
          onClick={(e) => e.stopPropagation()} // stop propagation so outer backdrop doesn't react
        >
          {/* Close X in top-right */}
          <div className="w-full flex justify-end">
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="rounded-full bg-white/6 p-2 hover:bg-white/10 focus:outline-none ml-auto"
            >
              <IconX className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Actual children (your menu content) */}
          <div className="mt-4 flex-1">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      className="ml-1 grid min-h-10 min-w-10 place-items-center rounded-md border border-[#e94f37]/40 bg-[#e94f37]/10 px-2.5 py-2 text-white hover:bg-[#e94f37]/20 focus:outline-none focus:ring-2 focus:ring-[#e94f37]"
      aria-label={isOpen ? "Close menu" : "Open menu"}
      aria-expanded={isOpen}
    >
      <IconMenu2 className="h-6 w-6 text-[#e94f37]" />
    </button>
  );
};

export const NavbarLogo = ({ className }: { className?: string }) => {
  return (
    <Link
      href="/"
      className={cn(
        "relative z-20 mr-4 flex items-center space-x-2 px-2 py-1 text-sm font-normal",
        className
      )}
    >
      {" "}
      <Image
        src="/images/moodies-transparent.png"
        alt="logo"
        width={100}
        height={100}
        className="h-9 w-9 object-contain lg:h-[100px] lg:w-[100px]"
      />{" "}
      {/* <span className="font-medium text-white">Moodies</span>{" "} */}
    </Link>
  );
};

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
    "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium";
  const variantClass =
    variant === "secondary"
      ? "border border-white/20 bg-white/5 text-white hover:bg-white/10"
      : "bg-primary text-white";

  if (href)
    return (
      <Link href={href} className={`${base} ${variantClass} ${className ?? ""}`}>
        {children}
      </Link>
    );

  return (
    <button className={`${base} ${variantClass} ${className ?? ""}`}>
      {children}
    </button>
  );
};
