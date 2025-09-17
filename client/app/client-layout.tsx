"use client";

import { usePathname } from "next/navigation";
import { NavbarComponent } from "@/components/Navbar";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname.startsWith("/auth");

  return (
    <>
      {!isAuthRoute && <NavbarComponent />}
      <main>{children}</main>
    </>
  );
}
