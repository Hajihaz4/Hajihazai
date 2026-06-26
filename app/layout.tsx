import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HajiHaz AI",
  description:
    "Next-generation AI assistant platform powered by memory, retrieval, and multi-model intelligence.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Cover the notch / safe areas; do NOT disable user zoom (accessibility).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh overflow-x-hidden antialiased">{children}</body>
    </html>
  );
}
