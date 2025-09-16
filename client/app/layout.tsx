import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavbarComponent } from "@/components/Navbar";

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
  description: "Discover trending movies, series, and personalized recommendations on Moodies.",
  openGraph: {
    title: "Moodies – Movie & Series Recommendations",
    description: "Discover trending movies, series, and personalized recommendations on Moodies.",
    url: "https://your-domain.com",
    siteName: "Moodies",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Moodies – Movie & Series Recommendations",
    description: "Discover trending movies, series, and personalized recommendations on Moodies.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavbarComponent />
        <main>{children}</main>
      </body>
    </html>
  );
}
