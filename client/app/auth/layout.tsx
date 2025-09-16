import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Moodies Auth",
    description: "Sign in or create your Moodies account.",
    robots: "noindex, nofollow",
    openGraph: {
        title: "Moodies Auth",
        description: "Sign in or create your Moodies account.",
        url: "https://your-domain.com/auth",
        siteName: "Moodies",
        type: "website",
    },
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white`}
            >
                <main>
                    {children}
                </main>
            </body>
        </html>
    );
}
