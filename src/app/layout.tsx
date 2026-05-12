import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SplatAfrika — 3D Property Tours",
  description:
    "Hyperreal 3D Gaussian Splatting property tours for African real estate. Captured on smartphone, delivered as a shareable browser link.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://splatafrika.com"
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
