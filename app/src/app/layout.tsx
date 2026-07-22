import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "i.らぶ.moe", template: "%s | i.らぶ.moe" },
  description: "Minecraftのスクリーンショットを、短いURLですぐ共有。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ja" className="dark"><body className="min-h-screen px-3 py-6 antialiased sm:px-6 sm:py-10">{children}</body></html>;
}
