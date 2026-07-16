import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnalyticsOS",
  description: "Unified analytics across every source, answered by AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
