import type { Metadata } from "next";
import { Roboto, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { GovChrome } from "@/components/gov-chrome";
import "./globals.css";

const sourceSans = Roboto({
  variable: "--font-sans-gov",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const sourceSerif = Roboto({
  variable: "--font-serif-gov",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GovSim — Парламентын санал хураалт",
  description:
    "Албан ёсны хуралдааны санал хураалт, удирдлага, нийтийн дэлгэцийн дүн.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="mn"
      className={`${sourceSans.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@200..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">
        <GovChrome>{children}</GovChrome>
      </body>
    </html>
  );
}
