import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prima Notebook",
  description: "Ruang kerja dan catatan kolaboratif Prima Notebook.",
};

export const viewport: Viewport = {
  themeColor: "#10131b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
