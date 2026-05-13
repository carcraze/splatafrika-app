import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A1628",
};

export const metadata: Metadata = {
  title: "SplatAfrika — 3D Property Tours",
  description:
    "Hyperreal 3D Gaussian Splatting property tours for African real estate. Captured on smartphone, delivered as a shareable browser link.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://splatafrika.com"
  ),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SplatAfrika",
  },
  icons: {
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="font-sans antialiased">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
