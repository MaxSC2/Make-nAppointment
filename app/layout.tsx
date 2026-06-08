import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import DebugPanel from "@/components/DebugPanel";

const inter = Inter({ subsets: ["cyrillic", "latin"] });

export const metadata: Metadata = {
  title: "MedPlatform — Запись к врачу",
  description: "Медицинская информационная система",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${inter.className} bg-background text-foreground`}>
        {children}
        <DebugPanel />
      </body>
    </html>
  );
}
