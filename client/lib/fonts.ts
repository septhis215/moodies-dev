import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";

export const bodyFont = Source_Sans_3({
  variable: "--font-body", subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"], display: "swap",
});

export const displayFont = Barlow_Condensed({
  variable: "--font-display", subsets: ["latin"], weight: ["600", "700"], display: "swap",
});
