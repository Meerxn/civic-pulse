import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CivicPulse — AI Government Navigator",
  description: "Navigate Seattle city services with AI-powered step-by-step guidance in your language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
