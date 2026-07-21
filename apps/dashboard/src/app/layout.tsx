import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Abiyasfaw Dashboard",
  description: "Operations dashboard for an Ethiopian-inspired blind dating app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
