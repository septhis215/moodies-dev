import type { Metadata } from "next";
import { bodyFont, displayFont } from "@/lib/fonts";
import "./globals.css";
import ClientLayout from "./client-layout";
import { AppErrorProvider } from "./context/AppErrorProvider";
import { AuthProvider } from "./context/AuthProvider";
import { ToastProvider } from "./context/ToastContext";
import { AppToaster } from "@/components/providers/AppToaster";
import { TurnstileGateProvider } from "@/components/security/TurnstileGateProvider";
import PerformanceMonitor from "@/components/providers/PerformanceMonitor";
import { LoadingScreenProvider } from "@/components/loading/LoadingScreenProvider";
import AchievementProvider from "@/components/achievements/AchievementProvider";

// ISR requires persistent storage; render fresh responses on the storage-free deployment.
export const dynamic = "force-dynamic";

const SESSION_MARKER_COOKIE = "mood_session";
const SESSION_MARKER_KEY = "moodies:session";
const AUTH_PREHIDE_STYLE_ID = "moodies-auth-prehide";
const AUTH_PREHIDE_SCRIPT = `
(function () {
  try {
    var hasMarker = false;
    try { hasMarker = window.localStorage.getItem("${SESSION_MARKER_KEY}") === "1"; } catch (error) {}
    var hasCookieMarker = document.cookie.split(";").some(function (part) { return part.trim() === "${SESSION_MARKER_COOKIE}=1"; });
    var isGoogleLanding = new URLSearchParams(window.location.search).get("google_login") === "true";
    if (!hasMarker && !hasCookieMarker && !isGoogleLanding) return;
    var style = document.createElement("style");
    style.id = "${AUTH_PREHIDE_STYLE_ID}";
    style.textContent = "body{background:#000!important}body>*{visibility:hidden!important}";
    document.head.appendChild(style);
  } catch (error) {}
})();
`;

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ background: "#0b0909" }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: AUTH_PREHIDE_SCRIPT }} />
      </head>
      <body
        className={`${bodyFont.variable} ${displayFont.variable} antialiased`}
        style={{ background: "#0b0909" }}
      >
        <PerformanceMonitor />
        <LoadingScreenProvider>
          <ToastProvider>
            <AuthProvider>
              <AchievementProvider />
              <AppErrorProvider>
                <TurnstileGateProvider>
                  <ClientLayout>{children}</ClientLayout>
                </TurnstileGateProvider>
                <AppToaster />
              </AppErrorProvider>
            </AuthProvider>
          </ToastProvider>
        </LoadingScreenProvider>
      </body>
    </html>
  );
}
