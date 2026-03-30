import type { Metadata } from "next";
import { Bebas_Neue, JetBrains_Mono, Lora } from "next/font/google";
import "./globals.css";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Lora({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "RG-Form · Rechnungsautomatisierung",
  description: "CSV aus Zeiterfassung zu Rechnung (hpcn)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full`}
    >
      <body
        className={`${body.className} min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
