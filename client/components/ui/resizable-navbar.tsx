"use client";
import { cn } from "@/lib/utils";
import { IconMenu2, IconX } from "@tabler/icons-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import React, { useRef, useState } from "react";
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
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious();
    if (previous === undefined) return;

    if (latest > previous && latest > 80) {
      // scrolling down
      setHidden(true);
    } else {
      // scrolling up
      setHidden(false);
    }
  });

  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}

      className={cn("fixed inset-x-0 top-0 z-50 w-full flex items-center px-4", "backdrop-blur-md bg-gradient-to-b to-transparent", "h-32 md:h-24", className)}

      style={{
        // keep your gradient mask styling
        maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 50%, transparent 100%)",
      }}
    >
      {children}
    </motion.div>
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
        <a
          key={idx}
          href={item.link}
          onClick={onItemClick}
          className="relative text-gray-200 hover:text-white transition-colors"
        >
          {item.name}
          <span className="absolute left-0 -bottom-1 h-0.5 w-0 bg-blue-400 transition-all group-hover:w-full" />
        </a>
      ))}
    </div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(10px)" : "none",
        boxShadow: visible
          ? "0 0 24px rgba(34, 42, 53, 0.06), 0 1px 1px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(34, 42, 53, 0.04), 0 0 4px rgba(34, 42, 53, 0.08), 0 16px 68px rgba(47, 48, 55, 0.05), 0 1px 0 rgba(255, 255, 255, 0.1) inset"
          : "none",
        width: visible ? "90%" : "100%",
        paddingRight: visible ? "12px" : "0px",
        paddingLeft: visible ? "12px" : "0px",
        borderRadius: visible ? "4px" : "2rem",
        y: visible ? 20 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 50,
      }}
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between bg-transparent px-0 py-3 lg:hidden",
        visible && "bg-transparent dark:bg-transparent",
        className
      )}
      style={{
        // Add the same extended fade effect to mobile nav
        maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 50%, transparent 100%)",
      }}
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
            "p-6",
            className
          )}
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
      className="lg:hidden p-2 text-white hover:text-gray-300 transition-colors z-30"
      aria-label={isOpen ? "Close menu" : "Open menu"}
    >
      {isOpen ? (
        <IconX className="h-6 w-6" />
      ) : (
        <IconMenu2 className="h-6 w-6" />
      )}
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
        src="images/globe.svg"
        alt="logo"
        width={30}
        height={30}
      />{" "}
      <span className="font-medium text-white">Moodies</span>{" "}
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
      <a href={href} className={`${base} ${variantClass} ${className ?? ""}`}>
        {children}
      </a>
    );

  return (
    <button className={`${base} ${variantClass} ${className ?? ""}`}>
      {children}
    </button>
  );
};
