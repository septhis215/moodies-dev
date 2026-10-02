
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import { AppErrorProvider } from "./context/AppErrorProvider";
import { AuthProvider } from "./context/AuthProvider";
import { ToastProvider } from "./context/ToastContext";
import { AppToaster } from "@/components/providers/AppToaster";
import { TurnstileGateProvider } from "@/components/security/TurnstileGateProvider";
import PerformanceMonitor from "@/components/providers/PerformanceMonitor";

const ACCESS_COOKIE = "mood_at";
const SESSION_MARKER_COOKIE = "mood_session";
const SESSION_MARKER_KEY = "moodies:session";
const AUTH_PREHIDE_STYLE_ID = "moodies-auth-prehide";
const AUTH_PREHIDE_SCRIPT = `
(function () {
  try {
    var hasMarker = window.localStorage.getItem("${SESSION_MARKER_KEY}") === "1";
    var isGoogleLanding = new URLSearchParams(window.location.search).get("google_login") === "true";
    if (!hasMarker && !isGoogleLanding) return;
    var style = document.createElement("style");
    style.id = "${AUTH_PREHIDE_STYLE_ID}";
    style.textContent = "body{background:#000!important}body>*{visibility:hidden!important}";
    document.head.appendChild(style);
  } catch (error) {}
})();
`;

const bodyFont = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const displayFont = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Moodies – Movie & Series Recommendations",
    template: "%s | Moodies",
  },
  description:
    "Discover trending movies, series, and personalized recommendations on Moodies.",
  icons: {
    icon: [
      {
        url: "/images/logo-c.png",
        type: "image/png",
        sizes: "500x500",
      },
    ],
    shortcut: [
      {
        url: "/images/logo-c.png",
        type: "image/png",
        sizes: "500x500",
      },
    ],
    apple: [
      {
        url: "/images/logo-c.png",
        type: "image/png",
        sizes: "500x500",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialBlockSessionBootstrap = Boolean(
    cookieStore.get(ACCESS_COOKIE) ?? cookieStore.get(SESSION_MARKER_COOKIE),
  );

  return (
    <html lang="en" style={{ background: "#000" }} suppressHydrationWarning>
      {!initialBlockSessionBootstrap && (
        <head>
          <script dangerouslySetInnerHTML={{ __html: AUTH_PREHIDE_SCRIPT }} />
        </head>
      )}
      <body
        className={`${bodyFont.variable} ${displayFont.variable} antialiased`}
        style={{ background: "#000" }}
      >
        <PerformanceMonitor />
        <ToastProvider>
          <AuthProvider initialBlockSessionBootstrap={initialBlockSessionBootstrap}>
            <AppErrorProvider>
              <TurnstileGateProvider>
                <ClientLayout>{children}</ClientLayout>
              </TurnstileGateProvider>
              <AppToaster />
            </AppErrorProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
