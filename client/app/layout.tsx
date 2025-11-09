import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "./client-layout";
import { LoadingProvider } from "./context/LoadingContext";
import { AuthProvider } from "./context/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Moodies – Movie & Series Recommendations",
    template: "%s | Moodies",
  },
  description:
    "Discover trending movies, series, and personalized recommendations on Moodies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {/* ✅ Wrap everything inside LoadingProvider & ClientLayout */}
          <LoadingProvider>
            <ClientLayout>
              {children}
            </ClientLayout>
          </LoadingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
