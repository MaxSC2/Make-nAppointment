import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import DebugPanel from "@/components/DebugPanel";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const inter = Inter({ subsets: ["cyrillic", "latin"] });

export const metadata: Metadata = {
  title: "MedPlatform — Запись к врачу",
  description: "Медицинская информационная система",
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${inter.className} bg-background text-foreground`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <DebugPanel />
      </body>
    </html>
  );
}
