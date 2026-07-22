import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "i.らぶ.moe", template: "%s | i.らぶ.moe" },
  description: "Minecraftのスクリーンショットを、短いURLですぐ共有。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
