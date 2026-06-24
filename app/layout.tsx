import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HajiHaz AI",
  description:
    "Next-generation AI assistant platform powered by memory, retrieval, and multi-model intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
